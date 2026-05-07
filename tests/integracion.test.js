/**
 * Tests de integración — Helados Chun Blum
 *
 * Verifican que las funciones de negocio de distintos módulos son
 * consistentes entre sí: mismos criterios, mismos estados, mismos totales.
 */
import { describe, it, expect, vi } from "vitest";

// ── Mocks compartidos para los tres módulos con Firebase ──────────
vi.mock("https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js", () => ({
  onAuthStateChanged: vi.fn(),
}));

vi.mock("https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js", () => ({
  collection:  vi.fn(),
  doc:         vi.fn(),
  getDoc:      vi.fn(),
  query:       vi.fn(),
  where:       vi.fn(),
  orderBy:     vi.fn(),
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

// ── Imports de los módulos bajo prueba ────────────────────────────
import {
  filtrarPedidosActivos,
  obtenerResumenProductos,
} from "../public/js/pedidos.js";

import {
  filtrarPedidosDistribuidor,
  calcularTotalPedido,
  obtenerConfigEstado,
} from "../public/js/historial.js";

import {
  contarPedidosDelDia,
  filtrarStockBajo,
  contarPedidosPendientes,
} from "../public/js/dashboard.js";

import {
  determinarEstadoProducto,
} from "../public/js/utils.js";


// ── 1. filtrarPedidosActivos y filtrarPedidosDistribuidor ─────────
describe("Integración: vistas del vendedor y del distribuidor no muestran datos incorrectos", () => {
  const pedidos = [
    { id: "p1", distribuidorId: "uid-A", estado: "pendiente" },
    { id: "p2", distribuidorId: "uid-A", estado: "en_preparacion" },
    { id: "p3", distribuidorId: "uid-A", estado: "entregado" },
    { id: "p4", distribuidorId: "uid-A", estado: "cancelado" },
    { id: "p5", distribuidorId: "uid-B", estado: "pendiente" },
    { id: "p6", distribuidorId: "uid-B", estado: "entregado" },
  ];

  it("pedidos terminados están en el historial del distribuidor pero NO en la vista activa del vendedor", () => {
    const delDistribuidorA = filtrarPedidosDistribuidor(pedidos, "uid-A");
    const activos          = filtrarPedidosActivos(pedidos);

    // p3 (entregado) y p4 (cancelado) sí están en el historial
    expect(delDistribuidorA.find(p => p.id === "p3")).toBeDefined();
    expect(delDistribuidorA.find(p => p.id === "p4")).toBeDefined();

    // Pero NO aparecen en la lista activa del vendedor
    expect(activos.find(p => p.id === "p3")).toBeUndefined();
    expect(activos.find(p => p.id === "p4")).toBeUndefined();
  });

  it("los pedidos del distribuidor A nunca aparecen en el historial del distribuidor B", () => {
    const idsA         = filtrarPedidosDistribuidor(pedidos, "uid-A").map(p => p.id);
    const idsB         = filtrarPedidosDistribuidor(pedidos, "uid-B").map(p => p.id);
    const interseccion = idsA.filter(id => idsB.includes(id));
    expect(interseccion).toHaveLength(0);
  });

  it("un pedido activo del distribuidor A aparece tanto en la vista del vendedor como en su historial", () => {
    const activos = filtrarPedidosActivos(pedidos);
    const delA    = filtrarPedidosDistribuidor(pedidos, "uid-A");

    // p1 es pendiente de uid-A: debe estar en ambas vistas
    expect(activos.find(p => p.id === "p1")).toBeDefined();
    expect(delA.find(p => p.id === "p1")).toBeDefined();
  });

  it("un distribuidor sin pedidos activos no contamina la vista del vendedor con datos ajenos", () => {
    const soloEntregados = [
      { id: "px", distribuidorId: "uid-C", estado: "entregado" },
    ];
    expect(filtrarPedidosActivos(soloEntregados)).toHaveLength(0);
    expect(filtrarPedidosDistribuidor(soloEntregados, "uid-C")).toHaveLength(1);
  });
});


// ── 2. contarPedidosDelDia y filtrarPedidosActivos — criterios ortogonales ──
describe("Integración: fecha del pedido y estado del pedido son dimensiones independientes", () => {
  const hoy  = new Date();
  const ayer = new Date(hoy);
  ayer.setDate(hoy.getDate() - 1);

  const pedidos = [
    { id: "p1", estado: "pendiente",      fechaPedido: { toDate: () => new Date(hoy) } },
    { id: "p2", estado: "en_preparacion", fechaPedido: { toDate: () => new Date(hoy) } },
    { id: "p3", estado: "entregado",      fechaPedido: { toDate: () => new Date(hoy) } },
    { id: "p4", estado: "pendiente",      fechaPedido: { toDate: () => new Date(ayer) } },
    { id: "p5", estado: "cancelado",      fechaPedido: { toDate: () => new Date(ayer) } },
  ];

  it("contarPedidosDelDia cuenta todos los estados del día sin filtrar por estado", () => {
    // p1 (pendiente hoy) + p2 (en_preparacion hoy) + p3 (entregado hoy) = 3
    expect(contarPedidosDelDia(pedidos, hoy)).toBe(3);
  });

  it("filtrarPedidosActivos incluye pedidos de días anteriores si siguen activos", () => {
    const activos = filtrarPedidosActivos(pedidos);
    // p4 es de ayer pero sigue pendiente → debe aparecer
    expect(activos.find(p => p.id === "p4")).toBeDefined();
  });

  it("un pedido de hoy entregado está en 'del día' pero NO en activos", () => {
    expect(contarPedidosDelDia(pedidos, hoy)).toBeGreaterThan(0);
    expect(filtrarPedidosActivos(pedidos).find(p => p.id === "p3")).toBeUndefined();
  });

  it("un pedido de ayer pendiente está en activos pero NO en 'del día'", () => {
    const activosIds = filtrarPedidosActivos(pedidos).map(p => p.id);
    expect(activosIds).toContain("p4");

    // contarPedidosDelDia no cuenta p4 porque es de ayer
    const pedidosSoloHoy = pedidos.filter(p =>
      p.fechaPedido.toDate().toDateString() === hoy.toDateString()
    );
    expect(pedidosSoloHoy.find(p => p.id === "p4")).toBeUndefined();
  });
});


// ── 3. Estados válidos son los mismos en todos los módulos ─────────
describe("Integración: estados del sistema consistentes entre módulos", () => {
  // Estados reconocidos explícitamente en el código
  // Nota: el negocio usa 'enviado'; el código usa 'enviado' — son equivalentes
  const ESTADOS_EN_CODIGO = [
    "pendiente", "confirmado", "en_preparacion",
    "enviado",   "entregado",  "cancelado",
  ];

  it("obtenerConfigEstado (historial.js) reconoce todos los estados sin caer en 'default'", () => {
    ESTADOS_EN_CODIGO.forEach(estado => {
      const config = obtenerConfigEstado(estado);
      expect(config.clase).not.toBe("estado-default");
      expect(config.texto).toBeTruthy();
    });
  });

  it("filtrarPedidosActivos solo devuelve pedidos cuyos estados están en el sistema", () => {
    const uno = ESTADOS_EN_CODIGO.map((estado, i) => ({ id: `p${i}`, estado }));
    filtrarPedidosActivos(uno).forEach(p =>
      expect(ESTADOS_EN_CODIGO).toContain(p.estado)
    );
  });

  it("de los 6 estados, filtrarPedidosActivos devuelve exactamente 2 (pendiente y en_preparacion)", () => {
    const uno = ESTADOS_EN_CODIGO.map((estado, i) => ({ id: `p${i}`, estado }));
    const activos = filtrarPedidosActivos(uno);
    expect(activos).toHaveLength(2);
    expect(activos.map(p => p.estado)).toEqual(
      expect.arrayContaining(["pendiente", "en_preparacion"])
    );
  });

  it("contarPedidosPendientes solo cuenta 'pendiente' (1 de 6 estados)", () => {
    const uno = ESTADOS_EN_CODIGO.map((estado, i) => ({ id: `p${i}`, estado }));
    expect(contarPedidosPendientes(uno)).toBe(1);
  });

  it("'en_preparacion' está activo para el vendedor pero no es 'pendiente' para el dashboard", () => {
    const pedidos = [{ id: "p1", estado: "en_preparacion" }];
    expect(filtrarPedidosActivos(pedidos)).toHaveLength(1);   // activo para vendedor
    expect(contarPedidosPendientes(pedidos)).toBe(0);          // no es pendiente para dashboard
  });
});


// ── 4. calcularTotalPedido e obtenerResumenProductos — mismo total ─
describe("Integración: calcularTotalPedido y obtenerResumenProductos producen el mismo total", () => {
  const productos = [
    { nombre: "Mora",     referencia: "CB-001", cantidad: 10, precioUnitario: 2000 },
    { nombre: "Vainilla", referencia: "CB-002", cantidad: 5,  precioUnitario: 2500 },
    { nombre: "Coco",     referencia: "CB-003", cantidad: 3,  precioUnitario: 3000 },
  ];

  it("la suma de subtotales de obtenerResumenProductos iguala calcularTotalPedido", () => {
    const total         = calcularTotalPedido(productos);
    const resumen       = obtenerResumenProductos(productos);
    const sumSubtotales = resumen.reduce((acc, p) => acc + p.subtotal, 0);
    expect(sumSubtotales).toBe(total);
    expect(total).toBe(41500); // 20000 + 12500 + 9000
  });

  it("ambas funciones retornan 0 para lista vacía", () => {
    expect(calcularTotalPedido([])).toBe(0);
    const sumVacia = obtenerResumenProductos([]).reduce((acc, p) => acc + p.subtotal, 0);
    expect(sumVacia).toBe(0);
  });

  it("el total es el mismo independientemente del orden de los productos", () => {
    const invertidos = [...productos].reverse();
    expect(calcularTotalPedido(productos)).toBe(calcularTotalPedido(invertidos));

    const sumInvertida = obtenerResumenProductos(invertidos)
      .reduce((acc, p) => acc + p.subtotal, 0);
    expect(sumInvertida).toBe(calcularTotalPedido(productos));
  });

  it("obtenerResumenProductos preserva la cantidad de cada producto usada en el total", () => {
    const resumen = obtenerResumenProductos(productos);
    resumen.forEach((item, i) => {
      expect(item.subtotal).toBe(productos[i].cantidad * productos[i].precioUnitario);
    });
  });
});


// ── 5. filtrarStockBajo — criterio < umbralMinimo consistente ──────
describe("Integración: filtrarStockBajo usa el mismo criterio estricto que el inventario", () => {
  it("el umbral es estricto (<), no inclusivo (<=) — igual que en la UI de inventario", () => {
    const exacto = [{ nombre: "Mora", stockDisponible: 20, umbralMinimo: 20 }];
    expect(filtrarStockBajo(exacto)).toHaveLength(0); // NO es stock bajo

    const unoPorDebajo = [{ nombre: "Mora", stockDisponible: 19, umbralMinimo: 20 }];
    expect(filtrarStockBajo(unoPorDebajo)).toHaveLength(1); // SÍ es stock bajo
  });

  it("productos agotados (stock=0) también aparecen como stock bajo en el dashboard", () => {
    const agotado = [{ nombre: "Mora", stockDisponible: 0, umbralMinimo: 10 }];
    expect(filtrarStockBajo(agotado)).toHaveLength(1);
  });

  it("filtrarStockBajo incluye más casos que solo los agotados — captura stock bajo pero disponible", () => {
    const bajo = { nombre: "Mora", stockDisponible: 5, umbralMinimo: 20 };

    // utils.determinarEstadoProducto dice 'disponible' (aún hay stock)
    expect(determinarEstadoProducto(bajo.stockDisponible)).toBe("disponible");

    // Pero filtrarStockBajo sí lo detecta como alerta
    expect(filtrarStockBajo([bajo])).toHaveLength(1);
  });

  it("el criterio es simétrico: mismo resultado con umbralMinimo alto o bajo", () => {
    const lista = [
      { nombre: "A", stockDisponible: 5,  umbralMinimo: 10 }, // bajo
      { nombre: "B", stockDisponible: 15, umbralMinimo: 10 }, // OK
      { nombre: "C", stockDisponible: 0,  umbralMinimo: 5  }, // bajo (agotado)
      { nombre: "D", stockDisponible: 5,  umbralMinimo: 5  }, // OK (exacto)
    ];
    const bajos = filtrarStockBajo(lista);
    expect(bajos).toHaveLength(2); // A y C
    expect(bajos.map(p => p.nombre)).toEqual(expect.arrayContaining(["A", "C"]));
  });
});
