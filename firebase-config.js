// ============================================================
//  🔥 firebase-config.js
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
  calificacion: "calificacion",
  correo:       "correo",
  fecha:        "fecha",
  grupo:        "grupo",
  materia:      "materia",
  profesor:     "profesor"
};

window.firebaseConfig = firebaseConfig;
window.DB_NODES = DB_NODES;
window.CAMPOS_ALUMNO = CAMPOS_ALUMNO;
window.CAMPOS_CALIF = CAMPOS_CALIF;
