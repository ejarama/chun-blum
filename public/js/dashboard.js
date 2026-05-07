import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import {
  collection, doc, getDoc, onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";
import { renderizarSidebar, configurarCerrarSesion } from "./sidebar.js";

// ── Lógica de negocio pura (exportada para tests) ─────────────────

export function contarPedidosDelDia(pedidos, fechaHoy) {
  return pedidos.filter(p => {
    if (!p.fechaPedido) return false;
    const fecha = p.fechaPedido.toDate ? p.fechaPedido.toDate() : new Date(p.fechaPedido);
    return fecha.toDateString() === fechaHoy.toDateString();
  }).length;
}

export function filtrarStockBajo(productos) {
  return productos.filter(p => p.stockDisponible < p.umbralMinimo);
}

export function contarPedidosPendientes(pedidos) {
  return pedidos.filter(p => p.estado === "pendiente").length;
}

export function obtenerEnlaceDashboard(seccion) {
  const enlaces = {
    inventario: "inventario.html",
    pedidos:    "pedidos.html",
    produccion: "produccion.html",
    usuarios:   "usuarios.html",
  };
  return enlaces[seccion] ?? null;
}

export function esAdmin(rol) {
  return rol === "admin";
}

// ── Estado ────────────────────────────────────────────────────────
let unsubscribePedidos   = null;
let unsubscribeProductos = null;
let pedidos   = [];
let productos = [];

// ── Autenticación ─────────────────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "../pages/login.html";
    return;
  }

  const docSnap = await getDoc(doc(db, "usuarios", user.uid));
  if (!docSnap.exists() || !esAdmin(docSnap.data().rol)) {
    window.location.href = "../pages/login.html?error=permisos";
    return;
  }

  const datos = docSnap.data();
  const saludo = document.getElementById("saludo");
  if (saludo) saludo.textContent = `Bienvenido, ${datos.nombre}`;

  renderizarSidebar(datos.rol, "dashboard.html");
  configurarCerrarSesion();
  inicializarDashboard();
});

// ── Listeners en tiempo real ──────────────────────────────────────
function inicializarDashboard() {
  unsubscribePedidos = onSnapshot(collection(db, "pedidos"), (snap) => {
    pedidos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    actualizarDashboard();
  }, () => mostrarError("pedidos"));

  unsubscribeProductos = onSnapshot(collection(db, "productos"), (snap) => {
    productos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    actualizarDashboard();
  }, () => mostrarError("productos"));
}

// ── Actualizar todas las métricas ─────────────────────────────────
function actualizarDashboard() {
  const hoy          = new Date();
  const nHoy         = contarPedidosDelDia(pedidos, hoy);
  const nPendientes  = contarPedidosPendientes(pedidos);
  const bajosDeStock = filtrarStockBajo(productos);

  setText("statPedidosHoy", nHoy);
  setText("statPendientes",  nPendientes);
  setText("statStockBajo",   bajosDeStock.length);

  renderizarAlertasStock(bajosDeStock);
}

function setText(id, valor) {
  const el = document.getElementById(id);
  if (el) el.textContent = valor;
}

// ── Lista de alertas de stock ─────────────────────────────────────
function renderizarAlertasStock(bajos) {
  const lista = document.getElementById("listaAlertasStock");
  if (!lista) return;

  if (bajos.length === 0) {
    lista.innerHTML = `
      <div class="dash-alert-vacio">
        Sin alertas — todos los productos están sobre el umbral mínimo.
      </div>`;
    return;
  }

  // Ordenar de menor a mayor stock (los más críticos primero)
  const ordenados = [...bajos].sort((a, b) => a.stockDisponible - b.stockDisponible);

  lista.innerHTML = "";
  ordenados.forEach(p => {
    const fila = document.createElement("div");
    fila.className = "dash-alert-fila";
    fila.innerHTML = `
      <div class="dash-alert-info">
        <div class="dash-alert-nombre">${p.nombre}</div>
        <div class="dash-alert-ref">${p.referencia}</div>
      </div>
      <div class="dash-alert-stock">
        <span class="dash-alert-actual">${p.stockDisponible}</span>
        <span class="dash-alert-umbral">/ ${p.umbralMinimo} mín.</span>
      </div>
    `;
    lista.appendChild(fila);
  });
}

function mostrarError(origen) {
  const lista = document.getElementById("listaAlertasStock");
  if (lista && origen === "productos") {
    lista.innerHTML = '<div class="empty-state">Error al cargar los datos.</div>';
  }
}
