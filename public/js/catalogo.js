import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import {
  collection, doc, getDoc, query, where,
  onSnapshot, runTransaction, addDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";
import { renderizarSidebar, configurarCerrarSesion } from "../js/sidebar.js";

// ── Estado ────────────────────────────────────────────────────────
let todosLosProductos = [];
let carrito           = {};
let usuarioActual     = null;
let unsubscribe       = null;

// ── Referencias DOM ───────────────────────────────────────────────
const catalogoProductos   = document.getElementById("catalogoProductos");
const buscador            = document.getElementById("buscador");
const filtroEstado        = document.getElementById("filtroEstado");
const saludo              = document.getElementById("saludo");
const statTotalProductos  = document.getElementById("statTotalProductos");
const statEnProduccion    = document.getElementById("statEnProduccion");
const statTotalUnidades   = document.getElementById("statTotalUnidades");
const carritoContenido    = document.getElementById("carritoContenido");
const carritoFooter       = document.getElementById("carritoFooter");
const carritoContador     = document.getElementById("carritoContador");
const carritoTotal        = document.getElementById("carritoTotal");
const carritoTotalUnidades = document.getElementById("carritoTotalUnidades");
const btnConfirmarPedido  = document.getElementById("btnConfirmarPedido");
const modalConfirmacion   = document.getElementById("modalConfirmacion");
const modalExito          = document.getElementById("modalExito");
const btnCancelarConfirmacion = document.getElementById("btnCancelarConfirmacion");
const btnEnviarPedido     = document.getElementById("btnEnviarPedido");
const btnCerrarExito      = document.getElementById("btnCerrarExito");
const inputFechaEntrega   = document.getElementById("inputFechaEntrega");
const inputDireccion      = document.getElementById("inputDireccion");
const selectFormaPago     = document.getElementById("selectFormaPago");
const inputObservaciones  = document.getElementById("inputObservaciones");
const resumenProductos    = document.getElementById("resumenProductos");
const resumenTotal        = document.getElementById("resumenTotal");
const numeroPedido        = document.getElementById("numeroPedido");
const alertaModalError    = document.getElementById("alertaModalError");
const errorFecha          = document.getElementById("errorFecha");
const errorDireccion      = document.getElementById("errorDireccion");

// ── Autenticación ─────────────────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "../pages/login.html";
    return;
  }

  const docSnap = await getDoc(doc(db, "usuarios", user.uid));
  if (!docSnap.exists() || !["distribuidor"].includes(docSnap.data().rol)) {
    window.location.href = "../pages/login.html?error=permisos";
    return;
  }

  usuarioActual = { uid: user.uid, ...docSnap.data() };
  saludo.textContent = `Hola, ${usuarioActual.nombre}`;

  renderizarSidebar(usuarioActual.rol, "catalogo.html");
  configurarCerrarSesion();
  inicializarCatalogo();
  configurarFechaMinima();
});

// ── Fecha mínima — 2 días desde hoy ──────────────────────────────
function configurarFechaMinima() {
  const hoy   = new Date();
  const minima = new Date(hoy);
  minima.setDate(hoy.getDate() + 2);
  inputFechaEntrega.min = minima.toISOString().split("T")[0];
}

// ── Catálogo en tiempo real ───────────────────────────────────────
function inicializarCatalogo() {
  const q = query(
    collection(db, "productos"),
    where("estado", "in", ["disponible", "en_produccion"])
  );

  unsubscribe = onSnapshot(q, (snapshot) => {
    todosLosProductos = [];
    snapshot.forEach(d => todosLosProductos.push({ id: d.id, ...d.data() }));
    todosLosProductos.sort((a, b) => a.referencia.localeCompare(b.referencia));
    actualizarStats();
    aplicarFiltros();
    actualizarCarrito();
  }, (error) => {
    catalogoProductos.innerHTML = '<div class="empty-state">Error al cargar el catálogo.</div>';
  });
}

// ── Stats ─────────────────────────────────────────────────────────
function actualizarStats() {
  const disponibles  = todosLosProductos.filter(p => p.estado === "disponible");
  const enProduccion = todosLosProductos.filter(p => p.estado === "en_produccion");
  const totalUnidades = disponibles.reduce((s, p) => s + p.stockDisponible, 0);
  statTotalProductos.textContent = todosLosProductos.length;
  statEnProduccion.textContent   = enProduccion.length;
  statTotalUnidades.textContent  = totalUnidades.toLocaleString("es-CO");
}

// ── Filtros ───────────────────────────────────────────────────────
function aplicarFiltros() {
  const texto  = buscador.value.toLowerCase().trim();
  const estado = filtroEstado.value;
  const filtrados = todosLosProductos.filter(p => {
    const coincideTexto  = !texto  || p.nombre.toLowerCase().includes(texto);
    const coincideEstado = !estado || p.estado === estado;
    return coincideTexto && coincideEstado;
  });
  renderizarCatalogo(filtrados);
}

// ── Renderizar catálogo ───────────────────────────────────────────
function renderizarCatalogo(lista) {
  if (lista.length === 0) {
    catalogoProductos.innerHTML = '<div class="empty-state">No se encontraron productos.</div>';
    return;
  }

  catalogoProductos.innerHTML = "";

  lista.forEach(p => {
    const enCarrito    = carrito[p.id];
    const badgeClase   = p.estado === "disponible" ? "stock-disponible" : "stock-produccion";
    const estadoTexto  = p.estado === "disponible" ? "Disponible" : "En producción";
    const icono        = obtenerIcono(p.sabor);
    const enProduccion = p.estado === "en_produccion";

    const card = document.createElement("div");
    card.className = "producto-card";
    card.id = `card-${p.id}`;
    card.innerHTML = `
      <div class="producto-card-icon">${icono}</div>
      <div class="producto-card-info">
        <div class="producto-card-nombre">${p.nombre}</div>
        <div class="producto-card-ref">${p.referencia}</div>
        <div style="margin-top:6px;">
          <span class="stock-badge ${badgeClase}">${estadoTexto}</span>
          ${p.estado === "disponible"
            ? `<span style="font-size:11px;color:#80868b;margin-left:8px;">${p.stockDisponible} unidades</span>`
            : `<span style="font-size:11px;color:#80868b;margin-left:8px;">Próximamente</span>`
          }
        </div>
        ${enProduccion ? "" : `
        <div class="cantidad-control">
          <input
            type="number"
            id="cantidad-${p.id}"
            min="1"
            max="${p.stockDisponible}"
            value="${enCarrito ? enCarrito.cantidad : 1}"
            placeholder="Cant."
          />
          <span id="errorCantidad-${p.id}" class="error-cantidad-msg"></span>
        </div>`}
      </div>
      <div style="text-align:right;flex-shrink:0;">
        <div class="producto-card-precio">$${p.precioUnitario.toLocaleString("es-CO")}</div>
        <div class="producto-card-stock">por unidad</div>
        ${enProduccion ? "" : `
        <button
          class="btn-agregar-carrito"
          style="margin-top:8px;"
          onclick="agregarAlCarrito('${p.id}')"
        >
          ${enCarrito ? "Actualizar" : "Agregar"}
        </button>`}
      </div>
    `;
    catalogoProductos.appendChild(card);
  });
}

// ── Agregar al carrito ────────────────────────────────────────────
window.agregarAlCarrito = function(productoId) {
  const producto  = todosLosProductos.find(p => p.id === productoId);
  const inputCant = document.getElementById(`cantidad-${productoId}`);
  const errorMsg  = document.getElementById(`errorCantidad-${productoId}`);
  const cantidad  = parseInt(inputCant.value);

  inputCant.classList.remove("input-error");
  errorMsg.classList.remove("visible");

  if (!cantidad || cantidad <= 0) {
    inputCant.classList.add("input-error");
    errorMsg.textContent = "Ingresa una cantidad válida.";
    errorMsg.classList.add("visible");
    return;
  }

  if (cantidad > producto.stockDisponible) {
    inputCant.classList.add("input-error");
    errorMsg.textContent = `Stock insuficiente — solo hay ${producto.stockDisponible} unidades.`;
    errorMsg.classList.add("visible");
    return;
  }

  carrito[productoId] = {
    productoId,
    nombre:        producto.nombre,
    referencia:    producto.referencia,
    cantidad,
    precioUnitario: producto.precioUnitario,
    subtotal:      cantidad * producto.precioUnitario,
  };

  actualizarCarrito();
  aplicarFiltros();
};

// ── Eliminar del carrito ──────────────────────────────────────────
window.eliminarDelCarrito = function(productoId) {
  delete carrito[productoId];
  actualizarCarrito();
  aplicarFiltros();
};

// ── Cambiar cantidad en carrito ───────────────────────────────────
window.cambiarCantidadCarrito = function(productoId, delta) {
  const item     = carrito[productoId];
  const producto = todosLosProductos.find(p => p.id === productoId);
  if (!item || !producto) return;

  const stockDisponible = producto.stockDisponible + item.cantidad;
  const nuevaCantidad   = item.cantidad + delta;

  if (nuevaCantidad <= 0 || nuevaCantidad > stockDisponible) return;

  carrito[productoId].cantidad = nuevaCantidad;
  carrito[productoId].subtotal = nuevaCantidad * item.precioUnitario;

  actualizarCarrito();
};

// ── Vaciar carrito ────────────────────────────────────────────────
window.vaciarCarrito = function() {
  carrito = {};
  actualizarCarrito();
  aplicarFiltros();
};

// ── Actualizar vista del carrito ──────────────────────────────────
function actualizarCarrito() {
  const items = Object.values(carrito);

  if (items.length === 0) {
    carritoContenido.innerHTML = `
      <div class="carrito-vacio">
        Agrega productos desde el catálogo para armar tu pedido.
      </div>`;
    carritoFooter.style.display   = "none";
    carritoContador.style.display = "none";
    return;
  }

  const totalUnidades = items.reduce((s, i) => s + i.cantidad, 0);
  const totalPesos    = items.reduce((s, i) => s + i.subtotal, 0);

  carritoContenido.innerHTML = "";

  // Botón vaciar carrito
  const btnVaciar = document.createElement("div");
  btnVaciar.style.cssText = "text-align:right;margin-bottom:8px;";
  btnVaciar.innerHTML = `<button class="btn-vaciar-carrito" onclick="vaciarCarrito()">Vaciar carrito</button>`;
  carritoContenido.appendChild(btnVaciar);

  items.forEach(item => {
    const producto = todosLosProductos.find(p => p.id === item.productoId);
    const stockMax = producto ? producto.stockDisponible + item.cantidad : item.cantidad;

    const div = document.createElement("div");
    div.className = "carrito-item";
    div.innerHTML = `
      <div class="carrito-item-info">
        <div class="carrito-item-nombre">${item.nombre}</div>
        <div class="carrito-item-ref">${item.referencia}</div>
        
        <div class="carrito-item-subtotal">
          $${item.subtotal.toLocaleString("es-CO")}
        </div>
      </div>
      <div class="carrito-item-acciones">
        <div class="cantidad-carrito">
          <button
            class="btn-cantidad"
            onclick="cambiarCantidadCarrito('${item.productoId}', -1)"
            ${item.cantidad <= 1 ? "disabled" : ""}
          >−</button>
          <span class="cantidad-carrito-valor">${item.cantidad}</span>
          <button
            class="btn-cantidad"
            onclick="cambiarCantidadCarrito('${item.productoId}', 1)"
            ${item.cantidad >= producto.stockDisponible ? "disabled" : ""}
          >+</button>
          <button
            class="btn-cantidad btn-trash"
            onclick="eliminarDelCarrito('${item.productoId}')"
            title="Quitar producto"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14H6L5 6"/>
              <path d="M10 11v6M14 11v6"/>
              <path d="M9 6V4h6v2"/>
            </svg>
          </button>
        </div>
      </div>
    `;
    carritoContenido.appendChild(div);
  });

  carritoTotal.textContent         = `$${totalPesos.toLocaleString("es-CO")}`;
  carritoTotalUnidades.textContent  = `${totalUnidades} unidades`;
  carritoFooter.style.display       = "block";
  carritoContador.style.display     = "inline-block";
  carritoContador.textContent       = `${items.length} ${items.length === 1 ? "item" : "items"}`;
}

// ── Abrir modal de confirmación ───────────────────────────────────
btnConfirmarPedido.addEventListener("click", () => {
  const items = Object.values(carrito);
  if (items.length === 0) return;

  resumenProductos.innerHTML = "";
  items.forEach(item => {
    const div = document.createElement("div");
    div.className = "resumen-item";
    div.innerHTML = `
      <span class="resumen-item-nombre">${item.nombre} × ${item.cantidad}</span>
      <span class="resumen-item-valor">$${item.subtotal.toLocaleString("es-CO")}</span>
    `;
    resumenProductos.appendChild(div);
  });

  const total = items.reduce((s, i) => s + i.subtotal, 0);
  resumenTotal.textContent = `$${total.toLocaleString("es-CO")}`;

  alertaModalError.classList.remove("visible");
  inputFechaEntrega.classList.remove("input-error");
  inputDireccion.classList.remove("input-error");
  errorFecha.classList.remove("visible");
  errorDireccion.classList.remove("visible");

  modalConfirmacion.classList.add("visible");
});

btnCancelarConfirmacion.addEventListener("click", () => {
  modalConfirmacion.classList.remove("visible");
});

// ── Validar formulario de confirmación ────────────────────────────
function validarConfirmacion() {
  let valido = true;
  const hoy    = new Date();
  const minima = new Date(hoy);
  minima.setDate(hoy.getDate() + 2);
  minima.setHours(0, 0, 0, 0);

  const fechaSeleccionada = new Date(inputFechaEntrega.value + "T00:00:00");

  if (!inputFechaEntrega.value || fechaSeleccionada < minima) {
    inputFechaEntrega.classList.add("input-error");
    errorFecha.classList.add("visible");
    valido = false;
  }

  if (!inputDireccion.value.trim()) {
    inputDireccion.classList.add("input-error");
    errorDireccion.classList.add("visible");
    valido = false;
  }

  return valido;
}

// ── Enviar pedido ─────────────────────────────────────────────────
btnEnviarPedido.addEventListener("click", async function() {
  alertaModalError.classList.remove("visible");
  inputFechaEntrega.classList.remove("input-error");
  inputDireccion.classList.remove("input-error");
  errorFecha.classList.remove("visible");
  errorDireccion.classList.remove("visible");

  if (!validarConfirmacion()) return;

  btnEnviarPedido.disabled    = true;
  btnEnviarPedido.textContent = "Enviando...";

  const items = Object.values(carrito);
  const total = items.reduce((s, i) => s + i.subtotal, 0);

  try {
    // ── Transacción atómica — primero todas las lecturas, luego escrituras ──
  await runTransaction(db, async (transaction) => {
    // PASO 1: todas las lecturas primero
    const snaps = {};
    for (const item of items) {
      const ref  = doc(db, "productos", item.productoId);
      snaps[item.productoId] = await transaction.get(ref);
    }

    // PASO 2: validar stock
    for (const item of items) {
      const snap = snaps[item.productoId];
      if (!snap.exists()) {
        throw new Error(`El producto ${item.nombre} no existe.`);
      }
      const stockActual = snap.data().stockDisponible;
      if (stockActual < item.cantidad) {
        throw new Error(`Stock insuficiente para ${item.nombre}. Solo hay ${stockActual} unidades.`);
      }
    }

    // PASO 3: todas las escrituras al final
    for (const item of items) {
      const ref        = doc(db, "productos", item.productoId);
      const snap       = snaps[item.productoId];
      const nuevoStock = snap.data().stockDisponible - item.cantidad;
      transaction.update(ref, {
        stockDisponible:     nuevoStock,
        estado:              nuevoStock > 0 ? "disponible" : "agotado",
        ultimaActualizacion: new Date().toISOString(),
      });
    }
  });

    // ── Guardar pedido en Firestore ───────────────────────────────
    const docRef = await addDoc(collection(db, "pedidos"), {
      distribuidorId:        usuarioActual.uid,
      distribuidorNombre:    usuarioActual.nombre,
      distribuidorEmail:     usuarioActual.email,
      productos:             items,
      totalPedido:           total,
      estado:                "pendiente",
      formaPago:             selectFormaPago.value,
      fechaEntregaSolicitada: inputFechaEntrega.value,
      direccionEntrega:      inputDireccion.value.trim(),
      observaciones:         inputObservaciones.value.trim(),
      fechaPedido:           serverTimestamp(),
    });

    // ── Limpiar y mostrar éxito ───────────────────────────────────
    carrito = {};
    actualizarCarrito();
    modalConfirmacion.classList.remove("visible");
    numeroPedido.textContent = docRef.id.slice(0, 8).toUpperCase();
    modalExito.classList.add("visible");

    inputFechaEntrega.value    = "";
    inputDireccion.value       = "";
    inputObservaciones.value   = "";
    selectFormaPago.value      = "efectivo";

  } catch (error) {
    alertaModalError.textContent = error.message;
    alertaModalError.classList.add("visible");
  } finally {
    btnEnviarPedido.disabled    = false;
    btnEnviarPedido.textContent = "Enviar pedido";
  }
});

// ── Cerrar modal de éxito ─────────────────────────────────────────
btnCerrarExito.addEventListener("click", () => {
  modalExito.classList.remove("visible");
  aplicarFiltros();
});

// ── Listeners de filtros ──────────────────────────────────────────
buscador.addEventListener("input", aplicarFiltros);
filtroEstado.addEventListener("change", aplicarFiltros);

// ── Iconos por sabor ──────────────────────────────────────────────
function obtenerIcono(sabor) {
  const iconos = {
    "Milo":                    "🍫",
    "Queso Arequipe":          "🧀",
    "Queso Bocadillo":         "🧀",
    "Oreo":                    "🍪",
    "Café Arequipe":           "☕",
    "Breva Arequipe":          "🍯",
    "Coco":                    "🥥",
    "Queso":                   "🧀",
    "Mora":                    "🫐",
    "Vainilla":                "🍦",
    "Vainilla con Arequipe":   "🍦",
    "Vainilla con Bocadillo":  "🍦",
    "Maní Arequipe":           "🥜",
    "Mora Refrescante":        "🧊",
    "Maracumango Refrescante": "🧊",
  };
  return iconos[sabor] || "🍦";
}