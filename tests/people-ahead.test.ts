import { describe, expect, it } from "vitest";
import { countPeopleAhead } from "../src/shared/people-ahead.ts";

describe("countPeopleAhead", () => {
  it("cuenta solo turnos en espera anteriores, no una resta de números", () => {
    const viewer = { number: 10, status: "waiting" as const };
    const others = [
      { number: 7, status: "waiting" as const },
      { number: 8, status: "cancelled" as const },
      { number: 9, status: "absent" as const },
      { number: 11, status: "waiting" as const },
    ];
    expect(countPeopleAhead(viewer, others)).toBe(1);
  });
  it("devuelve 0 si el turno ya está llamado", () => {
    expect(countPeopleAhead({ number: 10, status: "called" }, [{ number: 9, status: "waiting" }])).toBe(0);
  });
});
