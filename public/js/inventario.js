import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import {
  collection, doc, getDoc, onSnapshot, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

// ── Verificar que solo el admin accede ────────────────────────────
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

  inicializarInventario();
});

// ── Estado ────────────────────────────────────────────────────────
let todosLosProductos = [];
let unsubscribe = null;

// ── Referencias DOM ───────────────────────────────────────────────
const listaProductos  = document.getElementById("listaProductos");
const buscador        = document.getElementById("buscador");
const filtroEstado    = document.getElementById("filtroEstado");
const filtroStock     = document.getElementById("filtroStock");
const statDisponible  = document.getElementById("statDisponible");
const statAgotado     = document.getElementById("statAgotado");
const statProduccion  = document.getElementById("statProduccion");

// ── Cerrar sesión ─────────────────────────────────────────────────
document.getElementById("btnCerrarSesion")?.addEventListener("click", async () => {
  if (unsubscribe) unsubscribe();
  await signOut(auth);
  window.location.href = "../pages/login.html";
});

document.getElementById("btnCerrarSesionSidebar")?.addEventListener("click", async () => {
  if (unsubscribe) unsubscribe();
  await signOut(auth);
  window.location.href = "../pages/login.html";
});

// ── Inicializar inventario con tiempo real ────────────────────────
function inicializarInventario() {
  const q = query(collection(db, "productos"), orderBy("referencia"));

  unsubscribe = onSnapshot(q, (snapshot) => {
    todosLosProductos = [];

    snapshot.forEach((docSnap) => {
      todosLosProductos.push({ id: docSnap.id, ...docSnap.data() });
    });

    actualizarStats();
    aplicarFiltros();
  }, (error) => {
    listaProductos.innerHTML = '<div class="empty-state">Error al cargar el inventario.</div>';
  });
}

// ── Actualizar tarjetas de resumen ────────────────────────────────
function actualizarStats() {
  const disponibles  = todosLosProductos.filter(p => p.estado === "disponible").length;
  const agotados     = todosLosProductos.filter(p => p.estado === "agotado").length;
  const enProduccion = todosLosProductos.filter(p => p.estado === "en_produccion").length;

  statDisponible.textContent = disponibles;
  statAgotado.textContent    = agotados;
  statProduccion.textContent = enProduccion;
}

// ── Aplicar filtros ───────────────────────────────────────────────
function aplicarFiltros() {
  const texto  = buscador.value.toLowerCase().trim();
  const estado = filtroEstado.value;
  const stock  = filtroStock.value;

  const filtrados = todosLosProductos.filter(p => {
    const coincideTexto  = !texto  ||
      p.nombre.toLowerCase().includes(texto) ||
      p.referencia.toLowerCase().includes(texto);

    const coincideEstado = !estado || p.estado === estado;

    const coincideStock  = !stock  ||
      (stock === "bajo"   && p.stockDisponible < p.umbralMinimo) ||
      (stock === "normal" && p.stockDisponible >= p.umbralMinimo);

    return coincideTexto && coincideEstado && coincideStock;
  });

  renderizarProductos(filtrados);
}

// ── Renderizar lista de productos ─────────────────────────────────
function renderizarProductos(lista) {
  if (lista.length === 0) {
    listaProductos.innerHTML = '<div class="empty-state">No se encontraron productos.</div>';
    return;
  }

  listaProductos.innerHTML = "";

  lista.forEach(p => {
    const stockBajo  = p.stockDisponible < p.umbralMinimo;
    const fecha      = p.ultimaActualizacion
      ? new Date(p.ultimaActualizacion).toLocaleString("es-CO", {
          day: "2-digit", month: "2-digit", year: "numeric",
          hour: "2-digit", minute: "2-digit"
        })
      : "Sin registro";

    const badgeClase = p.estado === "disponible"
      ? "stock-disponible"
      : p.estado === "agotado"
      ? "stock-agotado"
      : "stock-produccion";

    const estadoTexto = p.estado === "en_produccion" ? "En producción" : 
      p.estado.charAt(0).toUpperCase() + p.estado.slice(1);

    const row = document.createElement("div");
    row.className = `producto-row${stockBajo ? " stock-bajo" : ""}`;
    row.innerHTML = `
      <div class="producto-row-info">
        <div class="producto-row-nombre">
          ${p.nombre}
          ${stockBajo ? '<span class="alerta-stock-icon" title="Stock bajo">⚠️</span>' : ""}
        </div>
        <div class="producto-row-ref">${p.referencia} · $${p.precioUnitario.toLocaleString("es-CO")}</div>
      </div>
      <div class="producto-row-stock">
        <div class="stock-numero ${stockBajo ? "bajo" : ""}">${p.stockDisponible}</div>
        <div class="stock-unidad">unidades</div>
      </div>
      <div class="producto-row-estado">
        <span class="stock-badge ${badgeClase}">${estadoTexto}</span>
      </div>
      <div class="ultima-actualizacion">${fecha}</div>
    `;
    listaProductos.appendChild(row);
  });
}

// ── Listeners de filtros ──────────────────────────────────────────
buscador.addEventListener("input", aplicarFiltros);
filtroEstado.addEventListener("change", aplicarFiltros);
filtroStock.addEventListener("change", aplicarFiltros);