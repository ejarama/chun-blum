import { describe, it, expect, vi } from "vitest";

// ── Mocks de Firebase y dependencias del navegador ────────────────
vi.mock("https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js", () => ({
  onAuthStateChanged: vi.fn(),
}));

vi.mock("https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js", () => ({
  collection:  vi.fn(),
  doc:         vi.fn(),
  getDoc:      vi.fn(),
  onSnapshot:  vi.fn(),
}));

vi.mock("../public/js/firebase-config.js", () => ({
  auth: {},
  db:   {},
}));

vi.mock("../public/js/sidebar.js", () => ({
  renderizarSidebar:      vi.fn(),
  configurarCerrarSesion: vi.fn(),
}));

import {
  contarPedidosDelDia,
  filtrarStockBajo,
  contarPedidosPendientes,
  obtenerEnlaceDashboard,
  esAdmin,
} from "../public/js/dashboard.js";

// ── Helpers ───────────────────────────────────────────────────────
function timestampHoy() {
  return { toDate: () => new Date() };
}

function timestampFecha(fechaStr) {
  return { toDate: () => new Date(fechaStr) };
}

// ── Test 1: tarjeta pedidos del día — conteo correcto ─────────────
describe("contarPedidosDelDia", () => {
  it("cuenta exactamente los pedidos creados hoy (escenario BDD: 3)", () => {
    const hoy = new Date();
    const pedidos = [
      { estado: "pendiente",  fechaPedido: timestampHoy() },
      { estado: "pendiente",  fechaPedido: timestampHoy() },
      { estado: "entregado",  fechaPedido: timestampHoy() },
      { estado: "cancelado",  fechaPedido: timestampFecha("2026-01-15") },
    ];
    expect(contarPedidosDelDia(pedidos, hoy)).toBe(3);
  });

  it("no cuenta pedidos de días anteriores", () => {
    const hoy = new Date();
    const ayer = new Date(hoy);
    ayer.setDate(hoy.getDate() - 1);
    const pedidos = [
      { fechaPedido: timestampFecha(ayer.toISOString()) },
      { fechaPedido: timestampFecha(ayer.toISOString()) },
    ];
    expect(contarPedidosDelDia(pedidos, hoy)).toBe(0);
  });

  it("retorna 0 para lista de pedidos vacía", () => {
    expect(contarPedidosDelDia([], new Date())).toBe(0);
  });

  it("ignora pedidos sin fecha registrada", () => {
    const hoy = new Date();
    const pedidos = [
      { fechaPedido: null },
      { fechaPedido: undefined },
      { fechaPedido: timestampHoy() },
    ];
    expect(contarPedidosDelDia(pedidos, hoy)).toBe(1);
  });

  it("cuenta pedidos con timestamp de string ISO (fallback sin toDate)", () => {
    const hoy = new Date();
    const pedidos = [{ fechaPedido: hoy.toISOString() }];
    expect(contarPedidosDelDia(pedidos, hoy)).toBe(1);
  });
});

// ── Test 2: tarjeta stock bajo — lista solo bajo el umbral ─────────
describe("filtrarStockBajo", () => {
  const productos = [
    { nombre: "Mora",     referencia: "CB-001", stockDisponible: 3,  umbralMinimo: 20 },
    { nombre: "Vainilla", referencia: "CB-002", stockDisponible: 50, umbralMinimo: 20 },
    { nombre: "Milo",     referencia: "CB-003", stockDisponible: 10, umbralMinimo: 20 },
    { nombre: "Coco",     referencia: "CB-004", stockDisponible: 20, umbralMinimo: 20 },
  ];

  it("lista solo los productos con stock por debajo del umbral (escenario BDD: 4)", () => {
    // 4 bajo umbral + 2 OK → el filtro devuelve exactamente 4
    const mezclados = [
      { nombre: "Mora",     referencia: "CB-001", stockDisponible: 3,  umbralMinimo: 20 },
      { nombre: "Milo",     referencia: "CB-003", stockDisponible: 10, umbralMinimo: 20 },
      { nombre: "Coco",     referencia: "CB-004", stockDisponible: 5,  umbralMinimo: 20 },
      { nombre: "Oreo",     referencia: "CB-005", stockDisponible: 8,  umbralMinimo: 30 },
      { nombre: "Vainilla", referencia: "CB-002", stockDisponible: 50, umbralMinimo: 20 },
      { nombre: "Maní",     referencia: "CB-006", stockDisponible: 25, umbralMinimo: 25 },
    ];
    const resultado = filtrarStockBajo(mezclados);
    expect(resultado).toHaveLength(4);
    resultado.forEach(p => expect(p.stockDisponible).toBeLessThan(p.umbralMinimo));
  });

  it("incluye Maracuyá con 3 unidades y umbral 20 (escenario BDD de alerta crítica)", () => {
    const prods = [{ nombre: "Maracuyá", referencia: "CB-010", stockDisponible: 3, umbralMinimo: 20 }];
    const resultado = filtrarStockBajo(prods);
    expect(resultado).toHaveLength(1);
    expect(resultado[0].nombre).toBe("Maracuyá");
    expect(resultado[0].stockDisponible).toBe(3);
  });

  it("no incluye productos con stock exactamente igual al umbral", () => {
    const prods = [{ nombre: "Coco", stockDisponible: 20, umbralMinimo: 20 }];
    expect(filtrarStockBajo(prods)).toHaveLength(0);
  });

  it("no incluye productos con stock por encima del umbral", () => {
    const prods = [{ nombre: "Vainilla", stockDisponible: 50, umbralMinimo: 20 }];
    expect(filtrarStockBajo(prods)).toHaveLength(0);
  });

  it("retorna vacío para lista vacía", () => {
    expect(filtrarStockBajo([])).toHaveLength(0);
  });
});

// ── Test 3: tarjeta pendientes — conteo con estado 'pendiente' ─────
describe("contarPedidosPendientes", () => {
  it("cuenta solo pedidos con estado 'pendiente' (escenario BDD: 2)", () => {
    const pedidos = [
      { estado: "pendiente" },
      { estado: "pendiente" },
      { estado: "en_preparacion" },
      { estado: "entregado" },
      { estado: "cancelado" },
    ];
    expect(contarPedidosPendientes(pedidos)).toBe(2);
  });

  it("no cuenta pedidos en_preparacion, enviados ni entregados", () => {
    const pedidos = [
      { estado: "en_preparacion" },
      { estado: "enviado" },
      { estado: "entregado" },
    ];
    expect(contarPedidosPendientes(pedidos)).toBe(0);
  });

  it("retorna 0 para lista vacía", () => {
    expect(contarPedidosPendientes([])).toBe(0);
  });

  it("retorna el total correcto cuando todos son pendientes", () => {
    const pedidos = Array.from({ length: 5 }, () => ({ estado: "pendiente" }));
    expect(contarPedidosPendientes(pedidos)).toBe(5);
  });
});

// ── Test 4: navegación desde dashboard a inventario y pedidos ──────
describe("obtenerEnlaceDashboard", () => {
  it("la tarjeta de inventario enlaza a inventario.html", () => {
    expect(obtenerEnlaceDashboard("inventario")).toBe("inventario.html");
  });

  it("la tarjeta de pedidos enlaza a pedidos.html", () => {
    expect(obtenerEnlaceDashboard("pedidos")).toBe("pedidos.html");
  });

  it("retorna null para sección desconocida", () => {
    expect(obtenerEnlaceDashboard("desconocida")).toBeNull();
  });

  it("retorna null para valor vacío", () => {
    expect(obtenerEnlaceDashboard("")).toBeNull();
  });
});

// ── Test 5: solo el administrador puede acceder ────────────────────
describe("esAdmin", () => {
  it("retorna true para rol admin", () => {
    expect(esAdmin("admin")).toBe(true);
  });

  it("bloquea al vendedor", () => {
    expect(esAdmin("vendedor")).toBe(false);
  });

  it("bloquea al distribuidor", () => {
    expect(esAdmin("distribuidor")).toBe(false);
  });

  it("bloquea a la operaria", () => {
    expect(esAdmin("operaria")).toBe(false);
  });

  it("bloquea null y undefined", () => {
    expect(esAdmin(null)).toBe(false);
    expect(esAdmin(undefined)).toBe(false);
  });

  it("bloquea cadena vacía", () => {
    expect(esAdmin("")).toBe(false);
  });
});
