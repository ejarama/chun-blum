import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import {
  collection, doc, getDoc, query, where, orderBy, onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";
import { renderizarSidebar, configurarCerrarSesion } from "./sidebar.js";

// ── Lógica de negocio pura (exportada para tests) ─────────────────

export function filtrarPedidosDistribuidor(pedidos, distribuidorId) {
  return pedidos.filter(p => p.distribuidorId === distribuidorId);
}

export function obtenerConfigEstado(estado) {
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

export function calcularTotalPedido(productos) {
  if (!Array.isArray(productos) || productos.length === 0) return 0;
  return productos.reduce((total, p) => total + p.cantidad * p.precioUnitario, 0);
}

export function hayPedidos(pedidos) {
  return Array.isArray(pedidos) && pedidos.length > 0;
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
  if (!docSnap.exists() || docSnap.data().rol !== "distribuidor") {
    window.location.href = "../pages/login.html?error=permisos";
    return;
  }

  const usuario = { uid: user.uid, ...docSnap.data() };

  const saludo = document.getElementById("saludo");
  if (saludo) saludo.textContent = `Hola, ${usuario.nombre}`;

  renderizarSidebar(usuario.rol, "historial.html");
  configurarCerrarSesion();
  inicializarEventosModal();
  inicializarHistorial(usuario.uid);
});

// ── Modal: eventos ────────────────────────────────────────────────
function inicializarEventosModal() {
  const modalDetalle    = document.getElementById("modalDetalle");
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

// ── Historial en tiempo real ──────────────────────────────────────
function inicializarHistorial(distribuidorId) {
  const listaHistorial = document.getElementById("listaHistorial");
  if (!listaHistorial) return;

  listaHistorial.innerHTML = '<div class="loading">Cargando pedidos...</div>';

  const q = query(
    collection(db, "pedidos"),
    where("distribuidorId", "==", distribuidorId),
    orderBy("fechaPedido", "desc")
  );

  unsubscribe = onSnapshot(q, (snapshot) => {
    const pedidos = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    renderizarHistorial(pedidos);

    // Actualizar detalle si el modal está abierto
    if (pedidoSeleccionado) {
      const actualizado = pedidos.find(p => p.id === pedidoSeleccionado);
      if (actualizado) renderizarDetalle(actualizado);
    }
  }, () => {
    if (listaHistorial) {
      listaHistorial.innerHTML = '<div class="empty-state">Error al cargar los pedidos.</div>';
    }
  });
}

// ── Renderizar lista de pedidos ───────────────────────────────────
function renderizarHistorial(pedidos) {
  const listaHistorial = document.getElementById("listaHistorial");
  if (!listaHistorial) return;

  if (!hayPedidos(pedidos)) {
    listaHistorial.innerHTML = `
      <div class="historial-empty">
        <div class="historial-empty-icono">📦</div>
        <p class="historial-empty-titulo">Aún no tienes pedidos</p>
        <p class="historial-empty-texto">
          Cuando realices un pedido desde el catálogo, aparecerá aquí con su estado en tiempo real.
        </p>
        <a href="catalogo.html" class="btn-primario" style="display:inline-block;margin-top:4px;">
          Ir al catálogo
        </a>
      </div>`;
    return;
  }

  listaHistorial.innerHTML = "";

  pedidos.forEach(pedido => {
    const { texto: estadoTexto, clase: estadoClase } = obtenerConfigEstado(pedido.estado);

    const fecha = pedido.fechaPedido?.toDate
      ? pedido.fechaPedido.toDate().toLocaleDateString("es-CO", {
          year: "numeric", month: "short", day: "numeric",
        })
      : "—";

    const total = (pedido.totalPedido ?? calcularTotalPedido(pedido.productos))
      .toLocaleString("es-CO");

    const numProductos = pedido.productos?.length ?? 0;

    const fila = document.createElement("div");
    fila.className = "pedido-fila";
    fila.dataset.id = pedido.id;
    fila.innerHTML = `
      <div class="pedido-fila-info">
        <div class="pedido-numero">N° ${pedido.id.slice(0, 8).toUpperCase()}</div>
        <div class="pedido-fecha">${fecha}</div>
        <div class="pedido-productos-resumen">
          ${numProductos} ${numProductos === 1 ? "producto" : "productos"}
        </div>
      </div>
      <div class="pedido-fila-derecha">
        <div class="pedido-total">$${total}</div>
        <span class="estado-badge ${estadoClase}">${estadoTexto}</span>
        <div class="pedido-entrega">Entrega: ${pedido.fechaEntregaSolicitada ?? "—"}</div>
      </div>
      <div class="pedido-fila-accion">›</div>
    `;
    fila.addEventListener("click", () => abrirDetalle(pedido));
    listaHistorial.appendChild(fila);
  });
}

// ── Modal de detalle ──────────────────────────────────────────────
function abrirDetalle(pedido) {
  pedidoSeleccionado = pedido.id;
  renderizarDetalle(pedido);
  document.getElementById("modalDetalle")?.classList.add("visible");
}

function renderizarDetalle(pedido) {
  const contenidoDetalle = document.getElementById("contenidoDetalle");
  if (!contenidoDetalle) return;

  const { texto: estadoTexto, clase: estadoClase } = obtenerConfigEstado(pedido.estado);

  const fecha = pedido.fechaPedido?.toDate
    ? pedido.fechaPedido.toDate().toLocaleDateString("es-CO", {
        year: "numeric", month: "long", day: "numeric",
      })
    : "—";

  const totalCalculado = pedido.totalPedido ?? calcularTotalPedido(pedido.productos);

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

  const formaPago = pedido.formaPago === "transferencia" ? "Transferencia" : "Efectivo";

  contenidoDetalle.innerHTML = `
    <div class="detalle-header">
      <div class="detalle-numero">Pedido N° ${pedido.id.slice(0, 8).toUpperCase()}</div>
      <span class="estado-badge ${estadoClase}">${estadoTexto}</span>
    </div>

    <div class="detalle-meta">
      <div class="detalle-meta-item">
        <span class="detalle-meta-label">Fecha del pedido</span>
        <span class="detalle-meta-valor">${fecha}</span>
      </div>
      <div class="detalle-meta-item">
        <span class="detalle-meta-label">Entrega solicitada</span>
        <span class="detalle-meta-valor">${pedido.fechaEntregaSolicitada ?? "—"}</span>
      </div>
      <div class="detalle-meta-item">
        <span class="detalle-meta-label">Forma de pago</span>
        <span class="detalle-meta-valor">${formaPago}</span>
      </div>
      <div class="detalle-meta-item">
        <span class="detalle-meta-label">Dirección</span>
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
        <span>$${totalCalculado.toLocaleString("es-CO")}</span>
      </div>
    </div>
  `;
}
