import { describe, expect, it } from "vitest";
import { trackingTokenExpired } from "../src/shared/privacy.ts";
import { statusMessage } from "../src/shared/status.ts";

describe("privacidad y estados", () => {
  it("caduca tokens vencidos", () => {
    expect(trackingTokenExpired(1, 10)).toBe(true);
    expect(trackingTokenExpired(20, 10)).toBe(false);
  });
  it("explica cada estado sin datos de terceros", () => {
    expect(statusMessage("waiting")).toMatch(/cola/i);
    expect(statusMessage("called")).toMatch(/punto de atención/i);
  });
});
