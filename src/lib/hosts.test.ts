import { describe, expect, it } from "vitest";
import {
  apexOrigin,
  guildSubdomainOrigin,
  type HostConfig,
  hostConfigFromEnv,
  isLocalHost,
  parseHost,
  sharesSessionCookie,
  slugProblem,
  suggestSlug,
  validateRedirectTarget,
} from "./hosts";

/** Production today: guildbook.io only. */
const prod: HostConfig = { rootDomain: "guildbook.io", altDomains: [], defaultGuildSlug: null, cookieDomain: "guildbook.io" };
/** If guildbook.gg is added later as an alias: a config change only. */
const withGg: HostConfig = { ...prod, altDomains: ["guildbook.gg"] };
const dev: HostConfig = { rootDomain: "localhost", altDomains: [], defaultGuildSlug: "osm", cookieDomain: null };
const devNoDefault: HostConfig = { ...dev, defaultGuildSlug: null };

describe("parseHost", () => {
  it("routes the apex and redirects www", () => {
    expect(parseHost("guildbook.io", prod)).toEqual({ kind: "apex" });
    expect(parseHost("GuildBook.IO.", prod)).toEqual({ kind: "apex" });
    expect(parseHost("www.guildbook.io", prod)).toEqual({ kind: "redirect", host: "guildbook.io" });
  });

  it("routes guild subdomains", () => {
    expect(parseHost("osm.guildbook.io", prod)).toEqual({ kind: "guild", slug: "osm" });
    expect(parseHost("silver-dawn.guildbook.io:443", prod)).toEqual({ kind: "guild", slug: "silver-dawn" });
  });

  it("rejects reserved and malformed subdomains", () => {
    for (const label of ["api", "admin", "mail", "status", "blog", "app", "auth", "static", "assets", "docs"]) {
      expect(parseHost(`${label}.guildbook.io`, prod)).toMatchObject({ kind: "reserved" });
    }
    expect(parseHost("a.b.guildbook.io", prod)).toMatchObject({ kind: "reserved" });
    expect(parseHost("xn--abc.guildbook.io", prod)).toMatchObject({ kind: "reserved" });
    expect(parseHost("ab.guildbook.io", prod)).toMatchObject({ kind: "reserved" });
  });

  it("redirects alternate domains to the same name on the root", () => {
    expect(parseHost("guildbook.gg", withGg)).toEqual({ kind: "redirect", host: "guildbook.io" });
    expect(parseHost("www.guildbook.gg", withGg)).toEqual({ kind: "redirect", host: "guildbook.io" });
    expect(parseHost("osm.guildbook.gg", withGg)).toEqual({ kind: "redirect", host: "osm.guildbook.io" });
    // Without the alias configured, .gg is just another (unverified) custom domain.
    expect(parseHost("guildbook.gg", prod)).toEqual({ kind: "custom", host: "guildbook.gg" });
  });

  it("treats other hosts as possible custom domains, and previews and IPs as fallback", () => {
    expect(parseHost("orderofsaintmichael.com", prod)).toEqual({ kind: "custom", host: "orderofsaintmichael.com" });
    expect(parseHost("www.orderofsaintmichael.com", prod)).toEqual({ kind: "custom", host: "www.orderofsaintmichael.com" });
    expect(parseHost("guildbook-git-main.vercel.app", prod)).toEqual({ kind: "fallback", defaultGuildSlug: null });
    expect(parseHost("10.0.0.5:3000", prod)).toEqual({ kind: "fallback", defaultGuildSlug: null });
    expect(parseHost("", prod)).toEqual({ kind: "fallback", defaultGuildSlug: null });
  });

  it("supports localhost variants in dev", () => {
    // Bare localhost is the apex whatever the default guild, since the Discord redirect URI is registered there.
    expect(parseHost("localhost:3000", dev)).toEqual({ kind: "apex" });
    expect(parseHost("localhost:3000", devNoDefault)).toEqual({ kind: "apex" });
    expect(parseHost("www.localhost:3000", dev)).toEqual({ kind: "redirect", host: "localhost" });
    expect(parseHost("osm.localhost:3000", dev)).toEqual({ kind: "guild", slug: "osm" });
    expect(parseHost("api.localhost:3000", dev)).toMatchObject({ kind: "reserved" });
    expect(parseHost("127.0.0.1:3000", dev)).toEqual({ kind: "fallback", defaultGuildSlug: "osm" });
    // localhost subdomains work even when a real root domain is configured.
    expect(parseHost("osm.localhost:3000", prod)).toEqual({ kind: "guild", slug: "osm" });
  });
});

describe("slugs", () => {
  it("explains why a slug is unusable", () => {
    expect(slugProblem("osm")).toBeNull();
    expect(slugProblem("silver-dawn-2")).toBeNull();
    expect(slugProblem("ab")).toBe("length");
    expect(slugProblem("a".repeat(31))).toBe("length");
    expect(slugProblem("Silver")).toBe("characters");
    expect(slugProblem("-dawn")).toBe("characters");
    expect(slugProblem("dawn-")).toBe("characters");
    expect(slugProblem("a--b")).toBe("characters");
    expect(slugProblem("dawn_guard")).toBe("characters");
    expect(slugProblem("www")).toBe("reserved");
    expect(slugProblem("platform")).toBe("reserved");
    expect(slugProblem("charter")).toBe("reserved");
  });

  it("suggests a slug from a name", () => {
    expect(suggestSlug("Order of Saint Michael")).toBe("order-of-saint-michael");
    expect(suggestSlug("  Les Épées d'Argent!! ")).toBe("les-epees-d-argent");
    expect(suggestSlug("x".repeat(40))).toHaveLength(30);
  });
});

describe("hostConfigFromEnv", () => {
  it("reads and cleans the env", () => {
    expect(
      hostConfigFromEnv({ ROOT_DOMAIN: "https://GuildBook.io/", ALT_DOMAINS: "guildbook.gg, guildbook.io,", DEFAULT_GUILD_SLUG: "", AUTH_COOKIE_DOMAIN: ".guildbook.io" }),
    ).toEqual({ rootDomain: "guildbook.io", altDomains: ["guildbook.gg"], defaultGuildSlug: null, cookieDomain: "guildbook.io" });
    expect(hostConfigFromEnv({})).toEqual({ rootDomain: "localhost", altDomains: [], defaultGuildSlug: null, cookieDomain: null });
  });
});

describe("origins", () => {
  it("finds the apex from any host", () => {
    expect(apexOrigin(prod, { protocol: "https:", host: "osm.guildbook.io" })).toBe("https://guildbook.io");
    expect(apexOrigin(prod, { protocol: "https:", host: "orderofsaintmichael.com" })).toBe("https://guildbook.io");
    expect(apexOrigin(dev, { protocol: "http:", host: "osm.localhost:3000" })).toBe("http://localhost:3000");
    expect(apexOrigin(dev, { protocol: "http:", host: "localhost:3100" })).toBe("http://localhost:3100");
    expect(apexOrigin(devNoDefault, { protocol: "http:", host: "osm.localhost:3000" })).toBe("http://localhost:3000");
    expect(apexOrigin(prod, { protocol: "https:", host: "gb-git-x.vercel.app" })).toBe("https://gb-git-x.vercel.app");
  });

  it("builds guild subdomain origins", () => {
    expect(guildSubdomainOrigin("osm", prod, { protocol: "https:", host: "guildbook.io" })).toBe("https://osm.guildbook.io");
    expect(guildSubdomainOrigin("osm", dev, { protocol: "http:", host: "localhost:3000" })).toBe("http://osm.localhost:3000");
  });

  it("knows which hosts share the session cookie", () => {
    expect(sharesSessionCookie("guildbook.io", prod)).toBe(true);
    expect(sharesSessionCookie("osm.guildbook.io", prod)).toBe(true);
    expect(sharesSessionCookie("orderofsaintmichael.com", prod)).toBe(false);
    expect(sharesSessionCookie("evilguildbook.io", prod)).toBe(false);
    expect(sharesSessionCookie("osm.localhost:3000", dev)).toBe(false);
  });

  it("treats only loopback and private addresses as local", () => {
    expect(isLocalHost("localhost:3000")).toBe(true);
    expect(isLocalHost("osm.localhost")).toBe(true);
    expect(isLocalHost("127.0.0.1")).toBe(true);
    expect(isLocalHost("192.168.1.20:3000")).toBe(true);
    expect(isLocalHost("8.8.8.8")).toBe(false);
    expect(isLocalHost("localhost.evil.com")).toBe(false);
  });
});

describe("validateRedirectTarget", () => {
  const base = "https://guildbook.io";
  const rules = { config: prod };

  it("accepts same-origin paths", () => {
    expect(validateRedirectTarget("/create", base, rules)).toBe("https://guildbook.io/create");
    expect(validateRedirectTarget("/guilds?x=1#top", base, rules)).toBe("https://guildbook.io/guilds?x=1#top");
  });

  it("accepts the apex and guild subdomains over https", () => {
    expect(validateRedirectTarget("https://guildbook.io/", base, rules)).toBe("https://guildbook.io/");
    expect(validateRedirectTarget("https://osm.guildbook.io/apply", base, rules)).toBe("https://osm.guildbook.io/apply");
  });

  it("rejects foreign hosts and look-alikes", () => {
    for (const raw of [
      "https://evil.com/",
      "https://guildbook.io.evil.com/",
      "https://evilguildbook.io/",
      "https://guildbook.gg/",
      "//evil.com/",
      "/\\evil.com",
      "https:evil.com",
      "javascript:alert(1)",
      "data:text/html,hi",
      "https://user:pass@osm.guildbook.io/",
      "https://osm.guildbook.io:8443/",
      "http://osm.guildbook.io/",
      "https://api.guildbook.io/",
      "https://a.b.guildbook.io/",
      "http://localhost:3000/",
      "http://127.0.0.1/",
      "http://8.8.8.8/",
      "",
      null,
      undefined,
    ]) {
      expect(validateRedirectTarget(raw, base, rules), String(raw)).toBeNull();
    }
  });

  it("accepts verified custom domains only", () => {
    const withCustom = { config: prod, isVerifiedCustomDomain: (h: string) => h === "orderofsaintmichael.com" };
    expect(validateRedirectTarget("https://orderofsaintmichael.com/", base, withCustom)).toBe("https://orderofsaintmichael.com/");
    expect(validateRedirectTarget("https://unverified.com/", base, withCustom)).toBeNull();
    expect(validateRedirectTarget("https://orderofsaintmichael.com/", base, rules)).toBeNull();
  });

  it("allows local hosts from a local request", () => {
    const local = "http://localhost:3000";
    expect(validateRedirectTarget("http://osm.localhost:3000/admin", local, { config: dev })).toBe("http://osm.localhost:3000/admin");
    expect(validateRedirectTarget("http://localhost:3000/", local, { config: dev })).toBe("http://localhost:3000/");
    expect(validateRedirectTarget("http://api.localhost:3000/", local, { config: dev })).toBeNull();
    expect(validateRedirectTarget("https://evil.com/", local, { config: dev })).toBeNull();
  });
});
