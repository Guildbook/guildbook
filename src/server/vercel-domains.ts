import "server-only";

export interface DomainProviderStatus {
  /** The domain is on the Vercel project. */
  attached: boolean;
  /** Vercel has confirmed no other account owns it. */
  verified: boolean;
  /** DNS does not point at Vercel yet. */
  misconfigured: boolean;
  /** TXT records Vercel wants when the domain is in use by another Vercel account. */
  challenges: { type: string; domain: string; value: string }[];
}

/** Attaches custom domains to the hosting project so they route (and get certificates). */
export interface DomainProvider {
  add(domain: string): Promise<void>;
  status(domain: string): Promise<DomainProviderStatus>;
  remove(domain: string): Promise<void>;
}

interface VercelConfig {
  token: string;
  projectId: string;
  teamId: string | null;
}

export function vercelConfigFromEnv(env: Record<string, string | undefined> = process.env): VercelConfig | null {
  const token = env.VERCEL_TOKEN?.trim();
  const projectId = env.VERCEL_PROJECT_ID?.trim();
  if (!token || !projectId) return null;
  return { token, projectId, teamId: env.VERCEL_TEAM_ID?.trim() || null };
}

class VercelApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/** The Vercel Domains API for one project (https://vercel.com/docs/rest-api). */
export function createVercelDomains(config: VercelConfig, fetchImpl: typeof fetch = fetch): DomainProvider {
  async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = new URL(path, "https://api.vercel.com");
    if (config.teamId) url.searchParams.set("teamId", config.teamId);
    const res = await fetchImpl(url, {
      method,
      headers: { authorization: `Bearer ${config.token}`, "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
    const json = (await res.json().catch(() => ({}))) as { error?: { code?: string; message?: string } } & T;
    if (!res.ok) throw new VercelApiError(res.status, json.error?.code ?? "unknown", json.error?.message ?? `Vercel API ${res.status}`);
    return json;
  }
  const project = `/projects/${encodeURIComponent(config.projectId)}/domains`;

  return {
    async add(domain) {
      try {
        await call("POST", `/v10${project}`, { name: domain });
      } catch (err) {
        // Already on this project is fine; anything else surfaces as the domain's last error.
        if (err instanceof VercelApiError && err.status === 409 && err.code === "domain_already_in_use") return;
        throw err;
      }
    },
    async status(domain) {
      let attached = true;
      let verified = false;
      let challenges: DomainProviderStatus["challenges"] = [];
      try {
        const d = await call<{ verified?: boolean; verification?: DomainProviderStatus["challenges"] }>(
          "GET",
          `/v9${project}/${encodeURIComponent(domain)}`,
        );
        verified = Boolean(d.verified);
        challenges = d.verification ?? [];
        if (!verified) {
          const v = await call<{ verified?: boolean }>("POST", `/v9${project}/${encodeURIComponent(domain)}/verify`).catch(() => null);
          verified = Boolean(v?.verified);
        }
      } catch (err) {
        if (err instanceof VercelApiError && err.status === 404) attached = false;
        else throw err;
      }
      const cfg = await call<{ misconfigured?: boolean }>("GET", `/v6/domains/${encodeURIComponent(domain)}/config`);
      return { attached, verified, misconfigured: cfg.misconfigured !== false, challenges };
    },
    async remove(domain) {
      try {
        await call("DELETE", `/v9${project}/${encodeURIComponent(domain)}`);
      } catch (err) {
        if (!(err instanceof VercelApiError && err.status === 404)) throw err;
      }
    },
  };
}

export function getDomainProvider(): DomainProvider | null {
  const config = vercelConfigFromEnv();
  return config ? createVercelDomains(config) : null;
}
