import { describe, expect, it } from "vitest";
import { ACTIVE_STATUSES, TERMINAL_STATUSES, isActiveStatus } from "../src/shared/status.ts";

describe("estados de cola", () => {
  it("distingue turnos activos y terminales", () => {
    expect(ACTIVE_STATUSES).toEqual(["waiting", "called", "in_service"]);
    expect(TERMINAL_STATUSES).toEqual(["completed", "absent", "cancelled"]);
    expect(isActiveStatus("waiting")).toBe(true);
    expect(isActiveStatus("cancelled")).toBe(false);
  });
});
