import { ActionForm, FormMessage, SubmitButton } from "@/components/action-form";
import { VISIBILITIES, VISIBILITY_LABELS, type Visibility } from "@/lib/vigil/visibility";
import { setVigilDefaultVisibilityAction, setVigilVisibilityAction } from "@/server/actions/vigil";

function VisibilitySelect({ value, label }: { value: Visibility; label: string }) {
  return (
    <select name="visibility" defaultValue={value} aria-label={label} className="field min-h-9 w-auto py-1 text-sm">
      {VISIBILITIES.map((v) => (
        <option key={v} value={v}>
          {v === "private" ? "Private (only me)" : VISIBILITY_LABELS[v]}
        </option>
      ))}
    </select>
  );
}

export function ReportVisibilityForm({ slug, id, value }: { slug: string; id: string; value: Visibility }) {
  return (
    <ActionForm action={setVigilVisibilityAction.bind(null, slug, id)} className="flex flex-wrap items-center gap-2">
      <VisibilitySelect value={value} label="Who can see this report" />
      <SubmitButton size="sm" variant="ghost">
        Save sharing
      </SubmitButton>
      <FormMessage className="w-full" />
    </ActionForm>
  );
}

export function DefaultVisibilityForm({ slug, value }: { slug: string; value: Visibility }) {
  return (
    <ActionForm action={setVigilDefaultVisibilityAction.bind(null, slug)} className="flex flex-wrap items-center gap-3">
      <VisibilitySelect value={value} label="Default sharing for new reports" />
      <label className="flex items-center gap-2 text-sm text-muted">
        <input type="checkbox" name="applyToExisting" className="accent-[var(--color-gold)]" />
        Apply to all my reports
      </label>
      <SubmitButton size="sm" variant="ghost">
        Save
      </SubmitButton>
      <FormMessage className="w-full" />
    </ActionForm>
  );
}
