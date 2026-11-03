import { describe, expect, it } from "vitest";
import { escapeHtml, maskEmail, normalizeEmail } from "../src/shared/email.ts";

describe("correo electrónico", () => {
  it("normaliza el correo y rechaza valores no válidos", () => {
    expect(normalizeEmail("  Persona@Ejemplo.ES ")).toBe("persona@ejemplo.es");
    expect(normalizeEmail("no-es-un-correo")).toBeNull();
    expect(normalizeEmail(`${"a".repeat(250)}@example.com`)).toBeNull();
  });

  it("oculta la parte local del correo para el panel", () => {
    expect(maskEmail("persona@example.es")).toBe("pe•••••@example.es");
    expect(maskEmail(null)).toBe("—");
  });

  it("escapa valores antes de incluirlos en el HTML del correo", () => {
    expect(escapeHtml(`<script a="b">&'`)).toBe("&lt;script a=&quot;b&quot;&gt;&amp;&#39;");
  });
});
