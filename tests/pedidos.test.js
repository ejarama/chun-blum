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
  onSnapshot:      vi.fn(),
  updateDoc:       vi.fn(),
  arrayUnion:      vi.fn(),
  serverTimestamp: vi.fn(),
  Timestamp:       { now: vi.fn(() => ({ seconds: 0, nanoseconds: 0 })) },
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
  filtrarPedidosActivos,
  ordenarPorFechaEntrega,
  obtenerResumenProductos,
  puedeAccederPedidos,
  obtenerSiguienteEstado,
  puedeModificarEstado,
  esRetroceso,
  obtenerTextoBoton,
} from "../public/js/pedidos.js";

// ── Test 1: solo muestra pedidos con estado 'pendiente' o 'en_preparacion' ─
describe("filtrarPedidosActivos", () => {
  const todosLosPedidos = [
    { id: "p1", estado: "pendiente" },
    { id: "p2", estado: "en_preparacion" },
    { id: "p3", estado: "confirmado" },
    { id: "p4", estado: "enviado" },
    { id: "p5", estado: "entregado" },
    { id: "p6", estado: "cancelado" },
    { id: "p7", estado: "pendiente" },
    { id: "p8", estado: "en_preparacion" },
  ];

  it("incluye solo los estados 'pendiente' y 'en_preparacion'", () => {
    const resultado = filtrarPedidosActivos(todosLosPedidos);
    expect(resultado).toHaveLength(4); // p1, p2, p7, p8
    resultado.forEach(p =>
      expect(["pendiente", "en_preparacion"]).toContain(p.estado)
    );
  });

  it("excluye pedidos confirmados, enviados, entregados y cancelados", () => {
    const resultado = filtrarPedidosActivos(todosLosPedidos);
    const excluidos = resultado.filter(
      p => !["pendiente", "en_preparacion"].includes(p.estado)
    );
    expect(excluidos).toHaveLength(0);
  });

  it("retorna vacío si todos los pedidos están en estado final", () => {
    const finales = [
      { id: "p1", estado: "entregado" },
      { id: "p2", estado: "cancelado" },
      { id: "p3", estado: "enviado" },
    ];
    expect(filtrarPedidosActivos(finales)).toHaveLength(0);
  });

  it("retorna vacío para lista vacía", () => {
    expect(filtrarPedidosActivos([])).toHaveLength(0);
  });
});

// ── Test 2: pedidos ordenados por fecha de entrega ascendente ──────
describe("ordenarPorFechaEntrega", () => {
  const pedidosDesordenados = [
    { id: "p1", fechaEntregaSolicitada: "2026-05-20" },
    { id: "p2", fechaEntregaSolicitada: "2026-05-10" },
    { id: "p3", fechaEntregaSolicitada: "2026-05-15" },
    { id: "p4", fechaEntregaSolicitada: "2026-05-08" },
  ];

  it("ordena del más próximo al más lejano en fecha de entrega", () => {
    const resultado = ordenarPorFechaEntrega(pedidosDesordenados);
    expect(resultado[0].id).toBe("p4"); // 2026-05-08
    expect(resultado[1].id).toBe("p2"); // 2026-05-10
    expect(resultado[2].id).toBe("p3"); // 2026-05-15
    expect(resultado[3].id).toBe("p1"); // 2026-05-20
  });

  it("los 4 pedidos activos aparecen en el orden correcto del BDD", () => {
    const pedidos = [
      { id: "pedidoC", fechaEntregaSolicitada: "2026-05-18" },
      { id: "pedidoA", fechaEntregaSolicitada: "2026-05-10" },
      { id: "pedidoD", fechaEntregaSolicitada: "2026-05-25" },
      { id: "pedidoB", fechaEntregaSolicitada: "2026-05-13" },
    ];
    const resultado = ordenarPorFechaEntrega(pedidos);
    expect(resultado.map(p => p.id)).toEqual(["pedidoA", "pedidoB", "pedidoC", "pedidoD"]);
  });

  it("no modifica el array original", () => {
    const pedidos = [
      { id: "p1", fechaEntregaSolicitada: "2026-05-20" },
      { id: "p2", fechaEntregaSolicitada: "2026-05-10" },
    ];
    const idOriginalPrimero = pedidos[0].id;
    ordenarPorFechaEntrega(pedidos);
    expect(pedidos[0].id).toBe(idOriginalPrimero);
  });

  it("mantiene pedidos sin fecha al final", () => {
    const pedidos = [
      { id: "p1", fechaEntregaSolicitada: "2026-05-20" },
      { id: "p2", fechaEntregaSolicitada: undefined },
      { id: "p3", fechaEntregaSolicitada: "2026-05-10" },
    ];
    const resultado = ordenarPorFechaEntrega(pedidos);
    expect(resultado[0].id).toBe("p3"); // 10 primero
    expect(resultado[1].id).toBe("p1"); // 20 segundo
  });
});

// ── Test 3: detalle muestra todos los productos con cantidades correctas ─
describe("obtenerResumenProductos", () => {
  const productosDelPedido = [
    { nombre: "Mora",     referencia: "CB-001", cantidad: 10, precioUnitario: 2000 },
    { nombre: "Vainilla", referencia: "CB-002", cantidad: 5,  precioUnitario: 2500 },
    { nombre: "Coco",     referencia: "CB-003", cantidad: 3,  precioUnitario: 3000 },
  ];

  it("retorna todos los productos del pedido", () => {
    const resultado = obtenerResumenProductos(productosDelPedido);
    expect(resultado).toHaveLength(3);
  });

  it("preserva el nombre y referencia de cada producto", () => {
    const resultado = obtenerResumenProductos(productosDelPedido);
    expect(resultado[0].nombre).toBe("Mora");
    expect(resultado[0].referencia).toBe("CB-001");
    expect(resultado[1].nombre).toBe("Vainilla");
    expect(resultado[2].nombre).toBe("Coco");
  });

  it("preserva la cantidad exacta de cada producto", () => {
    const resultado = obtenerResumenProductos(productosDelPedido);
    expect(resultado[0].cantidad).toBe(10);
    expect(resultado[1].cantidad).toBe(5);
    expect(resultado[2].cantidad).toBe(3);
  });

  it("calcula el subtotal correcto para cada producto", () => {
    const resultado = obtenerResumenProductos(productosDelPedido);
    expect(resultado[0].subtotal).toBe(20000); // 10 × 2000
    expect(resultado[1].subtotal).toBe(12500); // 5 × 2500
    expect(resultado[2].subtotal).toBe(9000);  // 3 × 3000
  });

  it("retorna vacío para lista de productos vacía", () => {
    expect(obtenerResumenProductos([])).toHaveLength(0);
  });

  it("retorna vacío para null o undefined", () => {
    expect(obtenerResumenProductos(null)).toHaveLength(0);
    expect(obtenerResumenProductos(undefined)).toHaveLength(0);
  });
});

// ── Test 4: distribuidor y operaria no pueden acceder ─────────────
describe("puedeAccederPedidos", () => {
  it("permite acceso al vendedor", () => {
    expect(puedeAccederPedidos("vendedor")).toBe(true);
  });

  it("permite acceso al administrador", () => {
    expect(puedeAccederPedidos("admin")).toBe(true);
  });

  it("bloquea el acceso al distribuidor", () => {
    expect(puedeAccederPedidos("distribuidor")).toBe(false);
  });

  it("bloquea el acceso a la operaria", () => {
    expect(puedeAccederPedidos("operaria")).toBe(false);
  });

  it("bloquea roles desconocidos o vacíos", () => {
    expect(puedeAccederPedidos("otro")).toBe(false);
    expect(puedeAccederPedidos("")).toBe(false);
    expect(puedeAccederPedidos(null)).toBe(false);
    expect(puedeAccederPedidos(undefined)).toBe(false);
  });
});

// ── Test 5: flujo de estados válido ───────────────────────────────
describe("obtenerSiguienteEstado", () => {
  it("pendiente → confirmado", () => {
    expect(obtenerSiguienteEstado("pendiente")).toBe("confirmado");
  });

  it("confirmado → en_preparacion", () => {
    expect(obtenerSiguienteEstado("confirmado")).toBe("en_preparacion");
  });

  it("en_preparacion → enviado", () => {
    expect(obtenerSiguienteEstado("en_preparacion")).toBe("enviado");
  });

  it("enviado → entregado", () => {
    expect(obtenerSiguienteEstado("enviado")).toBe("entregado");
  });

  it("entregado → null (no hay siguiente)", () => {
    expect(obtenerSiguienteEstado("entregado")).toBeNull();
  });

  it("estado inválido → null", () => {
    expect(obtenerSiguienteEstado("despachado")).toBeNull();
    expect(obtenerSiguienteEstado("")).toBeNull();
    expect(obtenerSiguienteEstado(null)).toBeNull();
  });

  // BDD: Dado pedido en "confirmado" + vendedor → retorna "en_preparacion"
  it("BDD: pedido confirmado con rol vendedor obtiene siguiente estado en_preparacion", () => {
    const estadoPedido = "confirmado";
    const rol          = "vendedor";
    expect(puedeModificarEstado(rol)).toBe(true);
    expect(obtenerSiguienteEstado(estadoPedido)).toBe("en_preparacion");
  });
});

// ── Test 6: control de acceso para modificar estado ───────────────
describe("puedeModificarEstado", () => {
  it("vendedor → true", () => {
    expect(puedeModificarEstado("vendedor")).toBe(true);
  });

  it("admin → true", () => {
    expect(puedeModificarEstado("admin")).toBe(true);
  });

  it("distribuidor → false", () => {
    expect(puedeModificarEstado("distribuidor")).toBe(false);
  });

  it("operaria → false", () => {
    expect(puedeModificarEstado("operaria")).toBe(false);
  });

  it("null y cadena vacía → false", () => {
    expect(puedeModificarEstado(null)).toBe(false);
    expect(puedeModificarEstado("")).toBe(false);
    expect(puedeModificarEstado(undefined)).toBe(false);
  });
});

// ── Test 7: detección de retrocesos en el flujo ───────────────────
describe("esRetroceso", () => {
  it("confirmado → pendiente es retroceso (true)", () => {
    expect(esRetroceso("confirmado", "pendiente")).toBe(true);
  });

  it("enviado → en_preparacion es retroceso (true)", () => {
    expect(esRetroceso("enviado", "en_preparacion")).toBe(true);
  });

  it("pendiente → confirmado NO es retroceso (false)", () => {
    expect(esRetroceso("pendiente", "confirmado")).toBe(false);
  });

  it("mismo estado → false", () => {
    expect(esRetroceso("en_preparacion", "en_preparacion")).toBe(false);
  });

  // BDD: intento de "enviado" → "en_preparacion" es retroceso
  it("BDD: intento de enviado → en_preparacion detectado como retroceso", () => {
    expect(esRetroceso("enviado", "en_preparacion")).toBe(true);
  });
});

// ── Test 8: texto del botón por estado ────────────────────────────
describe("obtenerTextoBoton", () => {
  it('pendiente → "Confirmar pedido"', () => {
    expect(obtenerTextoBoton("pendiente")).toBe("Confirmar pedido");
  });

  it('confirmado → "Marcar en preparación"', () => {
    expect(obtenerTextoBoton("confirmado")).toBe("Marcar en preparación");
  });

  it('en_preparacion → "Marcar como enviado"', () => {
    expect(obtenerTextoBoton("en_preparacion")).toBe("Marcar como enviado");
  });

  it('enviado → "Marcar como entregado"', () => {
    expect(obtenerTextoBoton("enviado")).toBe("Marcar como entregado");
  });

  it("entregado → null (estado final, sin botón)", () => {
    expect(obtenerTextoBoton("entregado")).toBeNull();
  });
});
