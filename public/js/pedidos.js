import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import {
  collection, doc, getDoc, query, where, onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";
import { renderizarSidebar, configurarCerrarSesion } from "./sidebar.js";

// ── Lógica de negocio pura (exportada para tests) ─────────────────

export function filtrarPedidosActivos(pedidos) {
  return pedidos.filter(
    p => p.estado === "pendiente" || p.estado === "en_preparacion"
  );
}

export function ordenarPorFechaEntrega(pedidos) {
  // Pedidos sin fecha van al final (9999 siempre ordena después de cualquier fecha real)
  return [...pedidos].sort((a, b) => {
    const fa = a.fechaEntregaSolicitada ?? "9999-99-99";
    const fb = b.fechaEntregaSolicitada ?? "9999-99-99";
    return fa.localeCompare(fb);
  });
}

export function obtenerResumenProductos(productos) {
  if (!Array.isArray(productos)) return [];
  return productos.map(p => ({
    nombre:     p.nombre,
    referencia: p.referencia,
    cantidad:   p.cantidad,
    subtotal:   p.cantidad * p.precioUnitario,
  }));
}

export function puedeAccederPedidos(rol) {
  return rol === "vendedor" || rol === "admin";
}

// ── Estado ────────────────────────────────────────────────────────
let unsubscribe        = null;
let pedidoSeleccionado = null;

// ── Autenticación ─────────────────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "../pages/login.html";
    return;
  }

  const docSnap = await getDoc(doc(db, "usuarios", user.uid));
  if (!docSnap.exists()) {
    window.location.href = "../pages/login.html?error=permisos";
    return;
  }

  const datos = docSnap.data();
  if (!puedeAccederPedidos(datos.rol)) {
    window.location.href = "../pages/login.html?error=permisos";
    return;
  }

  const saludo = document.getElementById("saludo");
  if (saludo) saludo.textContent = `Hola, ${datos.nombre}`;

  renderizarSidebar(datos.rol, "pedidos.html");
  configurarCerrarSesion();
  inicializarEventosModal();
  inicializarPedidos();
});

// ── Pedidos activos en tiempo real ────────────────────────────────
function inicializarPedidos() {
  const listaPedidos = document.getElementById("listaPedidos");
  if (!listaPedidos) return;

  listaPedidos.innerHTML = '<div class="loading">Cargando pedidos...</div>';

  const q = query(
    collection(db, "pedidos"),
    where("estado", "in", ["pendiente", "en_preparacion"])
  );

  unsubscribe = onSnapshot(q, (snapshot) => {
    const activos   = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    const ordenados = ordenarPorFechaEntrega(activos);

    actualizarStats(ordenados);
    renderizarPedidos(ordenados);

    if (pedidoSeleccionado) {
      const actualizado = ordenados.find(p => p.id === pedidoSeleccionado);
      if (actualizado) renderizarDetalle(actualizado);
    }
  }, () => {
    const lista = document.getElementById("listaPedidos");
    if (lista) lista.innerHTML = '<div class="empty-state">Error al cargar los pedidos.</div>';
  });
}

// ── Stats ─────────────────────────────────────────────────────────
function actualizarStats(pedidos) {
  const statActivos     = document.getElementById("statActivos");
  const statPendientes  = document.getElementById("statPendientes");
  const statPreparacion = document.getElementById("statPreparacion");

  if (statActivos)     statActivos.textContent     = pedidos.length;
  if (statPendientes)  statPendientes.textContent  = pedidos.filter(p => p.estado === "pendiente").length;
  if (statPreparacion) statPreparacion.textContent = pedidos.filter(p => p.estado === "en_preparacion").length;
}

// ── Renderizar lista de pedidos ───────────────────────────────────
function renderizarPedidos(pedidos) {
  const listaPedidos = document.getElementById("listaPedidos");
  if (!listaPedidos) return;

  if (pedidos.length === 0) {
    listaPedidos.innerHTML = `
      <div class="empty-state">
        No hay pedidos activos en este momento.
      </div>`;
    return;
  }

  listaPedidos.innerHTML = "";

  pedidos.forEach(pedido => {
    const { texto: estadoTexto, clase: estadoClase } = configEstado(pedido.estado);

    const resumen = (pedido.productos ?? [])
      .map(p => `${p.nombre} ×${p.cantidad}`)
      .join(" · ");

    const total = (pedido.totalPedido ?? 0).toLocaleString("es-CO");

    const card = document.createElement("div");
    card.className = "pedido-vendor-card";
    card.dataset.id = pedido.id;
    card.innerHTML = `
      <div class="pedido-vendor-header">
        <div>
          <div class="pedido-vendor-numero">N° ${pedido.id.slice(0, 8).toUpperCase()}</div>
          <div class="pedido-vendor-distribuidor">${pedido.distribuidorNombre ?? "—"}</div>
        </div>
        <span class="estado-badge ${estadoClase}">${estadoTexto}</span>
      </div>
      <div class="pedido-vendor-body">
        <div class="pedido-vendor-productos">${resumen || "Sin productos"}</div>
        <div class="pedido-vendor-meta">
          <span>📍 ${pedido.direccionEntrega ?? "Sin dirección"}</span>
          <span>📅 Entrega: ${pedido.fechaEntregaSolicitada ?? "—"}</span>
        </div>
      </div>
      <div class="pedido-vendor-footer">
        <span class="pedido-vendor-total">$${total}</span>
        <button class="btn-ver-detalle">Ver detalle →</button>
      </div>
    `;

    card.addEventListener("click", () => abrirDetalle(pedido));
    listaPedidos.appendChild(card);
  });
}

// ── Config de estado (local, sin exportar — historial.js lo exporta) ─
function configEstado(estado) {
  const configs = {
    pendiente:      { texto: "Pendiente",      clase: "estado-pendiente" },
    confirmado:     { texto: "Confirmado",      clase: "estado-confirmado" },
    en_preparacion: { texto: "En preparación",  clase: "estado-preparacion" },
    enviado:        { texto: "Enviado",          clase: "estado-enviado" },
    entregado:      { texto: "Entregado",        clase: "estado-entregado" },
    cancelado:      { texto: "Cancelado",        clase: "estado-cancelado" },
  };
  return configs[estado] ?? { texto: estado, clase: "estado-default" };
}

// ── Modal de detalle ──────────────────────────────────────────────
function abrirDetalle(pedido) {
  pedidoSeleccionado = pedido.id;
  renderizarDetalle(pedido);
  document.getElementById("modalDetalle")?.classList.add("visible");
}

function renderizarDetalle(pedido) {
  const contenido = document.getElementById("contenidoDetalle");
  if (!contenido) return;

  const { texto: estadoTexto, clase: estadoClase } = configEstado(pedido.estado);
  const formaPago = pedido.formaPago === "transferencia" ? "Transferencia" : "Efectivo";

  const productosHTML = (pedido.productos ?? []).map(p => `
    <div class="detalle-producto-fila">
      <div class="detalle-producto-info">
        <div class="detalle-producto-nombre">${p.nombre}</div>
        <div class="detalle-producto-ref">${p.referencia}</div>
      </div>
      <div class="detalle-producto-cant">× ${p.cantidad}</div>
      <div class="detalle-producto-subtotal">
        $${(p.cantidad * p.precioUnitario).toLocaleString("es-CO")}
      </div>
    </div>`).join("");

  const total = (pedido.totalPedido ?? 0).toLocaleString("es-CO");

  contenido.innerHTML = `
    <div class="detalle-header">
      <div class="detalle-numero">Pedido N° ${pedido.id.slice(0, 8).toUpperCase()}</div>
      <span class="estado-badge ${estadoClase}">${estadoTexto}</span>
    </div>

    <div class="detalle-distribuidor-box">
      <div class="detalle-distribuidor-nombre">${pedido.distribuidorNombre ?? "—"}</div>
      <div class="detalle-distribuidor-email">${pedido.distribuidorEmail ?? ""}</div>
    </div>

    <div class="detalle-meta">
      <div class="detalle-meta-item">
        <span class="detalle-meta-label">Entrega solicitada</span>
        <span class="detalle-meta-valor">${pedido.fechaEntregaSolicitada ?? "—"}</span>
      </div>
      <div class="detalle-meta-item">
        <span class="detalle-meta-label">Forma de pago</span>
        <span class="detalle-meta-valor">${formaPago}</span>
      </div>
      <div class="detalle-meta-item detalle-meta-full">
        <span class="detalle-meta-label">Dirección de entrega</span>
        <span class="detalle-meta-valor">${pedido.direccionEntrega ?? "—"}</span>
      </div>
      ${pedido.observaciones ? `
      <div class="detalle-meta-item detalle-meta-full">
        <span class="detalle-meta-label">Observaciones</span>
        <span class="detalle-meta-valor">${pedido.observaciones}</span>
      </div>` : ""}
    </div>

    <div class="detalle-productos">
      <p class="detalle-productos-titulo">Productos del pedido</p>
      ${productosHTML}
      <div class="detalle-total">
        <span>Total</span>
        <span>$${total}</span>
      </div>
    </div>
  `;
}

// ── Eventos del modal ─────────────────────────────────────────────
function inicializarEventosModal() {
  const modalDetalle     = document.getElementById("modalDetalle");
  const btnCerrarDetalle = document.getElementById("btnCerrarDetalle");

  btnCerrarDetalle?.addEventListener("click", () => {
    modalDetalle?.classList.remove("visible");
    pedidoSeleccionado = null;
  });

  modalDetalle?.addEventListener("click", (e) => {
    if (e.target === modalDetalle) {
      modalDetalle.classList.remove("visible");
      pedidoSeleccionado = null;
    }
  });
}
