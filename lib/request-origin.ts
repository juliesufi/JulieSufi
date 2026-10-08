/** Public site origin for same-origin checks behind GoDaddy's reverse proxy. */
export function requestPublicOrigin(request: Request) {
  const url = new URL(request.url);
  if (typeof process !== "undefined" && process.env.TRUST_PROXY === "1") {
    const forwardedHost =
      request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
      request.headers.get("host")?.split(",")[0]?.trim();
    if (forwardedHost) {
      const forwardedProto = request.headers
        .get("x-forwarded-proto")
        ?.split(",")[0]
        ?.trim()
        .toLowerCase();
      const protocol =
        forwardedProto === "http" || forwardedProto === "https"
          ? forwardedProto
          : "https";
      return `${protocol}://${forwardedHost}`;
    }
  }
  return url.origin;
}

/** True when Origin is absent or matches the public site origin. */
export function isSameOriginRequest(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  return (
    origin === requestPublicOrigin(request) ||
    origin === new URL(request.url).origin
  );
}
