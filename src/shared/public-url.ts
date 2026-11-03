type PublicUrlOptions = {
  appBaseUrl?: string;
  configuredBaseUrl?: string;
  vercelProjectProductionUrl?: string;
  vercelUrl?: string;
  requestUrl: string;
  production: boolean;
};

function parsePublicOrigin(value: string | undefined, production: boolean): string | null {
  if (!value?.trim()) return null;
  const candidate = value.trim();
  let url: URL;
  try {
    url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(candidate) ? candidate : `https://${candidate}`);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  if (production && ["localhost", "127.0.0.1", "::1"].includes(url.hostname)) return null;
  return url.origin;
}

export function resolvePublicOrigin(options: PublicUrlOptions): string | null {
  const candidates = [
    options.appBaseUrl,
    options.configuredBaseUrl,
    options.vercelProjectProductionUrl,
    options.vercelUrl,
    options.requestUrl,
  ];
  for (const candidate of candidates) {
    const origin = parsePublicOrigin(candidate, options.production);
    if (origin) return origin;
  }
  return null;
}
