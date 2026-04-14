// ============================================================
//  🔥 firebase-config.js — EDITA ESTE ARCHIVO CON TUS DATOS
// ============================================================
//  Consola Firebase → ⚙️ Configuración del proyecto
//  → General → Tus apps → SDK de la app y configuración
// ============================================================

const firebaseConfig = {
  apiKey: "AIzaSyCkSgBxKaZBEDrF_RhFGCK6tZjlzdTQt10",
  authDomain: "er-reporte---3er-periodo-44119.firebaseapp.com",
  databaseURL: "https://er-reporte---3er-periodo-44119-default-rtdb.firebaseio.com",
  projectId: "er-reporte---3er-periodo-44119",
  storageBucket: "er-reporte---3er-periodo-44119.firebasestorage.app",
  messagingSenderId: "215491922286",
  appId: "1:215491922286:web:640b1a035e9ccd6432597f"
};

// ============================================================
//  🗂️  NODOS Y CAMPOS — ya configurados con tu estructura real
// ============================================================
//
//  Tu DB tiene:
//
//  /alumnos/{matricula}
//    correo, grupoEsp, grupoIng, matricula, nombre, tutor
//
//  /calificaciones/{correo_con_puntos_a_guiones}   ← es un ARRAY
//    [ { actividad, alumno, calificacion, correo,
//        fecha, grupo, materia, profesor }, ... ]
//
// ============================================================

const DB_NODES = {
  alumnos:        "alumnos",
  calificaciones: "calificaciones"
};

const CAMPOS_ALUMNO = {
  matricula: "matricula",
  nombre:    "nombre",
  correo:    "correo",
  grupoEsp:  "grupoEsp",
  grupoIng:  "grupoIng",
  tutor:     "tutor"
};

const CAMPOS_CALIF = {
  actividad:    "actividad",
  alumno:       "alumno",
  calificacion: "calificacion",  // número directo, no string
  correo:       "correo",
  fecha:        "fecha",         // string "dd/MM/yyyy" o "---"
  grupo:        "grupo",
  materia:      "materia",
  profesor:     "profesor"
};

// Convierte correo → clave Firebase (puntos a guiones bajos)
// Ej: "a.luis@ibime.edu.mx" → "a_luis@ibime_edu_mx"
function correoAKey(correo) {
  return correo.replace(/\./g, "_");
}
// ✅ HACER VARIABLES GLOBALES ACCESIBLES A app.j
window.firebaseConfig = firebaseConfig;
window.DB_NODES = DB_NODES;
window.CAMPOS_ALUMNO = CAMPOS_ALUMNO;
window.CAMPOS_CALIF = CAMPOS_CALIF;
