import { auth, db } from "./firebase-config.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

// ── Definición completa del menú ──────────────────────────────────
// Cada ítem define qué roles pueden verlo
const MENU_ITEMS = [
  {
    label: "Inicio",
    href:  "dashboard.html",
    roles: ["admin"],
  },
  {
    label: "Usuarios",
    href:  "usuarios.html",
    roles: ["admin"],
  },
  {
    label: "Inventario",
    href:  "inventario.html",
    roles: ["admin", "operaria"],
  },
  {
    label: "Registrar lote",
    href:  "produccion.html",
    roles: ["admin", "operaria"],
  },
  {
    label: "Pedidos",
    href:  "pedidos.html",
    roles: ["admin", "vendedor"],
  },
  {
    label: "Mis pedidos",
    href:  "catalogo.html",
    roles: ["distribuidor"],
  },
];

// ── Etiquetas del panel según rol ─────────────────────────────────
const PANEL_LABELS = {
  admin:        "Panel de administración",
  operaria:     "Panel de producción",
  vendedor:     "Panel de ventas",
  distribuidor: "Panel de distribución",
};

// ── Renderizar sidebar ────────────────────────────────────────────
export function renderizarSidebar(rol, paginaActual) {
  const nav  = document.querySelector(".sidebar-nav");
  const logo = document.querySelector(".sidebar-logo p");

  console.log("Renderizando sidebar para rol:", rol);
  if (!nav || !logo) return;

  logo.textContent = PANEL_LABELS[rol] || "Panel";

  const itemsFiltrados = MENU_ITEMS.filter(item => item.roles.includes(rol));
  console.log("Items a mostrar en el menú:", itemsFiltrados);

  nav.innerHTML = itemsFiltrados
    .map(item => {
      const esActivo = item.href === paginaActual;
      return `<a href="${item.href}" ${esActivo ? 'class="activo"' : ""}>${item.label}</a>`;
    })
    .join("");
}

// ── Configurar botones de cerrar sesión ───────────────────────────
export function configurarCerrarSesion() {
  const btnMovil   = document.getElementById("btnCerrarSesion");
  const btnSidebar = document.getElementById("btnCerrarSesionSidebar");

  const cerrar = async () => {
    await signOut(auth);
    window.location.href = "../pages/login.html";
  };

  btnMovil?.addEventListener("click", cerrar);
  btnSidebar?.addEventListener("click", cerrar);
}