import { describe, expect, it } from "vitest";
import { formatTicketNumber } from "../src/shared/ticket-number.ts";

describe("formatTicketNumber", () => {
  it("usa al menos seis dígitos", () => {
    expect(formatTicketNumber(1)).toBe("000001");
    expect(formatTicketNumber(125)).toBe("000125");
  });
  it("amplía el ancho cuando hace falta", () => {
    expect(formatTicketNumber(1_000_000)).toBe("1000000");
  });
  it("rechaza valores no válidos", () => {
    expect(() => formatTicketNumber(0)).toThrow();
    expect(() => formatTicketNumber(1.5)).toThrow();
  });
});
