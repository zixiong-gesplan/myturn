import { describe, expect, it } from "vitest";
import { maskPhone, normalizePhone } from "../src/shared/phone.ts";

describe("teléfonos", () => {
  it("normaliza móviles españoles con +34 por defecto", () => {
    expect(normalizePhone("612345678")).toBe("+34612345678");
  });
  it("acepta otros prefijos internacionales", () => {
    expect(normalizePhone("+351912345678")).toMatch(/^\+351/);
  });
  it("enmascara el teléfono para el panel", () => {
    expect(maskPhone("+34612345678")).toBe("+34••••78");
  });
});
