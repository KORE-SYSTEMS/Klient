/**
 * Docker self-update helper.
 *
 * Talks to the Docker Engine via its Unix socket (/var/run/docker.sock) if it
 * has been mounted into the container. Provides:
 *   - capability detection (socket present + readable + API reachable)
 *   - self-container introspection (image, config, mounts, env, ports, restart policy)
 *   - image pull with progress
 *   - self-recreate via a short-lived sidecar container that stops/removes the
 *     current container and starts a fresh one with the new image + preserved
 *     config. Pattern used by Portainer/Watchtower one-shot.
 *
 * Without the socket the app stays fully functional — the update route
 * exposes "manual" mode and the UI shows a copy-command modal instead.
 */
import { request as httpRequest } from "http";
import { readFileSync, existsSync, statSync, accessSync, constants } from "fs";
import { hostname } from "os";

const SOCKET_PATH = process.env.DOCKER_SOCKET || "/var/run/docker.sock";
// Helper image used to recreate ourselves. Tiny (~10 MB) and has docker CLI.
const HELPER_IMAGE = process.env.KLIENT_UPDATER_IMAGE || "docker:27-cli";

export type UpdateMode = "socket" | "manual";

export interface UpdateCapabilities {
  mode: UpdateMode;
  socketPath: string;
  socketAvailable: boolean;
  containerId: string | null;
  containerName: string | null;
  imageRef: string | null;
  reason?: string;
}

interface DockerFetchOpts {
  method?: string;
  path: string;
  body?: unknown;
  timeoutMs?: number;
  onChunk?: (chunk: string) => void;
}

function dockerFetch<T = any>(opts: DockerFetchOpts): Promise<{ status: number; body: T }> {
  return new Promise((resolve, reject) => {
    const payload = opts.body !== undefined ? JSON.stringify(opts.body) : undefined;
    const req = httpRequest(
      {
        socketPath: SOCKET_PATH,
        path: opts.path,
        method: opts.method || "GET",
        headers: {
          "Content-Type": "application/json",
          ...(payload ? { "Content-Length": Buffer.byteLength(payload).toString() } : {}),
        },
        timeout: opts.timeoutMs ?? 30_000,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => {
          chunks.push(c);
          if (opts.onChunk) opts.onChunk(c.toString("utf8"));
        });
        res.on("end", () => {
          const raw = Buffer.concat(chunks).toString("utf8");
          let body: any = raw;
          if (raw && res.headers["content-type"]?.includes("application/json")) {
            try { body = JSON.parse(raw); } catch { /* leave as string */ }
          }
          resolve({ status: res.statusCode ?? 0, body });
        });
      }
    );
    req.on("timeout", () => { req.destroy(new Error("Docker API timeout")); });
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

/** Detect our own container id from cgroup / hostname. */
function detectOwnContainerId(): string | null {
  // Preferred: /proc/self/cgroup contains "docker/<id>" or "docker-<id>.scope"
  try {
    const cg = readFileSync("/proc/self/cgroup", "utf8");
    const m =
      cg.match(/\/docker[-/]([0-9a-f]{12,64})/) ||
      cg.match(/\/([0-9a-f]{64})(?:\.scope)?$/m);
    if (m) return m[1];
  } catch { /* not in container */ }
  // Fallback: /etc/hostname is the short container id on Docker by default
  try {
    const h = hostname();
    if (/^[0-9a-f]{12}$/.test(h)) return h;
  } catch { /* ignore */ }
  return null;
}

function isSocketReachable(): boolean {
  try {
    if (!existsSync(SOCKET_PATH)) return false;
    const st = statSync(SOCKET_PATH);
    if (!st.isSocket()) return false;
    accessSync(SOCKET_PATH, constants.R_OK | constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

export async function detectCapabilities(): Promise<UpdateCapabilities> {
  const base: UpdateCapabilities = {
    mode: "manual",
    socketPath: SOCKET_PATH,
    socketAvailable: false,
    containerId: null,
    containerName: null,
    imageRef: null,
  };

  if (!isSocketReachable()) {
    return { ...base, reason: "docker-socket-not-mounted" };
  }

  // Ping the API
  try {
    const ping = await dockerFetch<string>({ path: "/_ping", timeoutMs: 3000 });
    if (ping.status !== 200) {
      return { ...base, socketAvailable: true, reason: `docker-api-unreachable:${ping.status}` };
    }
  } catch (e: any) {
    return { ...base, socketAvailable: true, reason: `docker-api-error:${e?.message}` };
  }

  const containerId = detectOwnContainerId();
  if (!containerId) {
    return { ...base, socketAvailable: true, reason: "own-container-id-not-detected" };
  }

  try {
    const { status, body } = await dockerFetch<any>({ path: `/containers/${containerId}/json` });
    if (status !== 200) {
      return { ...base, socketAvailable: true, containerId, reason: `inspect-failed:${status}` };
    }
    return {
      mode: "socket",
      socketPath: SOCKET_PATH,
      socketAvailable: true,
      containerId,
      containerName: (body.Name || "").replace(/^\//, "") || null,
      imageRef: body.Config?.Image || null,
    };
  } catch (e: any) {
    return { ...base, socketAvailable: true, containerId, reason: `inspect-error:${e?.message}` };
  }
}

/** Pull an image. Streams JSON progress lines via onProgress. */
export async function pullImage(
  imageRef: string,
  onProgress?: (line: any) => void
): Promise<void> {
  // imageRef may be "ghcr.io/kore-systems/klient:latest"
  const fromImage = encodeURIComponent(imageRef.split(":")[0]);
  const tag = encodeURIComponent(imageRef.split(":")[1] || "latest");
  const { status, body } = await dockerFetch<string>({
    method: "POST",
    path: `/images/create?fromImage=${fromImage}&tag=${tag}`,
    timeoutMs: 10 * 60_000,
    onChunk: (chunk) => {
      if (!onProgress) return;
      // Docker streams newline-delimited JSON
      for (const line of chunk.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try { onProgress(JSON.parse(trimmed)); } catch { /* ignore */ }
      }
    },
  });
  if (status !== 200) {
    throw new Error(`Image pull failed: HTTP ${status} ${typeof body === "string" ? body : JSON.stringify(body)}`);
  }
}

/**
 * Spawn a short-lived helper container that will, after a small delay (long
 * enough for our HTTP response to flush), stop + remove us and re-run the
 * container with identical config + the freshly-pulled image.
 *
 * We intentionally use docker CLI inside docker:cli rather than the API
 * directly from the helper — `docker run` on the CLI preserves the exact
 * user-level semantics the user expects (restart policy, ports, volumes).
 */
export async function scheduleSelfRecreate(caps: UpdateCapabilities): Promise<void> {
  if (caps.mode !== "socket" || !caps.containerId || !caps.containerName || !caps.imageRef) {
    throw new Error("scheduleSelfRecreate called without socket capabilities");
  }

  // Make sure the helper image is present (pull if missing — small, fast).
  await pullImage(HELPER_IMAGE).catch(() => { /* may already be present */ });

  // Capture full container config via inspect BEFORE we stop/remove, then
  // reconstruct the equivalent `docker run` flags and start fresh with the new
  // image. docker:27-cli ships without jq, so we rely on Go templates (`docker
  // inspect --format`) which are always available.
  const safeScript = [
    "set -e",
    "sleep 4",
    `CID=${caps.containerId}`,
    `NAME=${caps.containerName}`,
    `IMAGE=${caps.imageRef}`,
    // Capture config flags while container still exists
    'PORTS=$(docker inspect --format \'{{ range $p, $conf := .HostConfig.PortBindings }}{{ range $conf }}-p {{.HostPort}}:{{ $p }} {{ end }}{{ end }}\' "$CID")',
    'MOUNTS=$(docker inspect --format \'{{ range .Mounts }}{{ if eq .Type "bind" }}-v {{ .Source }}:{{ .Destination }} {{ else if eq .Type "volume" }}-v {{ .Name }}:{{ .Destination }} {{ end }}{{ end }}\' "$CID")',
    'ENVS=$(docker inspect --format \'{{ range .Config.Env }}-e {{ printf "%q" . }} {{ end }}\' "$CID")',
    'RP=$(docker inspect --format \'{{ .HostConfig.RestartPolicy.Name }}\' "$CID")',
    'NET=$(docker inspect --format \'{{ range $k, $v := .NetworkSettings.Networks }}--network {{ $k }} {{ end }}\' "$CID" | head -1)',
    // Stop + remove old
    'docker stop "$CID" >/dev/null 2>&1 || true',
    'docker rm -f "$CID" >/dev/null 2>&1 || true',
    // Recreate
    'eval docker run -d --name "$NAME" $PORTS $MOUNTS $ENVS $NET --restart "${RP:-unless-stopped}" "$IMAGE"',
  ].join("\n");

  const createRes = await dockerFetch<any>({
    method: "POST",
    path: `/containers/create?name=klient-updater-${Date.now()}`,
    body: {
      Image: HELPER_IMAGE,
      Cmd: ["sh", "-c", safeScript],
      HostConfig: {
        AutoRemove: true,
        Binds: [`${SOCKET_PATH}:/var/run/docker.sock`],
        RestartPolicy: { Name: "no" },
      },
    },
  });

  if (createRes.status !== 201) {
    throw new Error(`Helper container create failed: HTTP ${createRes.status} ${JSON.stringify(createRes.body)}`);
  }

  const helperId = createRes.body.Id;
  const startRes = await dockerFetch({
    method: "POST",
    path: `/containers/${helperId}/start`,
  });
  if (startRes.status !== 204) {
    throw new Error(`Helper container start failed: HTTP ${startRes.status}`);
  }
  // The helper will now sleep ~4s then replace us. Our caller should return
  // HTTP 202 immediately and the UI will detect the disconnect.
}
