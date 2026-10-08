const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Preview hosting starts `pnpm run dev` and only allows a bind on
 * `0.0.0.0:$PORT`. Local dev, with no PORT, stays on loopback port 5173.
 * Extra arguments stay last so an explicit `--port` still wins.
 */
export function devListenArgs({ command, managedLinux, port, host, extraArgs = [] }) {
  if (command !== "dev" || managedLinux) return extraArgs;
  const platformPort = clean(port);
  if (platformPort) {
    const requestedHost = clean(host);
    const hostname = LOOPBACK_HOSTS.has(requestedHost) || !requestedHost ? "0.0.0.0" : requestedHost;
    return ["--port", platformPort, "--hostname", hostname, ...extraArgs];
  }
  return ["--port", "5173", ...extraArgs];
}
