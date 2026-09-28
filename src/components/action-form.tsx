"use client";

import clsx from "clsx";
import { createContext, type ReactNode, useActionState, useContext, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { consumeFlash } from "@/components/toaster";
import { toast } from "@/lib/toast";
import type { ActionResult } from "@/server/action-types";

type FormAction = (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>;

const ResultContext = createContext<ActionResult | null>(null);

/**
 * A success `message` also shows as a toast, as does an error with no field to point at. The success toast is raised
 * as soon as the action resolves, before `refresh()` re-renders the page, because that re-render often unmounts the
 * form. Actions that `redirect()` never resolve here and use `setFlash` instead, which the `Toaster` picks up.
 */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess = false,
  confirm,
  toast: announce = true,
}: {
  action: FormAction;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  confirm?: string;
  toast?: boolean;
}) {
  const run: FormAction = async (prev, formData) => {
    const result = await action(prev, formData);
    if (announce && result.ok && result.message) toast.success(result.message);
    consumeFlash();
    return result;
  };
  const [state, formAction] = useActionState(run, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (resetOnSuccess && state?.ok) formRef.current?.reset();
  }, [state, resetOnSuccess]);

  useEffect(() => {
    if (!announce || !state || state.ok) return;
    if (!formRef.current?.querySelector("[data-field-error]")) toast.error(state.error);
  }, [state, announce]);

  return (
    <ResultContext.Provider value={state}>
      <form
        ref={formRef}
        action={formAction}
        className={className}
        onSubmit={(e) => {
          if (confirm && !window.confirm(confirm)) e.preventDefault();
        }}
      >
        {children}
      </form>
    </ResultContext.Provider>
  );
}

export function useActionResult() {
  return useContext(ResultContext);
}

export function FormMessage({ className }: { className?: string }) {
  const state = useContext(ResultContext);
  if (!state) return null;
  if (state.ok && !state.message) return null;
  return (
    <p
      role={state.ok ? "status" : "alert"}
      className={clsx("text-sm", state.ok ? "text-emerald-300" : "text-red-300", className)}
    >
      {state.ok ? state.message : state.error}
    </p>
  );
}

export function FieldError({ name }: { name: string }) {
  const state = useContext(ResultContext);
  const errors = state && !state.ok ? state.fieldErrors?.[name] : undefined;
  if (!errors?.length) return null;
  return (
    <p className="mt-1 text-xs text-red-300" data-field-error={name}>
      {errors[0]}
    </p>
  );
}

export function SubmitButton({
  children,
  variant = "primary",
  size,
  pendingLabel,
}: {
  children: ReactNode;
  variant?: "primary" | "ghost" | "danger" | "gold";
  size?: "sm";
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={clsx("btn", `btn-${variant}`, size === "sm" && "btn-sm")}
    >
      {pending ? (pendingLabel ?? "Saving…") : children}
    </button>
  );
}

export function Field({
  label,
  name,
  children,
  hint,
}: {
  label: string;
  name: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="field-label">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
      <FieldError name={name} />
    </div>
  );
}
