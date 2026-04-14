// ============================================================
//  app.js — Monitor Académico para Tutoría (DISEÑO NUEVO)
// ============================================================

import { initializeApp }         from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, get } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const app  = initializeApp(firebaseConfig);
const db   = getDatabase(app);
const auth = getAuth(app);

// ── FUNCIONES AUXILIARES ───────────────────────────────────
function getStatusObj(valor) {
  if (valor >= 9) return { emoji: "😎", texto: "Excelente",     clase: "excelente" };
  if (valor >= 8) return { emoji: "🙂", texto: "Satisfactorio", clase: "bueno" };
  if (valor >= 6) return { emoji: "⚠️", texto: "En Riesgo",     clase: "riesgo" };
  return             { emoji: "😓", texto: "Crítico",          clase: "critico" };
}

function parseFecha(val) {
  if (!val || val === "---" || val === "") return null;
  const partes = String(val).split("/");
  if (partes.length === 3) {
    const d = new Date(`${partes[2]}-${partes[1]}-${partes[0]}`);
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

// ── CARGAR GRUPOS ──────────────────────────────────────────
async function cargarGrupos() {
  const sel = document.getElementById("grupo");
  sel.innerHTML = "<option value=''>Cargando grupos…</option>";
  try {
    await signInAnonymously(auth);
    const snap = await get(ref(db, DB_NODES.alumnos));
    if (!snap.exists()) { sel.innerHTML = "<option value=''>Sin datos</option>"; return; }
    const grupos = new Set();
    snap.forEach(child => {
      const a = child.val();
      const gE = (a[CAMPOS_ALUMNO.grupoEsp] || "").trim();
      const gI = (a[CAMPOS_ALUMNO.grupoIng] || "").trim();
      if (gE) grupos.add(gE);
      if (gI) grupos.add(gI);
    });
    sel.innerHTML = "<option value=''>Selecciona un grupo…</option>";
    [...grupos].sort().forEach(g => { sel.innerHTML += `<option value="${g}">${g}</option>`; });
  } catch (e) {
    sel.innerHTML = "<option value=''>Error al cargar</option>";
    console.error("cargarGrupos:", e);
  }
}

// ── BÚSQUEDA PRINCIPAL ─────────────────────────────────────
async function buscarGrupo() {
  const grupoInput = document.getElementById("grupo").value;
  if (!grupoInput) return alert("⚠️ Por favor selecciona un grupo");

  const grupoBuscado = grupoInput.toLowerCase().trim();
  const resultDiv    = document.getElementById("resultado");
  const FECHA_CORTE  = new Date(); FECHA_CORTE.setHours(23, 59, 59, 999);

  resultDiv.innerHTML = `
    <div class="loading-container">
      <div class="spinner"></div>
      <p class="loading-text">Consultando Firebase…</p>
    </div>`;

  const t0 = performance.now();

  try {
    await signInAnonymously(auth);

    // 1. ALUMNOS
    const snapAlumnos = await get(ref(db, DB_NODES.alumnos));
    if (!snapAlumnos.exists()) return mostrarError("La base de alumnos está vacía.");

    const alumnosGrupo = [];
    const correosSet   = new Set();

    snapAlumnos.forEach(child => {
      const a  = child.val();
      const gE = (a[CAMPOS_ALUMNO.grupoEsp] || "").toLowerCase().trim();
      const gI = (a[CAMPOS_ALUMNO.grupoIng] || "").toLowerCase().trim();
      if (gE === grupoBuscado || gI === grupoBuscado) {
        const correo = (a[CAMPOS_ALUMNO.correo] || "").toLowerCase().trim();
        alumnosGrupo.push({
          matricula: a[CAMPOS_ALUMNO.matricula] || "",
          nombre:    a[CAMPOS_ALUMNO.nombre]    || "Sin nombre",
          tutor:     a[CAMPOS_ALUMNO.tutor]     || "",
          correo, grupo: grupoInput
        });
        if (correo) correosSet.add(correo);
      }
    });

    if (alumnosGrupo.length === 0) return mostrarError("⚠️ No se encontraron alumnos en ese grupo.");

    // 2. CALIFICACIONES
    const snapCalif = await get(ref(db, DB_NODES.calificaciones));
    const mapaData  = {};

    if (snapCalif.exists()) {
      snapCalif.forEach(child => {
        const registros = child.val();
        if (!Array.isArray(registros) || registros.length === 0) return;
        const correoReal = (registros[0][CAMPOS_CALIF.correo] || "").toLowerCase().trim();
        if (correosSet.has(correoReal)) {
          mapaData[correoReal] = registros;
        }
      });
    }

    // 3. PROCESAMIENTO
    const resultados = alumnosGrupo.map(alumno => {
      const filasAlumno     = mapaData[alumno.correo] || [];
      const detalleMaterias = {};

      filasAlumno.forEach(item => {
        const materia   = (item[CAMPOS_CALIF.materia]   || "Sin Materia").trim();
        const profesor  = (item[CAMPOS_CALIF.profesor]  || "").trim();
        const actividad = (item[CAMPOS_CALIF.actividad] || "Actividad").trim();

        const fechaObj       = parseFecha(item[CAMPOS_CALIF.fecha]);
        const fechaStr       = fechaObj
          ? fechaObj.toLocaleDateString("es-MX", { day:"2-digit", month:"2-digit", year:"numeric" })
          : (item[CAMPOS_CALIF.fecha] || "—");
        const fechaTimestamp = fechaObj ? fechaObj.getTime() : 0;

        const valCalif = item[CAMPOS_CALIF.calificacion];
        let calNum = 0, tieneNota = false;
        if (valCalif !== null && valCalif !== undefined && valCalif !== "") {
          const p = typeof valCalif === "number" ? valCalif : parseFloat(String(valCalif).replace(",", "."));
          if (!isNaN(p)) { calNum = p; tieneNota = true; }
        }

        if (!detalleMaterias[materia]) {
          detalleMaterias[materia] = { profesor, baseCalculo:0, entregas:0, sumaNotas:0, conteoNotas:0, acts:[] };
        }

        const esActiva = (fechaTimestamp > 0 && fechaTimestamp <= FECHA_CORTE.getTime()) || tieneNota;
        if (esActiva) {
          detalleMaterias[materia].baseCalculo++;
          if (tieneNota) {
            detalleMaterias[materia].entregas++;
            detalleMaterias[materia].sumaNotas   += calNum;
            detalleMaterias[materia].conteoNotas++;
          }
        }
        detalleMaterias[materia].acts.push({ actividad, fecha: fechaStr, calificacion: tieneNota ? calNum : "—", ts: fechaTimestamp });
      });

      let sumPromedios = 0, sumProductividad = 0, materiasConNota = 0, materiasConActividad = 0;
      const resumenMateria = [];

      for (const mat in detalleMaterias) {
        const d = detalleMaterias[mat];
        d.acts.sort((a, b) => (b.ts || 0) - (a.ts || 0));
        const scoreProd = d.baseCalculo > 0 ? (d.entregas / d.baseCalculo) * 100 : 100;
        const promReal  = d.conteoNotas  > 0 ? d.sumaNotas / d.conteoNotas  : 0;
        if (d.baseCalculo > 0 || d.conteoNotas > 0) { sumProductividad += scoreProd; materiasConActividad++; }
        if (d.conteoNotas > 0)                       { sumPromedios    += promReal;  materiasConNota++; }
        resumenMateria.push({
          materia: mat, profesor: d.profesor,
          promedio: promReal.toFixed(1), productividad: scoreProd.toFixed(0),
          calificadas: d.entregas, totalActividades: d.baseCalculo,
          actividades: d.acts, status: getStatusObj(promReal)
        });
      }

      resumenMateria.sort((a, b) => parseFloat(b.promedio) - parseFloat(a.promedio));
      const promedioFinal      = materiasConNota      > 0 ? sumPromedios     / materiasConNota      : 0;
      const productividadFinal = materiasConActividad > 0 ? sumProductividad / materiasConActividad : 0;

      return {
        alumno, resumen: resumenMateria,
        globales: { promedio: promedioFinal.toFixed(1), productividad: productividadFinal.toFixed(0), statusInfo: getStatusObj(promedioFinal) }
      };
    });

    document.getElementById("timer-info").textContent = ((performance.now() - t0) / 1000).toFixed(2) + "s";
    render(resultados);

  } catch (e) {
    console.error(e);
    mostrarError("Error de sistema: " + e.message);
  }
}

// ── RENDER (GRID DE TARJETAS) ──────────────────────────────
function render(data) {
  if (!data || data.length === 0) return mostrarError("No hay alumnos.");
  data.sort((a, b) => a.alumno.nombre.localeCompare(b.alumno.nombre));

  let html = "";
  data.forEach((d) => {
    const { promedio, productividad, statusInfo: st } = d.globales;
    const sinDatos = d.resumen.length === 0;

    html += `
    <div class="tarjeta-alumno" onclick="abrirModalAlumno(${JSON.stringify(d).replace(/"/g, '&quot;')})">
      <div class="tarjeta-header">
        <div class="tarjeta-avatar">🎓</div>
        <div class="tarjeta-info">
          <h3>${d.alumno.nombre}</h3>
          <p>${d.alumno.matricula}</p>
        </div>
      </div>
      
      <div class="tarjeta-stats">
        <span class="stat-badge ${st.clase}">⭐ ${promedio}</span>
        <span class="stat-badge">📊 ${productividad}%</span>
      </div>
      
      <div class="tarjeta-status status-${st.clase}">
        ${st.emoji} ${st.texto}
      </div>
    </div>`;
  });

  document.getElementById("resultado").innerHTML = html;
}

function mostrarError(msg) {
  document.getElementById("resultado").innerHTML = `<div class="error-message">${msg}</div>`;
}

// ── MODAL DEL ALUMNO ───────────────────────────────────────
window.abrirModalAlumno = function(datos) {
  const modal = document.getElementById("modalAlumno");
  const st = datos.globales.statusInfo;

  document.getElementById("modalNombre").textContent = datos.alumno.nombre;
  document.getElementById("modalMatricula").textContent = "Matrícula: " + datos.alumno.matricula;
  document.getElementById("modalPromedio").textContent = datos.globales.promedio;
  document.getElementById("modalEstado").textContent = st.texto;
  document.getElementById("modalEstado").className = `estado-badge stat-badge-${st.clase}`;
  
  const prodNum = parseFloat(datos.globales.productividad);
  document.getElementById("modalProductividad").style.width = prodNum + "%";
  document.getElementById("modalProductividadPorcentaje").textContent = datos.globales.productividad + "%";

  // Materias
  let materiasHTML = "";
  datos.resumen.forEach(mat => {
    let actHTML = `
      <div class="actividades-tabla">
        <table>
          <thead>
            <tr>
              <th>Actividad</th>
              <th>Fecha</th>
              <th>Nota</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>`;
    
    mat.actividades.slice(0, 5).forEach(a => {
      const cls = (a.calificacion !== "—" && Number(a.calificacion) < 6) ? "calificacion-bad" : "calificacion-good";
      actHTML += `
        <tr>
          <td>${a.actividad.substring(0, 20)}</td>
          <td>${a.fecha}</td>
          <td class="${cls}">${a.calificacion}</td>
          <td class="status-completed">✓</td>
        </tr>`;
    });
    
    actHTML += `</tbody></table></div>`;

    materiasHTML += `
    <div class="materia-item">
      <div class="materia-header">
        <div>
          <div class="materia-nombre">${mat.materia}</div>
          <div class="profesor-nombre">👨‍🏫 ${mat.profesor || "Sin asignar"}</div>
        </div>
        <div class="materia-badges">
          <span class="badge-promedio">⭐ ${mat.promedio}</span>
          <span class="badge-avance">📈 ${mat.productividad}%</span>
        </div>
      </div>
      ${actHTML}
    </div>`;
  });

  document.getElementById("modalMaterias").innerHTML = materiasHTML || "<p>Sin materias registradas</p>";

  // Fortalezas
  const fortalezas = datos.resumen
    .filter(m => parseFloat(m.promedio) >= 8)
    .map(m => `<div class="fortaleza-item">📌 ${m.materia}: ${m.promedio}</div>`)
    .join("");
  document.getElementById("modalFortalezas").innerHTML = fortalezas || "<div class='fortaleza-item'>Por mejorar</div>";

  // Áreas de mejora
  const mejora = datos.resumen
    .filter(m => parseFloat(m.promedio) < 6)
    .map(m => `<div class="mejora-item">⚠️ ${m.materia}: ${m.promedio}</div>`)
    .join("");
  document.getElementById("modalMejora").innerHTML = mejora || "<div class='mejora-item'>¡Muy bien!</div>";

  // Recomendaciones
  let recomendaciones = "";
  if (parseFloat(datos.globales.promedio) < 6) {
    recomendaciones += `<div class="recom-item">📌 Aumentar dedicación a materias con bajo promedio</div>`;
  }
  if (parseFloat(datos.globales.productividad) < 80) {
    recomendaciones += `<div class="recom-item">📌 Mejorar cumplimiento de entregas</div>`;
  }
  if (parseFloat(datos.globales.promedio) >= 9) {
    recomendaciones += `<div class="recom-item">🎉 ¡Excelente desempeño! Mantén el ritmo</div>`;
  }
  
  document.getElementById("modalRecomendaciones").innerHTML = recomendaciones || "<div class='recom-item'>Continuar con buen desempeño</div>";

  modal.classList.add("activo");
};

window.cerrarModalAlumno = function() {
  document.getElementById("modalAlumno").classList.remove("activo");
};

// Click fuera del modal
window.onclick = function(event) {
  const modal = document.getElementById("modalAlumno");
  if (event.target === modal) {
    modal.classList.remove("activo");
  }
};

// ── INIT ───────────────────────────────────────────────────
window.buscarGrupo = buscarGrupo;
cargarGrupos();
