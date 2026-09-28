"use client";

import { useEffect, useState } from "react";
import { ActionForm, Field, FieldError, FormMessage, SubmitButton, useActionResult } from "@/components/action-form";
import { FactionChoice } from "@/components/faction-choice";
import { PresetChoices } from "@/components/rank-preset-choices";
import { RegionChoice } from "@/components/region";
import { RulesetChoice } from "@/components/ruleset";
import { SLUG_MAX, slugProblem, suggestSlug } from "@/lib/hosts";
import { DEFAULT_RANK_PRESET } from "@/lib/rank-presets";
import { checkSlugAction, createGuildAction } from "@/server/actions/platform";

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Phoenix",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Stockholm",
  "Europe/Moscow",
  "Asia/Seoul",
  "Asia/Taipei",
  "Australia/Perth",
  "Australia/Sydney",
];

const PROBLEM_TEXT = {
  length: "Use 3 to 30 characters",
  characters: "Lowercase letters, numbers and single hyphens",
  reserved: "That name is reserved",
} as const;

type Availability =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "available" }
  | { state: "taken"; reason: string; suggestions: string[] };

/** Summary labels for every field `createGuildInput` validates. */
export const CREATE_GUILD_LABELS = {
  name: "Guild name",
  slug: "Subdomain",
  region: "Region",
  faction: "Faction",
  ruleset: "Ruleset",
  timezone: "Timezone",
  motto: "Motto",
  directoryListed: "Directory listing",
  rankPreset: "Starting ranks",
} as const;

/** The server's subdomain error, until the subdomain is edited. */
function SlugError({ slug }: { slug: string }) {
  const result = useActionResult();
  const [rejected, setRejected] = useState<string | null>(null);
  useEffect(() => {
    // Remember which subdomain the server rejected; only a new result can change it.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRejected(result && !result.ok && result.fieldErrors?.slug ? slug : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);
  return <FieldError name="slug" stale={rejected !== null && rejected !== slug} />;
}

/** The live availability line; blank while the server's inline error already says the same thing. */
function SlugStatus({ status }: { status: { tone: string; text: string } | null }) {
  const result = useActionResult();
  const serverError = result && !result.ok ? result.fieldErrors?.slug?.[0] : undefined;
  const text = status && status.text !== serverError ? status.text : null;
  return (
    <p id="slug-status" className={`mt-1 min-h-4 text-xs ${status?.tone ?? ""}`} role="status" data-testid="slug-status">
      {text}
    </p>
  );
}

/** Free subdomains to pick from: the live check's, or the server's after a rejected submit. */
function SlugSuggestions({ live, onPick }: { live: string[]; onPick: (slug: string) => void }) {
  const result = useActionResult();
  const fromServer = result && !result.ok ? (result.suggestions?.slug ?? []) : [];
  const suggestions = live.length > 0 ? live : fromServer;
  if (suggestions.length === 0) return null;
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs" data-testid="slug-suggestions">
      <span className="text-muted">Try</span>
      {suggestions.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onPick(s)}
          className="rounded border border-line px-2 py-0.5 font-mono text-bone hover:border-gold-dim hover:text-gold"
        >
          {s}
        </button>
      ))}
    </div>
  );
}

export function CreateGuildForm({ hostPrefix, hostSuffix }: { hostPrefix: string; hostSuffix: string }) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [region, setRegion] = useState("us");
  const [faction, setFaction] = useState("");
  const [ruleset, setRuleset] = useState("");
  const [timezone, setTimezone] = useState("America/New_York");
  const [timezones, setTimezones] = useState(TIMEZONES);
  const [motto, setMotto] = useState("");
  const [listed, setListed] = useState(false);
  const [availability, setAvailability] = useState<Availability>({ state: "idle" });

  useEffect(() => {
    const local = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!local) return;
    // Syncing with the browser's timezone, which is only known after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTimezone(local);
    setTimezones((list) => (list.includes(local) ? list : [local, ...list]));
  }, []);

  const problem = slug ? slugProblem(slug) : null;

  useEffect(() => {
    if (!slug || (problem && problem !== "reserved")) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setAvailability({ state: "checking" });
      const result = await checkSlugAction(slug, { region, faction, ruleset });
      if (cancelled) return;
      setAvailability(
        result.available ? { state: "available" } : { state: "taken", reason: result.reason, suggestions: result.suggestions ?? [] },
      );
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [slug, problem, region, faction, ruleset]);

  const status = !slug
    ? null
    : problem
      ? { tone: "text-red-300", text: PROBLEM_TEXT[problem] }
      : availability.state === "available"
        ? { tone: "text-emerald-300", text: "Available" }
        : availability.state === "taken"
          ? { tone: "text-red-300", text: availability.reason }
          : { tone: "text-muted", text: "Checking…" };

  return (
    <ActionForm action={createGuildAction} className="space-y-5" labels={CREATE_GUILD_LABELS}>
      <Field label="Guild name" name="name">
        <input
          id="name"
          name="name"
          className="field"
          required
          maxLength={60}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (!slugEdited) setSlug(suggestSlug(e.target.value));
          }}
          placeholder="Order of the Silver Dawn"
        />
      </Field>

      <div>
        <label htmlFor="slug" className="field-label">
          Subdomain
        </label>
        <div className="flex items-stretch overflow-hidden rounded border border-line bg-ink focus-within:outline-2 focus-within:outline-gold-dim">
          {hostPrefix && <span className="flex items-center pl-3 font-mono text-sm text-muted">{hostPrefix}</span>}
          <input
            id="slug"
            name="slug"
            className="min-h-11 min-w-0 flex-1 bg-transparent px-3 font-mono text-bone outline-none"
            required
            maxLength={SLUG_MAX}
            value={slug}
            onChange={(e) => {
              setSlugEdited(true);
              setSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"));
            }}
            autoComplete="off"
            spellCheck={false}
            aria-describedby="slug-status"
          />
          <span className="flex items-center pr-3 font-mono text-sm text-muted">{hostSuffix}</span>
        </div>
        <SlugStatus status={status} />
        <SlugSuggestions
          live={!problem || problem === "reserved" ? (availability.state === "taken" ? availability.suggestions : []) : []}
          onPick={(picked) => {
            setSlugEdited(true);
            setSlug(picked);
          }}
        />
        <SlugError slug={slug} />
      </div>

      <fieldset>
        <legend className="field-label">Region</legend>
        <RegionChoice value={region} onChange={setRegion} />
        <p className="mt-1 text-xs text-muted">Americas and Europe are separate worlds with their own characters and guilds.</p>
        <FieldError name="region" />
      </fieldset>

      <fieldset>
        <legend className="field-label">Faction</legend>
        <FactionChoice value={faction} onChange={setFaction} />
        <p className="mt-1 text-xs text-muted">Guilds are faction-locked in game, so a guild site has one faction too.</p>
        <FieldError name="faction" />
      </fieldset>

      <fieldset>
        <legend className="field-label">Ruleset</legend>
        <RulesetChoice value={ruleset} onChange={setRuleset} />
        <p className="mt-1 text-xs text-muted">
          WoW: Forever has no realms: your guild lives on one ruleset. Name, region, faction and ruleset together identify your guild, and
          must match the in-game guild to verify it.
        </p>
        <FieldError name="ruleset" />
      </fieldset>

      <Field label="Timezone" name="timezone" hint="Raid times are shown in this timezone.">
        <select id="timezone" name="timezone" className="field" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
          {timezones.map((tz) => (
            <option key={tz} value={tz}>
              {tz.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Motto" name="motto" hint="Optional. Shown under your guild's name.">
        <input id="motto" name="motto" className="field" maxLength={120} value={motto} onChange={(e) => setMotto(e.target.value)} placeholder="Steel and patience" />
      </Field>

      <fieldset>
        <legend className="field-label">Starting ranks</legend>
        <PresetChoices name="rankPreset" defaultKey={DEFAULT_RANK_PRESET} />
        <p className="mt-1 text-xs text-muted">A starting point. You can rename, add and reorder ranks later to match your guild in game.</p>
        <FieldError name="rankPreset" />
      </fieldset>

      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="directoryListed" checked={listed} onChange={(e) => setListed(e.target.checked)} className="mt-0.5 h-5 w-5 accent-gold" />
        <span>
          List the guild in the public Guildbook directory
          <span className="block text-xs text-muted">
            Listing starts when you publish the guild. You can change this any time in the guild&apos;s settings.
          </span>
        </span>
      </label>
      <FieldError name="directoryListed" />

      <FormMessage />
      <SubmitButton variant="gold" pendingLabel="Creating…">
        Create guild
      </SubmitButton>
    </ActionForm>
  );
}
