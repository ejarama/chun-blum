import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import {
  collection, doc, getDoc, getDocs,
  query, orderBy, limit,
  runTransaction, addDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";
import { renderizarSidebar, configurarCerrarSesion } from "../js/sidebar.js";

// ── Verificar que solo la operaria o admin accede ─────────────────────────
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "../pages/login.html";
    return;
  }

  const docSnap = await getDoc(doc(db, "usuarios", user.uid));
  if (!docSnap.exists() || !["operaria", "admin"].includes(docSnap.data().rol)) {
    window.location.href = "../pages/login.html?error=permisos";
    return;
  }

  usuarioActual = { uid: user.uid, ...docSnap.data() };
  const rol = docSnap.data().rol;
  renderizarSidebar(rol, "produccion.html");
  configurarCerrarSesion();
  await cargarProductos();
  await cargarHistorialReciente();
});

// ── Estado ────────────────────────────────────────────────────────
let usuarioActual = null;
let productosMap  = {};

// ── Referencias DOM ───────────────────────────────────────────────
const formLote         = document.getElementById("formLote");
const selectProducto   = document.getElementById("selectProducto");
const inputCantidad    = document.getElementById("inputCantidad");
const inputObservaciones = document.getElementById("inputObservaciones");
const btnGuardar       = document.getElementById("btnGuardar");
const alertaExito      = document.getElementById("alertaExito");
const alertaError      = document.getElementById("alertaError");
const productoInfo     = document.getElementById("productoInfo");
const stockActual      = document.getElementById("stockActual");
const estadoBadge      = document.getElementById("estadoBadge");
const errorProducto    = document.getElementById("errorProducto");
const errorCantidad    = document.getElementById("errorCantidad");
const historialReciente = document.getElementById("historialReciente");


function configurarSidebar(rol) {
  const nav = document.querySelector(".sidebar-nav");
  const logo = document.querySelector(".sidebar-logo p");

  if (rol === "operaria") {
    logo.textContent = "Panel de producción";
    nav.innerHTML = `
      <a href="produccion.html" class="activo">Registrar lote</a>
      <a href="inventario.html">Inventario</a>
    `;
  } else {
    logo.textContent = "Panel de administración";
    nav.innerHTML = `
      <a href="dashboard.html">Inicio</a>
      <a href="usuarios.html">Usuarios</a>
      <a href="inventario.html">Inventario</a>
      <a href="produccion.html" class="activo">Registrar lote</a>
      <a href="pedidos.html">Pedidos</a>
    `;
  }
}

// ── Cargar productos desde Firestore ──────────────────────────────
async function cargarProductos() {
  try {
    const snapshot = await getDocs(collection(db, "productos"));
    productosMap = {};

    selectProducto.innerHTML = '<option value="">— Selecciona un producto —</option>';

    snapshot.forEach((docSnap) => {
      const p = docSnap.data();
      productosMap[docSnap.id] = { id: docSnap.id, ...p };

      const option = document.createElement("option");
      option.value = docSnap.id;
      option.textContent = `${p.referencia} — ${p.nombre}`;
      selectProducto.appendChild(option);
    });

  } catch (error) {
    selectProducto.innerHTML = '<option value="">Error al cargar productos</option>';
  }
}

// ── Mostrar info del producto al seleccionar ──────────────────────
selectProducto.addEventListener("change", () => {
  const id = selectProducto.value;
  errorProducto.classList.remove("visible");
  selectProducto.classList.remove("input-error");

  if (!id) {
    productoInfo.classList.remove("visible");
    return;
  }

  const p = productosMap[id];
  stockActual.textContent = `${p.stockDisponible} unidades`;

  estadoBadge.textContent = p.estado;
  estadoBadge.className = "stock-badge";

  if (p.estado === "disponible")    estadoBadge.classList.add("stock-disponible");
  else if (p.estado === "agotado")  estadoBadge.classList.add("stock-agotado");
  else                              estadoBadge.classList.add("stock-produccion");

  productoInfo.classList.add("visible");
});

// ── Validar formulario ────────────────────────────────────────────
function validar() {
  let valido = true;

  selectProducto.classList.remove("input-error");
  inputCantidad.classList.remove("input-error");
  errorProducto.classList.remove("visible");
  errorCantidad.classList.remove("visible");

  if (!selectProducto.value) {
    selectProducto.classList.add("input-error");
    errorProducto.classList.add("visible");
    valido = false;
  }

  const cantidad = parseInt(inputCantidad.value);
  if (!inputCantidad.value || isNaN(cantidad) || cantidad <= 0) {
    inputCantidad.classList.add("input-error");
    errorCantidad.classList.add("visible");
    valido = false;
  }

  return valido;
}

// ── Registrar lote ────────────────────────────────────────────────
formLote.addEventListener("submit", async function(e) {
  e.preventDefault();

  alertaExito.classList.remove("visible");
  alertaError.classList.remove("visible");

  if (!validar()) return;

  btnGuardar.disabled = true;
  btnGuardar.textContent = "Registrando...";

  const productoId = selectProducto.value;
  const cantidad   = parseInt(inputCantidad.value);
  const obs        = inputObservaciones.value.trim();
  const producto   = productosMap[productoId];

  try {
    const productoRef = doc(db, "productos", productoId);

    // ── Transacción atómica ───────────────────────────────────────
    await runTransaction(db, async (transaction) => {
      const productoSnap = await transaction.get(productoRef);

      if (!productoSnap.exists()) {
        throw new Error("El producto no existe.");
      }

      const dataActual     = productoSnap.data();
      const nuevoStock     = dataActual.stockDisponible + cantidad;
      const nuevoEstado    = nuevoStock > 0 ? "disponible" : dataActual.estado;

      transaction.update(productoRef, {
        stockDisponible:     nuevoStock,
        estado:              nuevoEstado,
        ultimaActualizacion: new Date().toISOString(),
      });
    });

    // ── Guardar en lotes_produccion ───────────────────────────────
    await addDoc(collection(db, "lotes_produccion"), {
      productoId,
      productoNombre:  producto.nombre,
      productoRef:     producto.referencia,
      cantidadProducida: cantidad,
      operariaId:      usuarioActual.uid,
      operariaNombre:  usuarioActual.nombre,
      observaciones:   obs,
      fechaRegistro:   serverTimestamp(),
    });

    // ── Actualizar UI ─────────────────────────────────────────────
    alertaExito.classList.add("visible");

    const nuevoStock = producto.stockDisponible + cantidad;
    productosMap[productoId].stockDisponible = nuevoStock;
    productosMap[productoId].estado = nuevoStock > 0 ? "disponible" : producto.estado;

    stockActual.textContent = `${nuevoStock} unidades`;
    estadoBadge.textContent = productosMap[productoId].estado;
    estadoBadge.className = "stock-badge stock-disponible";

    formLote.reset();
    productoInfo.classList.remove("visible");
    await cargarHistorialReciente();

    setTimeout(() => alertaExito.classList.remove("visible"), 5000);

  } catch (error) {
    alertaError.textContent = `Error al registrar el lote: ${error.message}`;
    alertaError.classList.add("visible");
  } finally {
    btnGuardar.disabled = false;
    btnGuardar.textContent = "Registrar lote";
  }
});

// ── Cargar historial reciente ─────────────────────────────────────
async function cargarHistorialReciente() {
  historialReciente.innerHTML = '<div class="loading">Cargando...</div>';

  try {
    const q = query(
      collection(db, "lotes_produccion"),
      orderBy("fechaRegistro", "desc"),
      limit(5)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      historialReciente.innerHTML = '<div class="empty-state">No hay lotes registrados aún.</div>';
      return;
    }

    historialReciente.innerHTML = "";

    snapshot.forEach((docSnap) => {
      const l = docSnap.data();
      const fecha = l.fechaRegistro?.toDate
        ? l.fechaRegistro.toDate().toLocaleString("es-CO")
        : "Fecha no disponible";

      const item = document.createElement("div");
      item.className = "historial-item";
      item.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <strong>${l.productoNombre}</strong>
          <span class="stock-badge stock-disponible">+${l.cantidadProducida} unidades</span>
        </div>
        <div class="historial-fecha">${fecha} · ${l.operariaNombre}</div>
        ${l.observaciones ? `<div style="font-size:12px;color:#80868b;margin-top:3px;">${l.observaciones}</div>` : ""}
      `;
      historialReciente.appendChild(item);
    });

  } catch (error) {
    historialReciente.innerHTML = '<div class="empty-state">Error al cargar el historial.</div>';
  }
}