import { describe, it, expect, vi } from "vitest";

// ── Mocks de Firebase y dependencias del navegador ────────────────
vi.mock("https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js", () => ({
  onAuthStateChanged: vi.fn(),
}));

vi.mock("https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js", () => ({
  collection:      vi.fn(),
  doc:             vi.fn(),
  getDoc:          vi.fn(),
  query:           vi.fn(),
  where:           vi.fn(),
  orderBy:         vi.fn(),
  onSnapshot:      vi.fn(),
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
  filtrarPedidosDistribuidor,
  obtenerConfigEstado,
  calcularTotalPedido,
  hayPedidos,
} from "../public/js/historial.js";

// ── Test 1: historial solo retorna pedidos del distribuidorId ──────
describe("filtrarPedidosDistribuidor", () => {
  const pedidosEjemplo = [
    { id: "p1", distribuidorId: "uid-A", estado: "pendiente" },
    { id: "p2", distribuidorId: "uid-A", estado: "confirmado" },
    { id: "p3", distribuidorId: "uid-B", estado: "pendiente" },
    { id: "p4", distribuidorId: "uid-A", estado: "entregado" },
    { id: "p5", distribuidorId: "uid-B", estado: "pendiente" },
    { id: "p6", distribuidorId: "uid-A", estado: "enviado" },
    { id: "p7", distribuidorId: "uid-A", estado: "en_preparacion" },
    { id: "p8", distribuidorId: "uid-B", estado: "entregado" },
  ];

  it("retorna exactamente los pedidos del distribuidorId indicado", () => {
    const resultado = filtrarPedidosDistribuidor(pedidosEjemplo, "uid-A");
    expect(resultado).toHaveLength(5);
  });

  it("nunca incluye pedidos de otro distribuidor", () => {
    const resultado = filtrarPedidosDistribuidor(pedidosEjemplo, "uid-A");
    const ajenos = resultado.filter(p => p.distribuidorId !== "uid-A");
    expect(ajenos).toHaveLength(0);
  });

  it("solo retorna pedidos de uid-B cuando se filtra por uid-B", () => {
    const resultado = filtrarPedidosDistribuidor(pedidosEjemplo, "uid-B");
    expect(resultado).toHaveLength(3);
    resultado.forEach(p => expect(p.distribuidorId).toBe("uid-B"));
  });

  it("retorna vacío si el distribuidor no tiene pedidos", () => {
    expect(filtrarPedidosDistribuidor(pedidosEjemplo, "uid-desconocido")).toHaveLength(0);
  });

  it("retorna vacío para lista de pedidos vacía", () => {
    expect(filtrarPedidosDistribuidor([], "uid-A")).toHaveLength(0);
  });
});

// ── Test 2: estado del pedido se actualiza en pantalla sin recargar ─
describe("obtenerConfigEstado", () => {
  it("retorna la configuración correcta para 'confirmado'", () => {
    const config = obtenerConfigEstado("confirmado");
    expect(config.texto).toBe("Confirmado");
    expect(config.clase).toBe("estado-confirmado");
  });

  it("retorna la configuración de 'en_preparacion' cuando el vendedor actualiza el estado", () => {
    const config = obtenerConfigEstado("en_preparacion");
    expect(config.texto).toBe("En preparación");
    expect(config.clase).toBe("estado-preparacion");
  });

  it("el cambio de 'confirmado' a 'en_preparacion' produce una configuración diferente", () => {
    const antes  = obtenerConfigEstado("confirmado");
    const despues = obtenerConfigEstado("en_preparacion");
    expect(antes.texto).not.toBe(despues.texto);
    expect(antes.clase).not.toBe(despues.clase);
  });

  it("cubre todos los estados del sistema de pedidos", () => {
    const estados = ["pendiente", "confirmado", "en_preparacion", "enviado", "entregado", "cancelado"];
    estados.forEach(estado => {
      const config = obtenerConfigEstado(estado);
      expect(config.texto).toBeTruthy();
      expect(config.clase).toBeTruthy();
    });
  });

  it("retorna el estado sin procesar para estados desconocidos", () => {
    const config = obtenerConfigEstado("estado_nuevo");
    expect(config.texto).toBe("estado_nuevo");
    expect(config.clase).toBe("estado-default");
  });
});

// ── Test 3: detalle muestra todos los productos, cantidades y total ─
describe("calcularTotalPedido", () => {
  const productosDelPedido = [
    { nombre: "Mora",     referencia: "CB-001", cantidad: 10, precioUnitario: 2000 },
    { nombre: "Vainilla", referencia: "CB-002", cantidad: 5,  precioUnitario: 2500 },
    { nombre: "Coco",     referencia: "CB-003", cantidad: 3,  precioUnitario: 3000 },
  ];

  it("calcula el total correcto considerando cantidad y precio de cada producto", () => {
    // 10*2000 + 5*2500 + 3*3000 = 20000 + 12500 + 9000 = 41500
    expect(calcularTotalPedido(productosDelPedido)).toBe(41500);
  });

  it("el subtotal de un producto refleja su cantidad exacta", () => {
    const unProducto = [{ cantidad: 7, precioUnitario: 2000 }];
    expect(calcularTotalPedido(unProducto)).toBe(14000);
  });

  it("suma correctamente múltiples productos con distintas cantidades y precios", () => {
    const productos = [
      { cantidad: 1, precioUnitario: 5000 },
      { cantidad: 20, precioUnitario: 2000 },
    ];
    expect(calcularTotalPedido(productos)).toBe(45000);
  });

  it("retorna 0 para un pedido sin productos", () => {
    expect(calcularTotalPedido([])).toBe(0);
  });

  it("retorna 0 para productos null o undefined", () => {
    expect(calcularTotalPedido(null)).toBe(0);
    expect(calcularTotalPedido(undefined)).toBe(0);
  });
});

// ── Test 4: distribuidor sin pedidos ve mensaje vacío ─────────────
describe("hayPedidos", () => {
  it("retorna false para lista vacía — se debe mostrar el estado vacío", () => {
    expect(hayPedidos([])).toBe(false);
  });

  it("retorna true cuando el distribuidor tiene pedidos", () => {
    const pedidos = [{ id: "p1", distribuidorId: "uid-A" }];
    expect(hayPedidos(pedidos)).toBe(true);
  });

  it("retorna true con múltiples pedidos", () => {
    const pedidos = Array.from({ length: 5 }, (_, i) => ({ id: `p${i}` }));
    expect(hayPedidos(pedidos)).toBe(true);
  });

  it("retorna false para null — no se muestra tabla vacía", () => {
    expect(hayPedidos(null)).toBe(false);
  });

  it("retorna false para undefined", () => {
    expect(hayPedidos(undefined)).toBe(false);
  });
});
