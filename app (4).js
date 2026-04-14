// ============================================================
//  app.js — Monitor Académico (adaptado a tu Firebase real)
// ============================================================

import { initializeApp }         from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, get } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const app  = initializeApp(firebaseConfig);
const db   = getDatabase(app);
const auth = getAuth(app);

// ── SEMÁFORO ─────────────────────────────────────────────
function getStatusObj(valor) {
  if (valor >= 9) return { emoji: "😎", texto: "Excelente",     color: "#3B82F6" };
  if (valor >= 8) return { emoji: "🙂", texto: "Satisfactorio", color: "#10B981" };
  if (valor >= 6) return { emoji: "⚠️", texto: "En Riesgo",     color: "#F59E0B" };
  return             { emoji: "😓", texto: "Crítico",          color: "#EF4444" };
}

// ── PARSEO DE FECHA ("dd/MM/yyyy" o "---") ────────────────
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

// ── CARGAR GRUPOS ────────────────────────────────────────
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

// ── BÚSQUEDA PRINCIPAL ───────────────────────────────────
async function buscarGrupo() {
  const grupoInput = document.getElementById("grupo").value;
  if (!grupoInput) return alert("⚠️ Por favor selecciona un grupo");

  const grupoBuscado = grupoInput.toLowerCase().trim();
  const resultDiv    = document.getElementById("resultado");
  const FECHA_CORTE  = new Date(); FECHA_CORTE.setHours(23, 59, 59, 999);

  resultDiv.innerHTML = `
    <div style="text-align:center;width:100%;margin-top:60px;grid-column:1/-1">
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
    // Estructura: /calificaciones/{correo_con_puntos_a_guiones} = ARRAY
    const snapCalif = await get(ref(db, DB_NODES.calificaciones));
    const mapaData  = {};

    if (snapCalif.exists()) {
      snapCalif.forEach(child => {
        const registros = child.val();
        if (!Array.isArray(registros) || registros.length === 0) return;
        // El correo real está dentro del primer registro
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

// ── RENDER ───────────────────────────────────────────────
function render(data) {
  if (!data || data.length === 0) return mostrarError("No hay alumnos.");
  data.sort((a, b) => a.alumno.nombre.localeCompare(b.alumno.nombre));

  let html = "";
  data.forEach((d, idx) => {
    const { promedio, productividad, statusInfo: st } = d.globales;
    const sinDatos = d.resumen.length === 0;

    html += `
    <div class="alumno-contenedor" id="cont-${idx}">
      <div class="alumno-box" onclick="toggleExpand(${idx})">
        <div class="box-content-top">
          <div class="alumno-icon">🎓</div>
          <div class="alumno-name">${d.alumno.nombre}</div>
          <p class="alumno-mat">${d.alumno.matricula}</p>
          <div class="global-stats">
            <div class="stat-card">
              <span class="stat-label">Promedio</span>
              <span class="stat-value" style="color:#4F46E5">⭐ ${sinDatos ? "—" : promedio}</span>
            </div>
            <div class="stat-card">
              <span class="stat-label">Avance</span>
              <span class="stat-value" style="color:#10B981">📊 ${sinDatos ? "—" : productividad + "%"}</span>
            </div>
          </div>
        </div>
        <div class="status-bar" style="background:${sinDatos ? "#9CA3AF" : st.color}">
          ${sinDatos ? "📭 Sin registros" : st.emoji + " " + st.texto}
        </div>
      </div>
      <div class="detalle-alumno" id="det-${idx}">`;

    if (sinDatos) {
      html += `<div class="subject-box" style="justify-content:center;color:#94a3b8;">📭 No hay calificaciones registradas</div>`;
    } else {
      d.resumen.forEach((mat, mIdx) => {
        const uid = `w-${idx}-${mIdx}`, bid = `b-${idx}-${mIdx}`;
        html += `
        <div id="${bid}" class="subject-box" onclick="toggleMateria('${uid}','${bid}',${idx})">
          <div class="subject-info">
            <span class="subject-name">${mat.materia}</span>
            <span class="prof-name">👨‍🏫 ${mat.profesor || "Sin asignar"}</span>
          </div>
          <div class="indicators">
            <span class="badge badge-avg">⭐ ${mat.promedio}</span>
            <span class="badge badge-prog">📊 ${mat.productividad}%</span>
          </div>
        </div>
        <div id="${uid}" class="materia-content-wrapper">
          <table class="actividad-table">
            <thead><tr><th>Actividad</th><th>Fecha</th><th>Nota</th></tr></thead>
            <tbody>`;
        mat.actividades.forEach(a => {
          const cls = (a.calificacion !== "—" && Number(a.calificacion) < 6) ? "score-bad" : "score-good";
          html += `<tr><td>${a.actividad}</td><td>${a.fecha}</td><td class="${cls}">${a.calificacion}</td></tr>`;
        });
        html += `</tbody></table></div>`;
      });
    }
    html += `</div></div>`;
  });

  document.getElementById("resultado").innerHTML = html;
  document.querySelectorAll(".alumno-contenedor").forEach((el, i) => {
    setTimeout(() => el.classList.add("fade-in"), i * 70);
  });
}

function mostrarError(msg) {
  document.getElementById("resultado").innerHTML = `<div class="mensaje" style="grid-column:1/-1">${msg}</div>`;
}

// ── INTERACCIONES UI ─────────────────────────────────────
window.toggleExpand = function(idx) {
  const target = document.getElementById(`cont-${idx}`);
  const isExpanded = target.classList.contains("expanded");
  document.querySelectorAll(".alumno-contenedor").forEach(c => {
    c.classList.remove("expanded", "dimmed");
    const det = c.querySelector(".detalle-alumno");
    if (det) det.style.display = "none";
    c.querySelector(".alumno-box").classList.remove("active", "inactive");
  });
  if (!isExpanded) {
    target.classList.add("expanded");
    target.querySelector(".alumno-box").classList.add("active");
    document.getElementById(`det-${idx}`).style.display = "block";
    document.querySelectorAll(".alumno-contenedor").forEach((c, i) => {
      if (i !== idx) { c.classList.add("dimmed"); c.querySelector(".alumno-box").classList.add("inactive"); }
    });
    setTimeout(() => target.scrollIntoView({ behavior: "smooth", block: "start" }), 300);
  }
};

window.toggleMateria = function(wid, bid, pIdx) {
  const wrap = document.getElementById(wid), btn = document.getElementById(bid);
  const parent = document.getElementById(`det-${pIdx}`);
  if (!wrap.style.maxHeight) {
    parent.querySelectorAll(".materia-content-wrapper").forEach(w => w.style.maxHeight = null);
    parent.querySelectorAll(".subject-box").forEach(b => b.classList.remove("active-materia"));
    wrap.style.maxHeight = wrap.scrollHeight + "px";
    btn.classList.add("active-materia");
  } else {
    wrap.style.maxHeight = null;
    btn.classList.remove("active-materia");
  }
};

// ── INIT ─────────────────────────────────────────────────
window.buscarGrupo = buscarGrupo;
cargarGrupos();
