import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import {
  collection, doc, getDoc, query, where, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";
import { renderizarSidebar, configurarCerrarSesion } from "../js/sidebar.js";

// ── Estado ────────────────────────────────────────────────────────
let todosLosProductos = [];
let unsubscribe = null;

// ── Referencias DOM ───────────────────────────────────────────────
const catalogoProductos  = document.getElementById("catalogoProductos");
const buscador           = document.getElementById("buscador");
const filtroEstado       = document.getElementById("filtroEstado");
const saludo             = document.getElementById("saludo");
const statEnProduccion   = document.getElementById("statEnProduccion");
const statTotalUnidades  = document.getElementById("statTotalUnidades");
const statTotalProductos = document.getElementById("statTotalProductos");

// ── Verificar autenticación y rol ─────────────────────────────────
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

  const datos = docSnap.data();
  saludo.textContent = `Hola, ${datos.nombre}`;

  renderizarSidebar(datos.rol, "catalogo.html");
  configurarCerrarSesion();
  inicializarCatalogo();
});

// ── Inicializar catálogo en tiempo real ───────────────────────────
function inicializarCatalogo() {
  const q = query(
    collection(db, "productos"),
    where("estado", "in", ["disponible", "en_produccion"])
  );

  unsubscribe = onSnapshot(q, (snapshot) => {
    todosLosProductos = [];

    snapshot.forEach((docSnap) => {
      todosLosProductos.push({ id: docSnap.id, ...docSnap.data() });
    });

    // Ordenar por referencia en el cliente
    todosLosProductos.sort((a, b) => a.referencia.localeCompare(b.referencia));

    actualizarStats();
    aplicarFiltros();

  }, (error) => {
    console.error("Error Firestore:", error);
    catalogoProductos.innerHTML = '<div class="empty-state">Error al cargar el catálogo.</div>';
  });
}

// ── Actualizar estadísticas ───────────────────────────────────────
function actualizarStats() {
  const disponibles   = todosLosProductos.filter(p => p.estado === "disponible");
  const enProduccion  = todosLosProductos.filter(p => p.estado === "en_produccion");
  const totalUnidades = disponibles.reduce((sum, p) => sum + p.stockDisponible, 0);

  statTotalProductos.textContent  = todosLosProductos.length;
  statEnProduccion.textContent    = enProduccion.length;
  statTotalUnidades.textContent   = totalUnidades.toLocaleString("es-CO");
}

// ── Aplicar filtros ───────────────────────────────────────────────
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
    const badgeClase = p.estado === "disponible" ? "stock-disponible" : "stock-produccion";
    const estadoTexto = p.estado === "disponible" ? "Disponible" : "En producción";
    const icono = obtenerIcono(p.sabor);

    const card = document.createElement("div");
    card.className = "producto-card";
    card.innerHTML = `
      <div class="producto-card-icon">${icono}</div>
      <div class="producto-card-info">
        <div class="producto-card-nombre">${p.nombre}</div>
        <div class="producto-card-ref">${p.referencia}</div>
        <div style="margin-top: 6px;">
          <span class="stock-badge ${badgeClase}">${estadoTexto}</span>
          ${p.estado === "disponible"
            ? `<span style="font-size:11px;color:#80868b;margin-left:8px;">${p.stockDisponible} unidades</span>`
            : `<span style="font-size:11px;color:#80868b;margin-left:8px;">Próximamente</span>`
          }
        </div>
      </div>
      <div style="text-align:right;flex-shrink:0;">
        <div class="producto-card-precio">$${p.precioUnitario.toLocaleString("es-CO")}</div>
        <div class="producto-card-stock">por unidad</div>
      </div>
    `;
    catalogoProductos.appendChild(card);
  });
}

// ── Icono por sabor ───────────────────────────────────────────────
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

// ── Listeners de filtros ──────────────────────────────────────────
buscador.addEventListener("input", aplicarFiltros);
filtroEstado.addEventListener("change", aplicarFiltros);