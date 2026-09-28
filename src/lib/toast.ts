export type ToastKind = "success" | "error";

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

/** Older toasts give way once the stack is full. */
export const MAX_TOASTS = 3;

type Listener = () => void;

export function createToastStore() {
  let toasts: readonly Toast[] = [];
  let nextId = 1;
  const listeners = new Set<Listener>();
  const emit = () => listeners.forEach((l) => l());

  return {
    getSnapshot: () => toasts,
    subscribe(listener: Listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    push(kind: ToastKind, message: string): number {
      const text = message.trim();
      if (!text) return 0;
      const id = nextId++;
      toasts = [...toasts, { id, kind, message: text }].slice(-MAX_TOASTS);
      emit();
      return id;
    },
    dismiss(id: number) {
      const next = toasts.filter((t) => t.id !== id);
      if (next.length === toasts.length) return;
      toasts = next;
      emit();
    },
  };
}

/** Module-level so a toast raised by a form outlives the form: a `refresh()` often unmounts it. */
export const toastStore = createToastStore();

export function toast(message: string, kind: ToastKind = "success"): number {
  return toastStore.push(kind, message);
}
toast.success = (message: string) => toastStore.push("success", message);
toast.error = (message: string) => toastStore.push("error", message);
