import { describe, expect, it, vi } from "vitest";
import { createToastStore, MAX_TOASTS } from "@/lib/toast";

describe("toast store", () => {
  it("keeps the newest toasts once the stack is full", () => {
    const store = createToastStore();
    for (let i = 1; i <= MAX_TOASTS + 2; i++) store.push("success", `Toast ${i}`);
    expect(store.getSnapshot().map((t) => t.message)).toEqual(["Toast 3", "Toast 4", "Toast 5"]);
  });

  it("dismisses by id and notifies subscribers only on change", () => {
    const store = createToastStore();
    const listener = vi.fn();
    store.subscribe(listener);
    const id = store.push("error", "Something failed");
    expect(listener).toHaveBeenCalledTimes(1);
    store.dismiss(id);
    expect(store.getSnapshot()).toEqual([]);
    store.dismiss(id);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("ignores empty messages", () => {
    const store = createToastStore();
    expect(store.push("success", "   ")).toBe(0);
    expect(store.getSnapshot()).toEqual([]);
  });
});
