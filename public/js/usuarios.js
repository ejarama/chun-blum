import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import { collection, getDocs, doc, getDoc, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";
import { renderizarSidebar, configurarCerrarSesion } from "../js/sidebar.js";

let todosLosUsuarios = [];

// ── Verificar que solo el admin accede ────────────────
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "../pages/login.html";
    return;
  }

  const docSnap = await getDoc(doc(db, "usuarios", user.uid));
  if (!docSnap.exists() || !["admin"].includes(docSnap.data().rol)) {
    window.location.href = "../pages/login.html?error=permisos";
    return;
  }

  const rol = docSnap.data().rol;
  renderizarSidebar(rol, "usuarios.html");
  configurarCerrarSesion();
  cargarUsuarios();

});

// ── Referencias DOM ───────────────────────────────────
const listaUsuarios     = document.getElementById("listaUsuarios");
const btnNuevoUsuario   = document.getElementById("btnNuevoUsuario");
const modalOverlay      = document.getElementById("modalOverlay");
const btnCancelarModal  = document.getElementById("btnCancelarModal");
const btnGuardarUsuario = document.getElementById("btnGuardarUsuario");
const alertaModal       = document.getElementById("alertaModal");

const inputNombre   = document.getElementById("modalNombre");
const inputEmail    = document.getElementById("modalEmail");
const inputPassword = document.getElementById("modalPassword");
const selectRol     = document.getElementById("modalRol");

const errorNombre   = document.getElementById("errorNombre");
const errorEmail    = document.getElementById("errorEmail");
const errorPassword = document.getElementById("errorPassword");

const buscador    = document.getElementById("buscador");
const filtroRol   = document.getElementById("filtroRol");
const filtroEstado = document.getElementById("filtroEstado");


// ── listeners de los filtros─────────────────────────────────────
buscador.addEventListener("input", aplicarFiltros);
filtroRol.addEventListener("change", aplicarFiltros);
filtroEstado.addEventListener("change", aplicarFiltros);

// ── Cargar lista de usuarios ──────────────────────────
async function cargarUsuarios() {
  const listaUsuarios = document.getElementById("listaUsuarios");
  listaUsuarios.innerHTML = '<div class="loading">Cargando usuarios...</div>';

  try {
    const snapshot = await getDocs(collection(db, "usuarios"));
    todosLosUsuarios = [];

    snapshot.forEach((docSnap) => {
      todosLosUsuarios.push({ uid: docSnap.id, ...docSnap.data() });
    });

    renderizarUsuarios(todosLosUsuarios);

  } catch (error) {
    listaUsuarios.innerHTML = '<div class="empty-state">Error al cargar usuarios.</div>';
  }
}

function renderizarUsuarios(lista) {
  const listaUsuarios = document.getElementById("listaUsuarios");

  if (lista.length === 0) {
    listaUsuarios.innerHTML = '<div class="empty-state">No se encontraron usuarios.</div>';
    return;
  }

  listaUsuarios.innerHTML = "";

  lista.forEach((u) => {
    const item = document.createElement("div");
    item.className = "usuario-item";
    item.innerHTML = `
      <div class="usuario-info">
        <div class="usuario-nombre">${u.nombre}</div>
        <div class="usuario-email">${u.email}</div>
        <div class="usuario-meta">
          <span class="badge-rol">${u.rol}</span>
          <span class="badge-estado ${u.activo ? 'badge-activo' : 'badge-inactivo'}">
            ${u.activo ? 'Activo' : 'Inactivo'}
          </span>
        </div>
      </div>
      <div class="usuario-acciones">
        <button class="btn-secundario btn-sm"
          onclick="toggleEstado('${u.uid}', ${u.activo})">
          ${u.activo ? 'Desactivar' : 'Activar'}
        </button>
      </div>
    `;
    listaUsuarios.appendChild(item);
  });
}

function aplicarFiltros() {
  const texto  = buscador.value.toLowerCase().trim();
  const rol    = filtroRol.value;
  const estado = filtroEstado.value;

  const filtrados = todosLosUsuarios.filter((u) => {
    const coincideTexto  = !texto  || u.nombre.toLowerCase().includes(texto) || u.email.toLowerCase().includes(texto);
    const coincideRol    = !rol    || u.rol === rol;
    const coincideEstado = !estado || (estado === "activo" ? u.activo : !u.activo);
    return coincideTexto && coincideRol && coincideEstado;
  });

  renderizarUsuarios(filtrados);
}

// ── Toggle activar / desactivar ───────────────────────
window.toggleEstado = async (uid, estadoActual) => {
  try {
    await updateDoc(doc(db, "usuarios", uid), {
      activo: !estadoActual
    });
    cargarUsuarios();
  } catch (error) {
    alert("Error al actualizar el estado del usuario.");
  }
};

// ── Abrir y cerrar modal ──────────────────────────────
btnNuevoUsuario.addEventListener("click", () => {
  limpiarModal();
  modalOverlay.classList.add("visible");
});

btnCancelarModal.addEventListener("click", () => {
  modalOverlay.classList.remove("visible");
});

modalOverlay.addEventListener("click", (e) => {
  if (e.target === modalOverlay) {
    modalOverlay.classList.remove("visible");
  }
});

// ── Validar campos del modal ──────────────────────────
function validarModal() {
  let valido = true;

  if (!inputNombre.value.trim()) {
    inputNombre.classList.add("input-error");
    errorNombre.classList.add("visible");
    valido = false;
  }

  if (!inputEmail.value.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inputEmail.value)) {
    inputEmail.classList.add("input-error");
    errorEmail.classList.add("visible");
    valido = false;
  }

  if (inputPassword.value.length < 6) {
    inputPassword.classList.add("input-error");
    errorPassword.classList.add("visible");
    valido = false;
  }

  return valido;
}

function limpiarModal() {
  inputNombre.value = "";
  inputEmail.value = "";
  inputPassword.value = "";
  selectRol.value = "distribuidor";
  inputNombre.classList.remove("input-error");
  inputEmail.classList.remove("input-error");
  inputPassword.classList.remove("input-error");
  errorNombre.classList.remove("visible");
  errorEmail.classList.remove("visible");
  errorPassword.classList.remove("visible");
  alertaModal.classList.remove("visible");
  alertaModal.textContent = "";
}

// ── Guardar nuevo usuario ─────────────────────────────
btnGuardarUsuario.addEventListener("click", async (e) => {
  e.preventDefault();
  e.stopPropagation();

  if (!validarModal()) return;

  btnGuardarUsuario.disabled = true;
  btnGuardarUsuario.textContent = "Guardando...";

  try {
    const API_KEY = auth.app.options.apiKey;
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`;

    const respuesta = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: inputEmail.value.trim(),
        password: inputPassword.value,
        returnSecureToken: true
      })
    });

    const datos = await respuesta.json();

    if (datos.error) {
      if (datos.error.message === "EMAIL_EXISTS") {
        alertaModal.textContent = "Este correo ya está registrado.";
      } else {
        alertaModal.textContent = "Error al crear el usuario. Intenta de nuevo.";
      }
      alertaModal.classList.add("visible");
      return;
    }

    const nuevoUid = datos.localId;

    await setDoc(doc(db, "usuarios", nuevoUid), {
      nombre: inputNombre.value.trim(),
      email: inputEmail.value.trim(),
      rol: selectRol.value,
      activo: true
    });

    modalOverlay.classList.remove("visible");
    cargarUsuarios();

  } catch (error) {
    alertaModal.textContent = "Error de conexión. Intenta de nuevo.";
    alertaModal.classList.add("visible");
  } finally {
    btnGuardarUsuario.disabled = false;
    btnGuardarUsuario.textContent = "Guardar";
  }
});