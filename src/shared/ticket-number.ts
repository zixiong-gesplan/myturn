export function formatTicketNumber(n: number): string {
  if (!Number.isInteger(n) || n < 1) {
    throw new Error("El número de turno debe ser un entero positivo");
  }
  const minWidth = 6;
  const asString = String(n);
  return asString.length >= minWidth ? asString : asString.padStart(minWidth, "0");
}

export function parseDisplayNumber(display: string): number | null {
  if (!/^\d+$/.test(display)) return null;
  const n = Number(display);
  return Number.isInteger(n) && n >= 1 ? n : null;
}
