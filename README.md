# Guildbook

**Guildbook** hosts guild sites for World of Warcraft: Forever at `{slug}.guildbook.io`. Its first guild is the **Order of Saint Michael**, a Catholic raiding guild (*Quis ut Deus*), which keeps its own crest, ranks, prayer and lore. Guilds created on Guildbook start from a neutral template.

Built with Next.js (App Router, strict TypeScript), Tailwind CSS v4, Postgres with Drizzle ORM, Auth.js (Discord), Zod, Vitest and Playwright. Deploys to Vercel with Neon Postgres.

## Setup

Requirements: Node 22+, pnpm 10+, Docker (or any Postgres 15+).

```bash
pnpm install
cp .env.example .env.local        # then fill in the values below
pnpm db:up                        # local Postgres 17 on port 5434 (docker compose)
pnpm db:migrate                   # apply all migrations
pnpm db:seed                      # demo guild: 25 members, raids, applicants, addons
pnpm dev                          # apex http://localhost:3000, the Order http://osm.localhost:3000
```

`pnpm db:reseed` wipes and recreates the demo guild.

Local hosts (no `/etc/hosts` edits needed; browsers resolve `*.localhost` to your machine):

| URL | Serves |
|---|---|
| `http://localhost:3000` | The Guildbook apex: landing, sign-in, create a guild, directory (like `guildbook.io`) |
| `http://www.localhost:3000` | Redirects to `http://localhost:3000`, keeping the path (like `www.guildbook.io`) |
| `http://osm.localhost:3000` | The Order of Saint Michael on its subdomain (like `osm.guildbook.io`); any `{slug}.localhost` is that guild |

Sign-in always happens on `localhost:3000`, where the Discord redirect URI is registered, and hands the session to `*.localhost` (see Sign-in below).

### Signing in locally without a Discord app

Set `AUTH_TEST_MODE=1` in `.env.local`. The login page (`http://osm.localhost:3000/login` sends you to the apex login with the Order as the destination) then shows a test form. Pick a seeded account or enter a seeded Discord ID to sign in as that member:

| Discord ID | Rank | Tier |
|---|---|---|
| `seed-tor` | Grand Master | Admin |
| `seed-ironvow` | Marshal | Officer |
| `seed-cassian` | Knight | Raider |
| `seed-perpetua` | Squire | Member |
| `seed-joanofarc` | Postulant (pending application) | Applicant |

Any other ID creates a new user with no membership. Test mode must never be enabled in production; the app refuses to start if `AUTH_TEST_MODE=1` and `VERCEL_ENV=production`.

### Discord OAuth

1. Create an application at <https://discord.com/developers/applications>.
2. Under **OAuth2**, add redirect URIs `http://localhost:3000/api/auth/callback/discord` and `https://guildbook.io/api/auth/callback/discord`. Guild subdomains and custom domains never run OAuth themselves; they send sign-in to the apex, so no per-guild URIs are needed.
3. Copy the client ID and secret into `AUTH_DISCORD_ID` and `AUTH_DISCORD_SECRET`.

### Battle.net character verification

Members sign in with Discord. Battle.net is linked afterwards, from Apply or My Characters, so applicants can pick a character whose name, class and level come from Blizzard (officers see **Verified via Battle.net**), and members can import verified characters whose levels sync automatically. Manual entry always remains and is marked **Unverified**.

1. Sign in at <https://develop.battle.net/access/clients> and choose **Create client**.
2. Add redirect URLs `http://localhost:3000/api/battlenet/callback` and `https://guildbook.io/api/battlenet/callback`. Linking started on a guild subdomain or custom domain bounces to the apex and returns to the guild afterwards (the return URL is checked against the same allowlist as sign-in). The redirect URI must match exactly; set `BATTLENET_REDIRECT_URI=https://guildbook.io/api/battlenet/callback` in production.
3. Copy the client ID and secret into `BATTLENET_CLIENT_ID` and `BATTLENET_CLIENT_SECRET`, and set `BATTLENET_REGION` (default `us`).
4. Set `BATTLENET_TOKEN_KEY` to `openssl rand -base64 32`. Access tokens are stored AES-256-GCM encrypted with it.
5. Set `CRON_SECRET` (`openssl rand -hex 32`) in Vercel. `vercel.json` schedules `/api/cron/daily`, which deletes withdrawn and declined applications older than `APPLICATION_RETENTION_DAYS` and then runs the level sync; Vercel sends the secret as a Bearer token.

How it works:
- The OAuth flow (`/api/battlenet/link` then `/api/battlenet/callback`, scope `wow.profile`) links the Battle.net account to the signed-in user. It is not a login method.
- Blizzard access tokens last about 24 hours and there is no refresh token. At link time we snapshot the account's characters; applications and imports are verified against that stored snapshot, never against what the browser sends. While the token is valid, "Refresh characters" re-reads the list; after that, "Reconnect" runs the OAuth flow again.
- The level sync (daily cron and the officer **Sync now** button on Admin, Members) uses an app (client-credentials) token and public profile lookups, or one guild-roster request when `BATTLENET_GUILD_REALM` and `BATTLENET_GUILD_SLUG` are set. It doesn't need the member's token.
- Battle.net doesn't expose WoW: Forever surnames (as far as we know), so the surname stays editable text. If the API starts returning one, it's used and locked.
- Link, unlink, refresh, import and sync are written to the audit log.

**The profile namespace is unknown until launch.** WoW: Forever may use `profile-classic1x-us` (the default, as Classic Era does), `profile-classic-us`, or retail `profile-us`. After launch, link a test account; if no characters appear, change `BATTLENET_PROFILE_NAMESPACE` (use `{region}` as a placeholder) and redeploy. No code change is needed.

**Mock mode.** `BATTLENET_MOCK=1` replaces Blizzard with fixture characters (Aldric, Brenna and Corwin for the Alliance, a Horde warrior and a Death Knight that are filtered out). Linking skips the Battle.net page. Playwright always runs in mock mode, and the Vitest suites inject a fake `fetch`; no test calls Blizzard. The app refuses mock mode when `VERCEL_ENV=production`.

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | yes | Postgres connection string. Local Docker: `postgres://osm:osm@localhost:5434/osm`. Neon: the pooled connection string. |
| `AUTH_SECRET` | yes | Random secret for Auth.js (`openssl rand -base64 32`). |
| `AUTH_DISCORD_ID` / `AUTH_DISCORD_SECRET` | yes | Discord OAuth application credentials. |
| `AUTH_TRUST_HOST` | on Vercel | `true` so Auth.js trusts the forwarded host. |
| `ROOT_DOMAIN` | in production | `guildbook.io`. Guilds are served at `{slug}.ROOT_DOMAIN`. Empty means `localhost`. |
| `ALT_DOMAINS` | no | Comma-separated domains that 308-redirect to `ROOT_DOMAIN`, keeping subdomain and path. Empty for now; `guildbook.gg` if it is added later. |
| `AUTH_COOKIE_DOMAIN` | in production | `guildbook.io`: the session cookie is set on `.guildbook.io`, so one sign-in covers every guild subdomain. Leave empty locally. |
| `DEFAULT_GUILD_SLUG` | no | Guild served on hosts that are neither the apex nor a guild (`*.vercel.app` previews, IP addresses). Empty serves the apex there. Bare `localhost` is always the apex. Leave empty in production. |
| `NEXT_PUBLIC_MULTI_GUILD` | no | Legacy dev fallback: `true` serves guilds at `/<slug>/...` on one host. |
| `GUILD_CREATE_LIMIT` / `GUILD_CREATE_DAILY_LIMIT` | no | Guilds one user may create in total (default 3) and per rolling day (default 2). |
| `VERCEL_TOKEN` / `VERCEL_PROJECT_ID` / `VERCEL_TEAM_ID` | no | Lets custom domains be attached and checked through the Vercel Domains API. Without them, domains are verified by TXT record only and attached in Vercel by hand. |
| `BATTLENET_CLIENT_ID` / `BATTLENET_CLIENT_SECRET` | for Battle.net | develop.battle.net client credentials. Without them (and without mock mode) the Battle.net options are hidden. |
| `BATTLENET_REGION` | no | `us` (default), `eu`, `kr`, `tw` or `cn`. |
| `BATTLENET_TOKEN_KEY` | for Battle.net | 32 bytes, base64. Encrypts stored access tokens. |
| `BATTLENET_PROFILE_NAMESPACE` | no | Profile API namespace, default `profile-classic1x-{region}`. See above. |
| `BATTLENET_STATIC_NAMESPACE` | no | Game Data namespace for loot item names and icons, default `static-classic1x-{region}`. See Loot ledger. |
| `BATTLENET_GUILD_REALM` / `BATTLENET_GUILD_SLUG` | no | In-game guild for one-request roster syncs. |
| `BATTLENET_REDIRECT_URI` | no | Overrides `<origin>/api/battlenet/callback`. |
| `BATTLENET_MOCK` | dev/test only | `1` serves fixture characters instead of calling Blizzard. |
| `CRON_SECRET` | on Vercel | Bearer secret for `/api/cron/daily` and `/api/cron/battlenet-sync`. |
| `APPLICATION_RETENTION_DAYS` | no | Days before withdrawn and declined applications are deleted (default 180). Shown in the privacy policy. |
| `AUTH_TEST_MODE` | dev/test only | `1` enables the test-login provider used by Playwright. |
| `E2E_DATABASE_URL` | no | Database for Playwright runs (defaults to `DATABASE_URL`). **It is wiped and reseeded.** |

## Migration workflow

The schema lives in `src/db/schema.ts`. Migrations are SQL files in `drizzle/`, generated and applied with drizzle-kit. Don't use `drizzle-kit push`.

1. Edit `src/db/schema.ts`.
2. `pnpm db:generate --name <short_description>` writes `drizzle/NNNN_<name>.sql` and updates `drizzle/meta/`.
3. Review the SQL. For things Drizzle can't express (triggers, functions), create an empty migration with `pnpm drizzle-kit generate --custom --name <name>` and write the SQL by hand, separating statements with `--> statement-breakpoint`.
4. `pnpm db:migrate` applies pending migrations to `DATABASE_URL`.
5. Commit the schema change, the SQL file and `drizzle/meta` together.

Production: run `DATABASE_URL=<neon-url> pnpm db:migrate` before (or as part of) promoting a deployment. Use a direct (non-pooled) Neon URL for migrations if the pooler rejects DDL. Migration `0009_guildbook_platform` adds `guild_domains` and the guild `preset`, `directory_listed` and `created_by_user_id` columns, and marks existing guilds with the Order preset so their content is unchanged.

## Guildbook hosting

**Routing.** `src/proxy.ts` reads the `Host` header (logic in `src/lib/hosts.ts`, unit-tested):

| Host | Result |
|---|---|
| `guildbook.io` | Platform pages from `src/app/platform/` (landing, `/login`, `/create`, `/guilds`) |
| `www.guildbook.io`, and any `ALT_DOMAINS` host with its subdomains | 308 to the same name and path on `guildbook.io` |
| `{slug}.guildbook.io` | Rewritten onto `src/app/[guild]/`. Links carry no slug (`guildHref` only prefixes in the legacy path mode) |
| Reserved subdomains (`www`, `app`, `api`, `auth`, `admin`, `mail`, `static`, `assets`, `docs`, `status`, `blog` and more) | Redirect to the apex. They can never be guild slugs |
| Any other host | Looked up in `guild_domains` (verified only, cached per instance for 60 s). Unknown hosts get the default guild or the apex |
| `localhost`, `www.localhost`, `{slug}.localhost` (dev) | The apex, a redirect to the apex, and guilds, mirroring the rows above |

**Sign-in.** All OAuth happens on the apex. A guild's `/login` redirects to `guildbook.io/login?callbackUrl=<guild URL>`. `callbackUrl` (and the Auth.js `redirect` callback, and the Battle.net `returnTo`) must be a same-origin path, the apex, a non-reserved guild subdomain over https, or a verified custom domain; anything else falls back to the apex, so there are no open redirects. The session cookie is set on `.guildbook.io` (`AUTH_COOKIE_DOMAIN`), so subdomains share it. Custom domains can't share that cookie, so the apex hands the session over once: `/api/handoff/start` mints a 60-second HMAC-signed token bound to the target host and stored (hashed) for one use; the custom domain's `/api/handoff/complete` redeems it and sets its own host-only session cookie. Locally, browsers refuse `Domain=localhost` cookies, so `*.localhost` uses the same handoff.

**Creating a guild.** Signed-in users create guilds at `guildbook.io/create`: name, subdomain (live availability check), faction, timezone, motto and directory opt-in. The creator becomes Guild Master (Admin tier) and lands on `{slug}.guildbook.io/admin`. New guilds use the neutral `standard` preset (Guild Master, Officer, Raider, Member, Trial, Applicant; a plain charter, loot policy and "Our story" page; a monogram shield). The Order's Catholic ranks, prayer, lore, crest and copy belong to the `order` preset only. Creation is limited per user (`GUILD_CREATE_LIMIT`, `GUILD_CREATE_DAILY_LIMIT`) and rate-limited.

**Custom domains.** Guild admins add a domain under Admin, Guild. The page shows the records to create: an A record to `76.76.21.21` (apex domains) or a CNAME to `cname.vercel-dns.com` (subdomains), plus a TXT record `_guildbook.<domain>` with a per-domain token. **Check verification** requires the TXT token (so nobody can claim a domain another guild set up) and, when `VERCEL_TOKEN` and `VERCEL_PROJECT_ID` are set, that Vercel has the domain attached, verified and correctly configured. Only verified domains are routed, and a guild's first verified domain becomes its canonical URL.

**Vigil companion.** Pairing uses the address the member opened Vigil on, so the companion's site URL becomes the guild's subdomain (for example `https://osm.guildbook.io`), or its custom domain.

### Deploying Guildbook on Vercel

1. **Nameservers.** In the Vercel dashboard, add `guildbook.io` to the team and point the registrar's nameservers at Vercel (`ns1.vercel-dns.com`, `ns2.vercel-dns.com`). Wildcard domains need Vercel DNS.
2. **Domains on the project.** Add `guildbook.io` and `*.guildbook.io` to the project. Add `www.guildbook.io` too (the app redirects it).
3. **Adding guildbook.gg later.** Add `guildbook.gg` and `*.guildbook.gg` to the project and set `ALT_DOMAINS=guildbook.gg`; the app 308-redirects them to `.io`, keeping the subdomain and path. To make `.gg` primary instead, set `ROOT_DOMAIN=guildbook.gg`, `AUTH_COOKIE_DOMAIN=guildbook.gg`, `ALT_DOMAINS=guildbook.io` and add the `.gg` OAuth redirect URIs. No code changes either way.
4. **Environment variables** (Production): `ROOT_DOMAIN=guildbook.io`, `AUTH_COOKIE_DOMAIN=guildbook.io`, `ALT_DOMAINS` empty, `AUTH_TRUST_HOST=true`, `BATTLENET_REDIRECT_URI=https://guildbook.io/api/battlenet/callback`, and leave `DEFAULT_GUILD_SLUG` empty. Optional: `VERCEL_TOKEN` (a token scoped to the team), `VERCEL_PROJECT_ID`, `VERCEL_TEAM_ID`, and the creation limits. Previews (`*.vercel.app`) serve the apex, or `DEFAULT_GUILD_SLUG` if you set one for the Preview environment.
5. **OAuth apps.** The Discord app already has `https://guildbook.io/api/auth/callback/discord`. Add `https://guildbook.io/api/battlenet/callback` to the Battle.net client.
6. **Database.** `DATABASE_URL=<neon-direct-url> pnpm db:migrate`, then `DATABASE_URL=<neon-direct-url> pnpm db:bootstrap`, which creates the Order of Saint Michael (ranks, charter, lore, schedule, raids, addons) with no members or demo data, and does nothing if it already exists. Deploy, and the Order is at `osm.guildbook.io`. Never run `pnpm db:seed` against production.
7. **Guild leader.** After signing in on `guildbook.io` with Discord once, run `DATABASE_URL=<neon-direct-url> pnpm guild:grant-owner --guild osm --discord <Discord user ID or username>`. It makes that user an active member at the top admin rank (Grand Master) and records it in the audit log.

## Testing

```bash
pnpm test        # Vitest: unit tests + integration tests on in-memory Postgres (PGlite), real migrations applied
pnpm test:e2e    # Playwright on mobile + desktop viewports; starts `pnpm dev` with AUTH_TEST_MODE=1 and reseeds
pnpm typecheck
pnpm lint
```

The integration tests need no database server. Each file boots PGlite and runs every migration, so the triggers and composite foreign keys are tested too.

## Architecture

**Guild scoping.** Every table except `users` and the Auth.js tables has a `guild_id`, and every service query filters by it. Child tables reference their parent through a composite `(guild_id, id)` foreign key, so Postgres rejects a row that points at another guild's data even if application code gets it wrong. All guild pages live under `src/app/[guild]/`, and `src/proxy.ts` rewrites each guild's host onto them (`osm.guildbook.io/roster` renders `/osm/roster`). Build links with `guildHref()` so the legacy path-prefixed mode keeps working.

**Permissions.** Ranks are rows in `ranks` (name, sort order, description, permission tier), so officers can rename and reorder them freely. Renaming or reordering never changes permissions; only the tier does. `src/lib/authz/policy.ts` holds the one `POLICY` map from action to minimum tier, plus `can`/`assertCan`. Every service function calls `assertCan(actor, action)` first. The actor's tier is read from the database on each request, never from the session. The UI uses `can()` only to decide what to render. Additional rules:
- nobody grants a tier above their own;
- officers can't change peers or superiors;
- the last active Admin can't be demoted or removed;
- at most 10 ranks may be marked in-game (the WoW limit).

**Audit log.** Officer actions write to `audit_log` in the same transaction as the change. A trigger rejects `UPDATE` and `DELETE` on that table.

**Loot ledger.** `loot_entries` is append-only too, through the generic `append_only_guard()` trigger (`drizzle/0013_loot_ledger_guard.sql`). A mistake is corrected by a reversal row (with a reason), never an edit. The guard allows three exceptions: reference columns may become NULL when what they point at is deleted; with `guildbook.audit_redact` on, account deletion may replace the recipient name and note with "Deleted user"; and with `guildbook.audit_purge_guild` set, a guild deletion (and the demo reseed) may delete that guild's rows.
- Members see the ledger at `/members/loot`, per raid night and on each character page. A guild can make it public in Guild Settings (off by default). Officers record awards and reversals at `/admin/loot`.
- **Imports** (`/admin/loot/import`): Gargul JSON, TMB CSV and custom-format exports, and RCLootCouncil CSV and JSON. Parsers live in `src/lib/loot/parsers/` behind one registry with auto-detection. An import is parsed into a draft for review: officers match each name to a character (remembered for next time), keep a pug's name, or leave it out. Committing skips awards already recorded, keyed on the tool's own award ID (Gargul's checksum is shared by its JSON and TMB exports), or on a hash of item, player and minute when there is none. Drafts are deleted after a week.
- **Item data** (`wow_items`, shared across guilds): names and qualities from imports and officer entry come first. Blizzard's Game Data API only fills gaps (names missing from an export, icons), in the `BATTLENET_STATIC_NAMESPACE` namespace, and only with real Battle.net credentials. Per Blizzard's API terms, the daily cron refreshes Blizzard data after 25 days and deletes anything it couldn't refresh within 30, and pages that show it credit Blizzard. Item icons are hotlinked from Blizzard's render CDN, never stored. Items link to Wowhead; there is no Wowhead tooltip script.
- No DKP, EPGP or GDKP: entries have no cost.

**Layout.**

```
src/app/[guild]/        guild pages (public, /members, /admin), served on each guild's host
src/app/platform/       Guildbook apex pages (landing, sign-in, create, directory)
src/server/services/    business logic, one function per use case, takes (db, actor, rawInput)
src/server/actions/     thin "use server" wrappers: FormData → service → refresh
src/lib/validation.ts   Zod schemas for every form and service input
src/lib/authz/          tiers + policy (pure, unit-tested)
src/db/                 schema, client, seed data
drizzle/                SQL migrations
tests/                  integration tests (PGlite); e2e/ Playwright
companion/              Vigil companion desktop app (Electron), a separate pnpm project
```

## Vigil companion (desktop)

`companion/` is an Electron app for a second monitor. It tails `WoWCombatLog*.txt`, shows the current fight live (score, GCD use, idle time, uptimes, rotation callouts) and uploads each finished fight to Vigil. It only reads the log file on disk. It never sends input to the game, reads its memory or looks at the screen.

It is a standalone pnpm project (its own `pnpm-workspace.yaml` and lockfile), not a workspace member, so the site's install and Vercel deploy never pull in Electron. `.vercelignore` also leaves it out of the upload. The combat log parser and Vigil analysis are shared rather than copied: esbuild, Vitest and `tsc` resolve `@/` to the site's `src/`.

```bash
pnpm companion:dev     # install companion deps, build, watch and launch (site at http://osm.localhost:3000)
pnpm companion:test    # tailer, engine, paths, uploader and house-style tests
cd companion && pnpm typecheck && pnpm lint
```

To pair, open Vigil, then **Connect Vigil companion**, create a code and enter it in the app's settings (or click **Open in the companion**). The app exchanges it for a device token, stored with Electron `safeStorage` (Keychain on macOS, DPAPI on Windows). Members can revoke devices on the same page.

Without the game, try it with a synthetic log written in real time:

```bash
cd companion
pnpm demo:log /tmp/vigil-demo/Logs                  # terminal 1
VIGIL_LOGS_DIR=/tmp/vigil-demo/Logs pnpm dev         # terminal 2
```

Development-only variables: `VIGIL_LOGS_DIR` (Logs folder), `VIGIL_USER_DATA` (settings folder), `VIGIL_PAIR_CODE` (pair on launch), `VIGIL_CAPTURE_DIR` (save window PNGs every `VIGIL_CAPTURE_EVERY_MS`). Packaged builds ignore the last two.

**Packaging.** Set the production site address at build time:

```bash
cd companion
VIGIL_SITE_URL=https://<site> pnpm dist:mac    # dmg + zip, arm64 and x64, in companion/release/
VIGIL_SITE_URL=https://<site> pnpm dist:win    # NSIS installer, x64
```

Builds are unsigned for now (`mac.identity: null`). Before shipping:
- **macOS:** a Developer ID Application certificate (`CSC_LINK`/`CSC_KEY_PASSWORD`), then remove `identity: null`, set `hardenedRuntime: true` and add notarisation (`APPLE_API_KEY`, `APPLE_API_KEY_ID`, `APPLE_API_ISSUER`, or `APPLE_ID` with an app-specific password and `APPLE_TEAM_ID`). Unsigned builds need right-click, Open on first launch.
- **Windows:** an OV/EV code-signing certificate or Azure Trusted Signing (`win.azureSignOptions`); unsigned installers trigger SmartScreen.
- Build each platform on its own OS (or in CI) so native signing tools are available.

## Roadmap

- **Phase 1 (done):** Discord auth, characters (WoW: Forever first name + required surname, unique on the full name; any class/faction combination; a guild can be locked to one faction in Guild Settings, which hides faction options site-wide; the demo guild is Alliance-only), roster, public pages, applications, officer admin (applications, members, ranks, charter, schedule, recruitment, progression, addons, guild settings, audit log).
- **Phase 2:** raid calendar with signups and composition targets, attendance with 4/8-week percentages, feast-day and rosary events calendar.
- **Phase 3:** append-only loot ledger with reversals, and Gargul and RCLootCouncil import behind a pluggable parser interface (MVP done; guild bank next).
- **Later:** Discord bot (post raids, reaction signups, role sync), Warcraft Logs import.

## License

Guildbook is licensed under the [GNU Affero General Public License v3.0](LICENSE). If you run a modified version as a network service, you must make your source available to its users. The license does not cover Blizzard artwork (the icons in `public/icons/classes/` and `public/icons/factions/`, see their `NOTICE` files) or the bundled fonts (see `scripts/fonts/OFL.txt`).

World of Warcraft and Blizzard Entertainment are trademarks or registered trademarks of Blizzard Entertainment, Inc. This is a non-commercial fan site, not affiliated with or endorsed by Blizzard. It uses no Blizzard logos. The class icons in `public/icons/classes/` are Blizzard artwork (see the `NOTICE` there), and loot item icons are shown from Blizzard's render CDN without being stored.
