import { auth, db } from "./firebase-config.js";
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

const formLogin     = document.getElementById("formLogin");
const inputCorreo   = document.getElementById("correo");
const inputPass     = document.getElementById("contrasena");
const errorCorreo   = document.getElementById("errorCorreo");
const errorPass     = document.getElementById("errorContrasena");
const alertaError   = document.getElementById("alertaError");
const btnLogin      = document.getElementById("btnLogin");

function limpiarErrores() {
  inputCorreo.classList.remove("input-error");
  inputPass.classList.remove("input-error");
  errorCorreo.classList.remove("visible");
  errorPass.classList.remove("visible");
  alertaError.classList.remove("visible");
}

function validarCampos() {
  let valido = true;

  if (!inputCorreo.value.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inputCorreo.value)) {
    inputCorreo.classList.add("input-error");
    errorCorreo.classList.add("visible");
    valido = false;
  }

  if (!inputPass.value.trim()) {
    inputPass.classList.add("input-error");
    errorPass.classList.add("visible");
    valido = false;
  }

  return valido;
}

const RUTAS = {
  admin:        "../pages/dashboard.html",
  operaria:     "../pages/produccion.html",
  vendedor:     "../pages/pedidos.html",
  distribuidor: "../pages/catalogo.html",
};

formLogin.addEventListener("submit", async (e) => {
  e.preventDefault();
  limpiarErrores();

  if (!validarCampos()) return;

  btnLogin.disabled = true;
  btnLogin.textContent = "Ingresando...";

  try {
    const credencial = await signInWithEmailAndPassword(
      auth,
      inputCorreo.value.trim(),
      inputPass.value
    );

    const uid = credencial.user.uid;
    const docRef = doc(db, "usuarios", uid);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      throw new Error("usuario-no-encontrado");
    }

    const datos = docSnap.data();

    if (datos.activo === false) {
      throw new Error("cuenta-desactivada");
    }

    const ruta = RUTAS[datos.rol];

    if (!ruta) {
      throw new Error("rol-desconocido");
    }

    window.location.href = ruta;

  } catch (error) {
    btnLogin.disabled = false;
    btnLogin.textContent = "Ingresar";

    if (error.message === "cuenta-desactivada") {
      alertaError.textContent = "Tu cuenta está desactivada. Contacta al administrador.";
    } else if (error.message === "usuario-no-encontrado" || error.message === "rol-desconocido") {
      alertaError.textContent = "No se encontró tu perfil. Contacta al administrador.";
    } else {
      alertaError.textContent = "Correo o contraseña incorrectos. Intenta de nuevo.";
    }

    alertaError.classList.add("visible");
  }
});