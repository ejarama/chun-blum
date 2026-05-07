import { describe, it, expect } from "vitest";
import {
  validarCantidad,
  calcularTotalCarrito,
  determinarEstadoProducto,
  validarFechaEntrega,
  filtrarProductos,
  formatearPrecioCOP,
} from "../public/js/utils.js";

// ── validarCantidad ───────────────────────────────────────────────
describe("validarCantidad", () => {
  it("retorna válido para cantidad positiva dentro del stock", () => {
    const resultado = validarCantidad(5, 20);
    expect(resultado.valido).toBe(true);
    expect(resultado.error).toBeNull();
  });

  it("retorna inválido para cantidad cero", () => {
    const resultado = validarCantidad(0, 20);
    expect(resultado.valido).toBe(false);
    expect(resultado.error).toContain("válida");
  });

  it("retorna inválido para cantidad negativa", () => {
    const resultado = validarCantidad(-5, 20);
    expect(resultado.valido).toBe(false);
  });

  it("retorna inválido si supera el stock disponible", () => {
    const resultado = validarCantidad(25, 20);
    expect(resultado.valido).toBe(false);
    expect(resultado.error).toContain("20 unidades");
  });

  it("retorna válido para cantidad exactamente igual al stock", () => {
    const resultado = validarCantidad(20, 20);
    expect(resultado.valido).toBe(true);
  });

  it("retorna inválido para campo vacío", () => {
    const resultado = validarCantidad("", 20);
    expect(resultado.valido).toBe(false);
  });
});

// ── calcularTotalCarrito ──────────────────────────────────────────
describe("calcularTotalCarrito", () => {
  it("calcula el total correctamente para múltiples productos", () => {
    const items = [
      { cantidad: 5,  precioUnitario: 2000 },
      { cantidad: 10, precioUnitario: 2000 },
      { cantidad: 3,  precioUnitario: 2000 },
    ];
    expect(calcularTotalCarrito(items)).toBe(36000);
  });

  it("retorna 0 para carrito vacío", () => {
    expect(calcularTotalCarrito([])).toBe(0);
  });

  it("calcula correctamente para un solo producto", () => {
    const items = [{ cantidad: 20, precioUnitario: 2000 }];
    expect(calcularTotalCarrito(items)).toBe(40000);
  });
});

// ── determinarEstadoProducto ──────────────────────────────────────
describe("determinarEstadoProducto", () => {
  it("retorna 'agotado' cuando el stock es 0", () => {
    expect(determinarEstadoProducto(0)).toBe("agotado");
  });

  it("retorna 'agotado' cuando el stock es negativo", () => {
    expect(determinarEstadoProducto(-1)).toBe("agotado");
  });

  it("retorna 'disponible' cuando el stock es mayor a 0", () => {
    expect(determinarEstadoProducto(1)).toBe("disponible");
    expect(determinarEstadoProducto(50)).toBe("disponible");
  });
});

// ── validarFechaEntrega ───────────────────────────────────────────
describe("validarFechaEntrega", () => {
  it("retorna inválido para fecha vacía", () => {
    const resultado = validarFechaEntrega("");
    expect(resultado.valido).toBe(false);
  });

  it("retorna inválido para fecha de hoy", () => {
    const hoy = new Date().toISOString().split("T")[0];
    const resultado = validarFechaEntrega(hoy);
    expect(resultado.valido).toBe(false);
  });

  it("retorna inválido para fecha de mañana", () => {
    const manana = new Date();
    manana.setDate(manana.getDate() + 1);
    manana.setHours(0, 0, 0, 0);
    const fechaStr = manana.toISOString().split("T")[0];
    const resultado = validarFechaEntrega(fechaStr);
    expect(resultado.valido).toBe(false);
    });

  it("retorna válido para fecha en 2 días", () => {
    const enDosDias = new Date();
    enDosDias.setDate(enDosDias.getDate() + 2);
    const resultado = validarFechaEntrega(enDosDias.toISOString().split("T")[0]);
    expect(resultado.valido).toBe(true);
  });

  it("retorna válido para fecha en una semana", () => {
    const enUnaSemana = new Date();
    enUnaSemana.setDate(enUnaSemana.getDate() + 7);
    const resultado = validarFechaEntrega(enUnaSemana.toISOString().split("T")[0]);
    expect(resultado.valido).toBe(true);
  });
});

// ── filtrarProductos ──────────────────────────────────────────────
describe("filtrarProductos", () => {
  const productos = [
    { nombre: "Mora",     estado: "disponible"   },
    { nombre: "Vainilla", estado: "disponible"   },
    { nombre: "Coco",     estado: "en_produccion" },
    { nombre: "Oreo",     estado: "agotado"      },
  ];

  it("retorna todos los productos sin filtros", () => {
    expect(filtrarProductos(productos)).toHaveLength(4);
  });

  it("filtra correctamente por texto", () => {
    const resultado = filtrarProductos(productos, "vainilla");
    expect(resultado).toHaveLength(1);
    expect(resultado[0].nombre).toBe("Vainilla");
  });

  it("filtra correctamente por estado", () => {
    const resultado = filtrarProductos(productos, "", "disponible");
    expect(resultado).toHaveLength(2);
  });

  it("filtra por texto y estado simultáneamente", () => {
    const resultado = filtrarProductos(productos, "mora", "disponible");
    expect(resultado).toHaveLength(1);
  });

  it("retorna vacío si no hay coincidencias", () => {
    const resultado = filtrarProductos(productos, "chocolate");
    expect(resultado).toHaveLength(0);
  });

  it("la búsqueda de texto no es sensible a mayúsculas", () => {
    const resultado = filtrarProductos(productos, "MORA");
    expect(resultado).toHaveLength(1);
  });
});

// ── formatearPrecioCOP ────────────────────────────────────────────
describe("formatearPrecioCOP", () => {
  it("formatea correctamente un precio", () => {
    expect(formatearPrecioCOP(2000)).toBe("$2.000");
  });

  it("formatea correctamente precios grandes", () => {
    expect(formatearPrecioCOP(60000)).toBe("$60.000");
  });

  it("formatea correctamente cero", () => {
    expect(formatearPrecioCOP(0)).toBe("$0");
  });
});