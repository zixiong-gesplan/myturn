import { describe, expect, it } from "vitest";
import { hashPassword, isPasswordStrong, verifyPassword } from "../src/shared/password.ts";

describe("contraseñas", () => {
  it("rechaza contraseñas débiles y habituales", () => {
    expect(isPasswordStrong("admin1234567")).toBe(false);
    expect(isPasswordStrong("corto")).toBe(false);
    expect(isPasswordStrong("UnaClaveSegura12")).toBe(true);
  });
  it("verifica el hash PBKDF2", async () => {
    const hash = await hashPassword("UnaClaveSegura12");
    expect(await verifyPassword("UnaClaveSegura12", hash)).toBe(true);
    expect(await verifyPassword("otra", hash)).toBe(false);
  });
});
