/** "By signing in you agree..." for login pages. `apexOrigin` is "" on the apex itself. */
export function LegalConsent({ apexOrigin = "" }: { apexOrigin?: string }) {
  return (
    <p className="mt-4 text-xs leading-relaxed text-muted" data-testid="legal-consent">
      By signing in you agree to the Guildbook{" "}
      <a href={`${apexOrigin}/terms`} className="link">
        Terms of Service
      </a>{" "}
      and{" "}
      <a href={`${apexOrigin}/privacy`} className="link">
        Privacy Policy
      </a>
      .
    </p>
  );
}
