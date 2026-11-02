export function trackingTokenExpired(
  expiresAt: number,
  now = Math.floor(Date.now() / 1000),
): boolean {
  return expiresAt < now;
}
