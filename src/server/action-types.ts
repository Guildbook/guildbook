/**
 * What a form's server action returns. `ActionForm` shows a success `message` as a toast (and inline where the form
 * renders `FormMessage`), and toasts an `error` unless a field error points at the problem. Actions that redirect
 * return nothing to the form, so they queue their toast with `setFlash` from `@/server/flash`.
 */
export type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[] | undefined>; suggestions?: Record<string, string[]> };
