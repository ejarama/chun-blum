import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import {
  collection, doc, getDoc, query, orderBy,
  onSnapshot, addDoc, updateDoc,
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";
import { renderizarSidebar, configurarCerrarSesion } from "./sidebar.js";

// ── Lógica de negocio pura (exportada para tests) ─────────────────

export function validarReferencia(ref) {
  if (!ref || typeof ref !== "string") {
    return { valido: false, error: "La referencia es requerida." };
  }
  if (!/^CB-\d{3}$/.test(ref.trim())) {
    return { valido: false, error: "Formato inválido. Usa CB-XXX (ej: CB-001)." };
  }
  return { valido: true, error: null };
}

export function validarPrecio(precio) {
  if (precio === "" || precio === null || precio === undefined) {
    return { valido: false, error: "El precio es requerido." };
  }
  // Number() valida el string completo; parseFloat("2.000$") daría 2 (falso positivo)
  const num = Number(precio);
  if (isNaN(num) || num <= 0) {
    return { valido: false, error: "El precio debe ser mayor a cero." };
  }
  return { valido: true, error: null };
}

export function puedeEditarProducto(rol) {
  return rol === "admin";
}

export function puedePrecargarsProducto(rol) {
  return rol === "admin" || rol === "operaria";
}

// ── Estado ────────────────────────────────────────────────────────
let todosLosProductos  = [];
let unsubscribe        = null;
let rolActual          = null;
let modoModal          = "crear";
let productoEditandoId = null;

// ── Autenticación ─────────────────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "../pages/login.html";
    return;
  }

  const docSnap = await getDoc(doc(db, "usuarios", user.uid));
  if (!docSnap.exists() || !["admin", "operaria"].includes(docSnap.data().rol)) {
    window.location.href = "../pages/login.html?error=permisos";
    return;
  }

  rolActual = docSnap.data().rol;
  renderizarSidebar(rolActual, "inventario.html");
  configurarCerrarSesion();
  inicializarInventario();
});

// ── Inicializar página ────────────────────────────────────────────
function inicializarInventario() {
  const btnNuevo = document.getElementById("btnNuevoProducto");
  if (btnNuevo) {
    btnNuevo.style.display = puedeEditarProducto(rolActual) ? "" : "none";
    btnNuevo.addEventListener("click", () => abrirModalCrear());
  }

  document.getElementById("buscador")?.addEventListener("input", aplicarFiltros);
  document.getElementById("filtroEstado")?.addEventListener("change", aplicarFiltros);
  document.getElementById("filtroStock")?.addEventListener("change", aplicarFiltros);

  document.getElementById("btnCancelarProducto")
    ?.addEventListener("click", cerrarModal);

  document.getElementById("modalProducto")
    ?.addEventListener("click", (e) => {
      if (e.target === document.getElementById("modalProducto")) cerrarModal();
    });

  document.getElementById("btnGuardarProducto")
    ?.addEventListener("click", guardarProducto);

  const q = query(collection(db, "productos"), orderBy("referencia"));
  unsubscribe = onSnapshot(q, (snapshot) => {
    todosLosProductos = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    actualizarStats();
    aplicarFiltros();
  }, () => {
    const lista = document.getElementById("listaProductos");
    if (lista) lista.innerHTML = '<div class="empty-state">Error al cargar el inventario.</div>';
  });
}

// ── Stats ─────────────────────────────────────────────────────────
function actualizarStats() {
  setText("statDisponible", todosLosProductos.filter(p => p.estado === "disponible").length);
  setText("statAgotado",    todosLosProductos.filter(p => p.estado === "agotado").length);
  setText("statProduccion", todosLosProductos.filter(p => p.estado === "en_produccion").length);
}

function setText(id, valor) {
  const el = document.getElementById(id);
  if (el) el.textContent = valor;
}

// ── Filtros ───────────────────────────────────────────────────────
function aplicarFiltros() {
  const texto  = document.getElementById("buscador")?.value.toLowerCase().trim() ?? "";
  const estado = document.getElementById("filtroEstado")?.value ?? "";
  const stock  = document.getElementById("filtroStock")?.value ?? "";

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
  const listaEl = document.getElementById("listaProductos");
  if (!listaEl) return;

  if (lista.length === 0) {
    listaEl.innerHTML = '<div class="empty-state">No se encontraron productos.</div>';
    return;
  }

  listaEl.innerHTML = "";
  const esAdmin         = puedeEditarProducto(rolActual);
  const puedeProduccion = puedePrecargarsProducto(rolActual);

  lista.forEach(p => {
    const stockBajo   = p.stockDisponible < p.umbralMinimo;
    const badgeClase  = p.estado === "disponible" ? "stock-disponible"
      : p.estado === "agotado" ? "stock-agotado"
      : "stock-produccion";
    const estadoTexto = p.estado === "en_produccion" ? "En producción"
      : p.estado.charAt(0).toUpperCase() + p.estado.slice(1);
    const fecha = p.ultimaActualizacion
      ? new Date(p.ultimaActualizacion).toLocaleString("es-CO", {
          day: "2-digit", month: "2-digit", year: "numeric",
          hour: "2-digit", minute: "2-digit",
        })
      : "Sin registro";

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
      <div class="producto-row-acciones">
        ${puedeProduccion ? `
          <a href="produccion.html?productoId=${p.id}"
             class="btn-accion-produccion"
             title="Registrar lote para ${p.nombre}">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"
                 viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="16"/>
              <line x1="8" y1="12" x2="16" y2="12"/>
            </svg>
          </a>
        ` : ""}
        ${esAdmin ? `
          <button class="btn-secundario btn-sm btn-editar-producto"
                  data-id="${p.id}">Editar</button>
        ` : ""}
      </div>
    `;

    row.querySelector(".btn-editar-producto")
      ?.addEventListener("click", () => abrirModalEditar(p));

    listaEl.appendChild(row);
  });
}

// ── Modal: Crear ──────────────────────────────────────────────────
function abrirModalCrear() {
  modoModal = "crear";
  productoEditandoId = null;
  setText("modalProductoTitulo", "Nuevo producto");
  limpiarModal();
  ajustarCamposSegunModo();
  document.getElementById("modalProducto")?.classList.add("visible");
}

// ── Modal: Editar ─────────────────────────────────────────────────
function abrirModalEditar(p) {
  modoModal = "editar";
  productoEditandoId = p.id;
  setText("modalProductoTitulo", "Editar producto");
  limpiarModal();

  setVal("modalNombre",  p.nombre);
  setVal("modalSabor",   p.sabor ?? "");
  setVal("modalPrecio",  p.precioUnitario);
  setVal("modalUmbral",  p.umbralMinimo);

  const refDisplay = document.getElementById("modalReferenciaDisplay");
  if (refDisplay) refDisplay.textContent = p.referencia;

  const selectEstado = document.getElementById("modalEstado");
  if (selectEstado) selectEstado.value = p.estado;

  ajustarCamposSegunModo();
  document.getElementById("modalProducto")?.classList.add("visible");
}

function ajustarCamposSegunModo() {
  const esCrear = modoModal === "crear";
  mostrar("grupoReferenciaInput",   esCrear);
  mostrar("grupoReferenciaDisplay", !esCrear);
  mostrar("grupoEstado",            !esCrear);
  mostrar("grupoPresentacion",      esCrear);
}

function mostrar(id, visible) {
  const el = document.getElementById(id);
  if (el) el.style.display = visible ? "" : "none";
}

function cerrarModal() {
  document.getElementById("modalProducto")?.classList.remove("visible");
  productoEditandoId = null;
}

function limpiarModal() {
  ["modalNombre", "modalSabor", "modalReferencia", "modalPrecio", "modalUmbral"]
    .forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.value = ""; el.classList.remove("input-error"); }
    });
  ["errorNombreP", "errorSabor", "errorReferencia", "errorPrecio", "errorUmbral"]
    .forEach(id => document.getElementById(id)?.classList.remove("visible"));
  const alerta = document.getElementById("alertaModalProducto");
  if (alerta) { alerta.textContent = ""; alerta.classList.remove("visible"); }
}

function setVal(id, valor) {
  const el = document.getElementById(id);
  if (el) el.value = valor ?? "";
}

// ── Validar modal ─────────────────────────────────────────────────
function validarModal() {
  let valido = true;

  const nombre = document.getElementById("modalNombre")?.value.trim() ?? "";
  if (!nombre) { marcarError("modalNombre", "errorNombreP"); valido = false; }

  const sabor = document.getElementById("modalSabor")?.value.trim() ?? "";
  if (!sabor)  { marcarError("modalSabor", "errorSabor"); valido = false; }

  if (modoModal === "crear") {
    const ref = document.getElementById("modalReferencia")?.value.trim() ?? "";
    const rRef = validarReferencia(ref);
    if (!rRef.valido) { marcarError("modalReferencia", "errorReferencia", rRef.error); valido = false; }
  }

  const precio = document.getElementById("modalPrecio")?.value ?? "";
  const rPrecio = validarPrecio(precio);
  if (!rPrecio.valido) { marcarError("modalPrecio", "errorPrecio", rPrecio.error); valido = false; }

  const umbral = parseInt(document.getElementById("modalUmbral")?.value ?? "");
  if (isNaN(umbral) || umbral < 0) { marcarError("modalUmbral", "errorUmbral"); valido = false; }

  return valido;
}

function marcarError(inputId, errorId, mensaje) {
  const el  = document.getElementById(inputId);
  const err = document.getElementById(errorId);
  if (el) el.classList.add("input-error");
  if (err) { if (mensaje) err.textContent = mensaje; err.classList.add("visible"); }
}

// ── Guardar producto (crear o editar) ─────────────────────────────
async function guardarProducto() {
  if (!validarModal()) return;

  const btnGuardar = document.getElementById("btnGuardarProducto");
  const alerta     = document.getElementById("alertaModalProducto");
  if (btnGuardar) { btnGuardar.disabled = true; btnGuardar.textContent = "Guardando..."; }

  const nombre = document.getElementById("modalNombre")?.value.trim();
  const sabor  = document.getElementById("modalSabor")?.value.trim();
  const precio = parseFloat(document.getElementById("modalPrecio")?.value);
  const umbral = parseInt(document.getElementById("modalUmbral")?.value);

  try {
    if (modoModal === "crear") {
      const referencia = document.getElementById("modalReferencia")
        ?.value.trim().toUpperCase();

      await addDoc(collection(db, "productos"), {
        nombre,
        sabor,
        referencia,
        presentacion:        "Vaso",
        precioUnitario:      precio,
        umbralMinimo:        umbral,
        estado:              "agotado",
        stockDisponible:     0,
        ultimaActualizacion: new Date().toISOString(),
      });
    } else {
      const estado = document.getElementById("modalEstado")?.value;
      await updateDoc(doc(db, "productos", productoEditandoId), {
        nombre,
        sabor,
        precioUnitario:      precio,
        umbralMinimo:        umbral,
        estado,
        ultimaActualizacion: new Date().toISOString(),
      });
    }
    cerrarModal();
  } catch (err) {
    if (alerta) {
      alerta.textContent = `Error al guardar: ${err.message}`;
      alerta.classList.add("visible");
    }
  } finally {
    if (btnGuardar) { btnGuardar.disabled = false; btnGuardar.textContent = "Guardar"; }
  }
}
