import { describe, it, expect, vi } from "vitest";

// ── Mocks de Firebase ─────────────────────────────────────────────
vi.mock("https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js", () => ({
  onAuthStateChanged: vi.fn(),
}));

vi.mock("https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js", () => ({
  collection:  vi.fn(),
  doc:         vi.fn(),
  getDoc:      vi.fn(),
  query:       vi.fn(),
  orderBy:     vi.fn(),
  onSnapshot:  vi.fn(),
  addDoc:      vi.fn(),
  updateDoc:   vi.fn(),
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
  validarReferencia,
  validarPrecio,
  puedeEditarProducto,
  puedePrecargarsProducto,
} from "../public/js/inventario.js";

// ── validarReferencia ─────────────────────────────────────────────
describe("validarReferencia", () => {
  it("acepta el formato CB-XXX con 3 dígitos", () => {
    expect(validarReferencia("CB-001").valido).toBe(true);
    expect(validarReferencia("CB-999").valido).toBe(true);
    expect(validarReferencia("CB-100").valido).toBe(true);
  });

  it("rechaza formato sin guion", () => {
    const r = validarReferencia("CB001");
    expect(r.valido).toBe(false);
    expect(r.error).toBeTruthy();
  });

  it("rechaza letras donde deben ir dígitos", () => {
    expect(validarReferencia("CB-ABC").valido).toBe(false);
    expect(validarReferencia("CB-01A").valido).toBe(false);
  });

  it("rechaza referencias con menos de 3 dígitos", () => {
    expect(validarReferencia("CB-01").valido).toBe(false);
    expect(validarReferencia("CB-1").valido).toBe(false);
  });

  it("rechaza referencias con más de 3 dígitos", () => {
    expect(validarReferencia("CB-1234").valido).toBe(false);
    expect(validarReferencia("CB-0001").valido).toBe(false);
  });

  it("rechaza referencia vacía, null o undefined", () => {
    expect(validarReferencia("").valido).toBe(false);
    expect(validarReferencia(null).valido).toBe(false);
    expect(validarReferencia(undefined).valido).toBe(false);
  });

  it("rechaza prefijo incorrecto", () => {
    expect(validarReferencia("XX-001").valido).toBe(false);
    expect(validarReferencia("001").valido).toBe(false);
  });
});

// ── validarPrecio ─────────────────────────────────────────────────
describe("validarPrecio", () => {
  it("acepta precio positivo como número", () => {
    expect(validarPrecio(2000).valido).toBe(true);
    expect(validarPrecio(1).valido).toBe(true);
    expect(validarPrecio(99999).valido).toBe(true);
  });

  it("acepta precio positivo como string numérico", () => {
    expect(validarPrecio("1500").valido).toBe(true);
    expect(validarPrecio("2000.5").valido).toBe(true);
  });

  it("rechaza precio igual a cero", () => {
    expect(validarPrecio(0).valido).toBe(false);
    expect(validarPrecio("0").valido).toBe(false);
  });

  it("rechaza precio negativo", () => {
    expect(validarPrecio(-100).valido).toBe(false);
    expect(validarPrecio("-50").valido).toBe(false);
    expect(validarPrecio(-0.01).valido).toBe(false);
  });

  it("rechaza texto no numérico", () => {
    expect(validarPrecio("abc").valido).toBe(false);
    expect(validarPrecio("dos mil").valido).toBe(false);
    expect(validarPrecio("2.000$").valido).toBe(false);
  });

  it("rechaza precio vacío, null o undefined", () => {
    expect(validarPrecio("").valido).toBe(false);
    expect(validarPrecio(null).valido).toBe(false);
    expect(validarPrecio(undefined).valido).toBe(false);
  });

  it("retorna un mensaje de error descriptivo", () => {
    expect(validarPrecio(0).error).toBeTruthy();
    expect(validarPrecio("abc").error).toBeTruthy();
    expect(validarPrecio("").error).toBeTruthy();
  });
});

// ── puedeEditarProducto ───────────────────────────────────────────
describe("puedeEditarProducto", () => {
  it("el admin puede crear y editar productos", () => {
    expect(puedeEditarProducto("admin")).toBe(true);
  });

  it("la operaria NO puede editar productos", () => {
    expect(puedeEditarProducto("operaria")).toBe(false);
  });

  it("el vendedor NO puede editar productos", () => {
    expect(puedeEditarProducto("vendedor")).toBe(false);
  });

  it("el distribuidor NO puede editar productos", () => {
    expect(puedeEditarProducto("distribuidor")).toBe(false);
  });

  it("rol nulo, vacío o desconocido no puede editar", () => {
    expect(puedeEditarProducto(null)).toBe(false);
    expect(puedeEditarProducto("")).toBe(false);
    expect(puedeEditarProducto(undefined)).toBe(false);
    expect(puedeEditarProducto("superusuario")).toBe(false);
  });
});

// ── puedePrecargarsProducto ───────────────────────────────────────
describe("puedePrecargarsProducto", () => {
  it("el admin puede usar el acceso rápido a producción", () => {
    expect(puedePrecargarsProducto("admin")).toBe(true);
  });

  it("la operaria puede usar el acceso rápido a producción", () => {
    expect(puedePrecargarsProducto("operaria")).toBe(true);
  });

  it("el vendedor NO puede usar el acceso rápido a producción", () => {
    expect(puedePrecargarsProducto("vendedor")).toBe(false);
  });

  it("el distribuidor NO puede usar el acceso rápido a producción", () => {
    expect(puedePrecargarsProducto("distribuidor")).toBe(false);
  });

  it("rol nulo, vacío o desconocido no puede precargar", () => {
    expect(puedePrecargarsProducto(null)).toBe(false);
    expect(puedePrecargarsProducto("")).toBe(false);
    expect(puedePrecargarsProducto(undefined)).toBe(false);
  });
});
