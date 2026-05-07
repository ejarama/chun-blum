// ── utils.js — Lógica de negocio pura (sin DOM ni Firebase) ──────

/**
 * Valida que una cantidad sea un número entero positivo mayor a cero
 * y que no supere el stock disponible.
 */
export function validarCantidad(cantidad, stockDisponible) {
  const num = parseInt(cantidad);
  if (!cantidad || isNaN(num) || num <= 0) {
    return { valido: false, error: "Ingresa una cantidad válida mayor a cero." };
  }
  if (num > stockDisponible) {
    return { valido: false, error: `Stock insuficiente — solo hay ${stockDisponible} unidades.` };
  }
  return { valido: true, error: null };
}

/**
 * Calcula el total de un carrito dado un array de items.
 * Cada item debe tener: cantidad y precioUnitario.
 */
export function calcularTotalCarrito(items) {
  return items.reduce((total, item) => total + (item.cantidad * item.precioUnitario), 0);
}

/**
 * Determina el estado de un producto según su stock y umbral mínimo.
 */
export function determinarEstadoProducto(stockDisponible) {
  if (stockDisponible <= 0) return "agotado";
  return "disponible";
}

/**
 * Valida que una fecha de entrega sea mínimo N días desde hoy.
 */
export function validarFechaEntrega(fechaStr, diasMinimos = 2) {
  if (!fechaStr) return { valido: false, error: "Selecciona una fecha de entrega." };

  const hoy    = new Date();
  const minima = new Date(hoy);
  minima.setDate(hoy.getDate() + diasMinimos);
  minima.setHours(0, 0, 0, 0);

  const fecha = new Date(fechaStr + "T00:00:00");
  if (fecha < minima) {
    return { valido: false, error: `La fecha debe ser mínimo ${diasMinimos} días desde hoy.` };
  }
  return { valido: true, error: null };
}

/**
 * Filtra productos por texto de búsqueda y estado.
 */
export function filtrarProductos(productos, texto = "", estado = "") {
  return productos.filter(p => {
    const coincideTexto  = !texto  || p.nombre.toLowerCase().includes(texto.toLowerCase());
    const coincideEstado = !estado || p.estado === estado;
    return coincideTexto && coincideEstado;
  });
}

/**
 * Formatea un número como precio en pesos colombianos.
 */
export function formatearPrecioCOP(valor) {
  return `$${valor.toLocaleString("es-CO")}`;
}