import type { RankTier } from "@/lib/authz/tiers";
import type { Insignia } from "@/lib/insignia";

export type RankTemplate = { name: string; description: string; tier: RankTier; insignia: Insignia; inGame: boolean };

export interface RankPreset {
  label: string;
  summary: string;
  ranks: RankTemplate[];
  /** Rank names used for website applicants, accepted applicants and trial members. */
  applicantRank: string;
  acceptRank: string;
  trialRank: string;
}

/**
 * Starter rank ladders for guilds created on Guildbook, each covering every permission tier. Officers rename,
 * reorder and extend them freely under Admin, then Ranks. The Order of Saint Michael keeps its own ladder.
 */
export const RANK_PRESETS = {
  raiding: {
    label: "Raiding",
    summary: "A raid team with a core roster and trials.",
    ranks: [
      { name: "Guild Master", description: "Guild leader", tier: "admin", insignia: "banner", inGame: true },
      { name: "Officer", description: "Runs raids, recruiting and the guild bank", tier: "officer", insignia: "laurel", inGame: true },
      { name: "Raider", description: "Core raider", tier: "raider", insignia: "helm", inGame: true },
      { name: "Member", description: "Member, social or leveling", tier: "member", insignia: "chevron", inGame: true },
      { name: "Trial", description: "Trial member", tier: "member", insignia: "chevron", inGame: true },
      { name: "Applicant", description: "Applicant on the website; not a guild rank in game", tier: "applicant", insignia: "candle", inGame: false },
    ],
    applicantRank: "Applicant",
    acceptRank: "Member",
    trialRank: "Trial",
  },
  social: {
    label: "Social",
    summary: "A community guild for leveling, dungeons and friends.",
    ranks: [
      { name: "Guild Master", description: "Guild leader", tier: "admin", insignia: "banner", inGame: true },
      { name: "Officer", description: "Keeps the guild running and welcomes new members", tier: "officer", insignia: "laurel", inGame: true },
      { name: "Veteran", description: "Long-standing member", tier: "raider", insignia: "helm", inGame: true },
      { name: "Member", description: "Member of the guild", tier: "member", insignia: "chevron", inGame: true },
      { name: "Initiate", description: "New member getting to know the guild", tier: "member", insignia: "chevron", inGame: true },
      { name: "Applicant", description: "Applicant on the website; not a guild rank in game", tier: "applicant", insignia: "candle", inGame: false },
    ],
    applicantRank: "Applicant",
    acceptRank: "Member",
    trialRank: "Initiate",
  },
  roleplay: {
    label: "Roleplay",
    summary: "In-character titles for a roleplaying company.",
    ranks: [
      { name: "Commander", description: "Leads the company", tier: "admin", insignia: "banner", inGame: true },
      { name: "Captain", description: "Leads events and storylines", tier: "officer", insignia: "laurel", inGame: true },
      { name: "Veteran", description: "Trusted member of the company", tier: "raider", insignia: "helm", inGame: true },
      { name: "Sworn", description: "Full member of the company", tier: "member", insignia: "chevron", inGame: true },
      { name: "Recruit", description: "Newly joined, still proving themselves", tier: "member", insignia: "chevron", inGame: true },
      { name: "Petitioner", description: "Applicant on the website; not a guild rank in game", tier: "applicant", insignia: "candle", inGame: false },
    ],
    applicantRank: "Petitioner",
    acceptRank: "Sworn",
    trialRank: "Recruit",
  },
} as const satisfies Record<string, RankPreset>;

export type RankPresetKey = keyof typeof RANK_PRESETS;
export const RANK_PRESET_KEYS = Object.keys(RANK_PRESETS) as RankPresetKey[];
export const DEFAULT_RANK_PRESET: RankPresetKey = "raiding";

export function isRankPresetKey(value: unknown): value is RankPresetKey {
  return typeof value === "string" && Object.hasOwn(RANK_PRESETS, value);
}
