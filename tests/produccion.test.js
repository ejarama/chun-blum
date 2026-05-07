import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock de Firebase Firestore ────────────────────────────────────
// Simulamos runTransaction y addDoc sin necesitar Firebase real
vi.mock("https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js", () => ({
  runTransaction: vi.fn(),
  addDoc:         vi.fn(),
  collection:     vi.fn(),
  doc:            vi.fn(),
  serverTimestamp: vi.fn(() => new Date()),
}));

vi.mock("../public/js/firebase-config.js", () => ({
  auth: {},
  db:   {},
}));

// ── Lógica de negocio de producción ──────────────────────────────
// Extraemos solo la lógica pura para probarla
function calcularNuevoStock(stockActual, cantidadProducida) {
  return stockActual + cantidadProducida;
}

function determinarEstadoTrasLote(nuevoStock) {
  return nuevoStock > 0 ? "disponible" : "agotado";
}

function validarLote(productoId, cantidad) {
  if (!productoId) {
    return { valido: false, error: "Selecciona un producto." };
  }
  const num = parseInt(cantidad);
  if (!cantidad || isNaN(num) || num <= 0) {
    return { valido: false, error: "Ingresa una cantidad válida mayor a cero." };
  }
  return { valido: true, error: null };
}

// ── Pruebas ───────────────────────────────────────────────────────
describe("calcularNuevoStock", () => {
  it("suma correctamente la cantidad producida al stock actual", () => {
    expect(calcularNuevoStock(10, 30)).toBe(40);
  });

  it("funciona cuando el stock actual es 0 (producto agotado)", () => {
    expect(calcularNuevoStock(0, 25)).toBe(25);
  });

  it("funciona con cantidades grandes", () => {
    expect(calcularNuevoStock(100, 200)).toBe(300);
  });
});

describe("determinarEstadoTrasLote", () => {
  it("retorna disponible cuando el nuevo stock es mayor a 0", () => {
    expect(determinarEstadoTrasLote(25)).toBe("disponible");
  });

  it("retorna disponible cuando el stock era 0 y se registra un lote", () => {
    expect(determinarEstadoTrasLote(1)).toBe("disponible");
  });

  it("retorna agotado si el nuevo stock sigue siendo 0", () => {
    expect(determinarEstadoTrasLote(0)).toBe("agotado");
  });
});

describe("validarLote", () => {
  it("retorna válido con producto y cantidad correctos", () => {
    const resultado = validarLote("CB-001", 20);
    expect(resultado.valido).toBe(true);
  });

  it("retorna inválido si no se seleccionó producto", () => {
    const resultado = validarLote("", 20);
    expect(resultado.valido).toBe(false);
    expect(resultado.error).toContain("producto");
  });

  it("retorna inválido para cantidad cero", () => {
    const resultado = validarLote("CB-001", 0);
    expect(resultado.valido).toBe(false);
  });

  it("retorna inválido para cantidad negativa", () => {
    const resultado = validarLote("CB-001", -5);
    expect(resultado.valido).toBe(false);
  });
});