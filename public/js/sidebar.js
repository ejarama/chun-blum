import { auth, db } from "./firebase-config.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

// ── Definición completa del menú ──────────────────────────────────
const MENU_ITEMS = [
  { label: "Inicio",          href: "dashboard.html",  roles: ["admin"] },
  { label: "Usuarios",        href: "usuarios.html",   roles: ["admin"] },
  { label: "Inventario",      href: "inventario.html", roles: ["admin", "operaria"] },
  { label: "Producción",      href: "produccion.html", roles: ["admin", "operaria"] },
  { label: "Pedidos",         href: "pedidos.html",    roles: ["admin", "vendedor"] },
  { label: "Catálogo",        href: "catalogo.html",   roles: ["distribuidor"] },
  { label: "Mis pedidos",     href: "historial.html",  roles: ["distribuidor"] },
];

const PANEL_LABELS = {
  admin:        "Panel de administración",
  operaria:     "Panel de producción",
  vendedor:     "Panel de ventas",
  distribuidor: "Panel de distribución",
};

// ── Renderizar sidebar escritorio ─────────────────────────────────
export function renderizarSidebar(rol, paginaActual) {
  const nav  = document.querySelector(".sidebar-nav");
  const logo = document.querySelector(".sidebar-logo p");
  if (!nav || !logo) return;

  logo.textContent = PANEL_LABELS[rol] || "Panel";

  const items = MENU_ITEMS.filter(item => item.roles.includes(rol));
  nav.innerHTML = items
    .map(item => `<a href="${item.href}" ${item.href === paginaActual ? 'class="activo"' : ""}>${item.label}</a>`)
    .join("");

  // Generar también el menú móvil
  renderizarMenuMobile(rol, paginaActual);
}

// ── Renderizar menú móvil ─────────────────────────────────────────
function renderizarMenuMobile(rol, paginaActual) {
  // Eliminar menú anterior si existe
  const menuAnterior = document.getElementById("menuMobile");
  if (menuAnterior) menuAnterior.remove();

  const items = MENU_ITEMS.filter(item => item.roles.includes(rol));
  const label = PANEL_LABELS[rol] || "Panel";

  const menu = document.createElement("div");
  menu.className = "menu-mobile";
  menu.id = "menuMobile";
  menu.innerHTML = `
    <div class="menu-mobile-overlay" id="menuOverlay"></div>
    <div class="menu-mobile-panel">
      <div class="menu-mobile-header">
        <div>
          <h2>Helados Chun Blum</h2>
          <p>${label}</p>
        </div>
        <button class="btn-cerrar-menu" id="btnCerrarMenu">✕</button>
      </div>
      <nav class="menu-mobile-nav">
        ${items.map(item => `
          <a href="${item.href}" ${item.href === paginaActual ? 'class="activo"' : ""}>
            ${item.label}
          </a>`).join("")}
      </nav>
      <div class="menu-mobile-footer">
        <button id="btnCerrarSesionMenu">Cerrar sesión</button>
      </div>
    </div>
  `;

  document.body.appendChild(menu);

  // Eventos del menú móvil
  document.getElementById("btnCerrarMenu")
    ?.addEventListener("click", () => menu.classList.remove("visible"));

  document.getElementById("menuOverlay")
    ?.addEventListener("click", () => menu.classList.remove("visible"));

  document.getElementById("btnCerrarSesionMenu")
    ?.addEventListener("click", async () => {
      await signOut(auth);
      window.location.href = "../pages/login.html";
    });
}

// ── Configurar botones de cerrar sesión y hamburguesa ─────────────
export function configurarCerrarSesion() {
  const btnMovil   = document.getElementById("btnCerrarSesion");
  const btnSidebar = document.getElementById("btnCerrarSesionSidebar");
  const btnMenu    = document.getElementById("btnMenu");

  const cerrar = async () => {
    await signOut(auth);
    window.location.href = "../pages/login.html";
  };

  btnMovil?.addEventListener("click", cerrar);
  btnSidebar?.addEventListener("click", cerrar);

  // Abrir menú hamburguesa
  btnMenu?.addEventListener("click", () => {
    document.getElementById("menuMobile")?.classList.add("visible");
  });
}