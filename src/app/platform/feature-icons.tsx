import type { ReactNode } from "react";

/** Line icons for the apex feature list, drawn on a 24px grid in the current text colour. */
function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="h-5 w-5"
    >
      {children}
    </svg>
  );
}

export const FEATURE_ICONS = {
  address: (
    <Icon>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3a13 13 0 0 0 0 18 13 13 0 0 0 0-18" />
      <path d="M3 12h18" />
    </Icon>
  ),
  applications: (
    <Icon>
      <rect x="8" y="2.5" width="8" height="4" rx="1" />
      <path d="M16 4.5h2a2 2 0 0 1 2 2V20a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6.5a2 2 0 0 1 2-2h2" />
      <path d="m9 14 2 2 4-4" />
    </Icon>
  ),
  roster: (
    <Icon>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </Icon>
  ),
  raids: (
    <Icon>
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M3 10h18" />
      <path d="m9.5 16 1.75 1.75L15 14" />
    </Icon>
  ),
  charter: (
    <Icon>
      <path d="M15 12h-5" />
      <path d="M15 8h-5" />
      <path d="M19 17V5a2 2 0 0 0-2-2H4" />
      <path d="M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3" />
    </Icon>
  ),
  vigil: (
    <Icon>
      <path d="M22 12h-2.5a2 2 0 0 0-1.9 1.5l-2.4 8.3a.25.25 0 0 1-.5 0L9.3 2.2a.25.25 0 0 0-.5 0L6.4 10.5A2 2 0 0 1 4.5 12H2" />
    </Icon>
  ),
} satisfies Record<string, ReactNode>;

export type FeatureIcon = keyof typeof FEATURE_ICONS;
