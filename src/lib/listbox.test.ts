import { describe, expect, it } from "vitest";
import { filterOptions, type KeyState, listboxKey, stepIndex, typeaheadIndex } from "@/lib/listbox";

const OPTIONS = [
  { value: "alliance", label: "Alliance" },
  { value: "apple", label: "Apple", disabled: true },
  { value: "avocado", label: "Avocado" },
  { value: "banana", label: "Banana" },
  { value: "cherry", label: "Cherry" },
];

const closed = (selected = 0): KeyState => ({ open: false, active: -1, selected, buffer: "" });
const open = (active: number, selected = 0): KeyState => ({ open: true, active, selected, buffer: "" });

describe("listbox keyboard", () => {
  it("opens on arrows, Enter and Space with the selected option highlighted", () => {
    for (const key of ["ArrowDown", "ArrowUp", "Enter", " "]) {
      expect(listboxKey({ key }, closed(3), OPTIONS)).toMatchObject({ open: true, active: 3, handled: true });
    }
  });

  it("opens on the first option when nothing is selected", () => {
    expect(listboxKey({ key: "ArrowDown" }, closed(-1), OPTIONS)).toMatchObject({ open: true, active: 0 });
  });

  it("opens at the ends with Home and End", () => {
    expect(listboxKey({ key: "Home" }, closed(3), OPTIONS)).toMatchObject({ open: true, active: 0 });
    expect(listboxKey({ key: "End" }, closed(0), OPTIONS)).toMatchObject({ open: true, active: 4 });
  });

  it("moves with arrows, skipping disabled options and stopping at the ends", () => {
    expect(listboxKey({ key: "ArrowDown" }, open(0), OPTIONS).active).toBe(2);
    expect(listboxKey({ key: "ArrowUp" }, open(2), OPTIONS).active).toBe(0);
    expect(listboxKey({ key: "ArrowDown" }, open(4), OPTIONS).active).toBe(4);
    expect(listboxKey({ key: "ArrowUp" }, open(0), OPTIONS).active).toBe(0);
    expect(listboxKey({ key: "Home" }, open(4), OPTIONS).active).toBe(0);
    expect(listboxKey({ key: "End" }, open(0), OPTIONS).active).toBe(4);
    expect(listboxKey({ key: "PageDown" }, open(0), OPTIONS).active).toBe(4);
  });

  it("commits the highlighted option with Enter or Space and closes", () => {
    expect(listboxKey({ key: "Enter" }, open(3), OPTIONS)).toMatchObject({ open: false, commit: 3, handled: true });
    expect(listboxKey({ key: " " }, open(4), OPTIONS)).toMatchObject({ open: false, commit: 4, handled: true });
    expect(listboxKey({ key: "ArrowUp", altKey: true }, open(2), OPTIONS)).toMatchObject({ open: false, commit: 2 });
  });

  it("never commits a disabled option", () => {
    expect(listboxKey({ key: "Enter" }, open(1), OPTIONS).commit).toBeUndefined();
  });

  it("closes on Escape without committing", () => {
    const out = listboxKey({ key: "Escape" }, open(3), OPTIONS);
    expect(out).toMatchObject({ open: false, handled: true });
    expect(out.commit).toBeUndefined();
  });

  it("commits on Tab but lets focus move on", () => {
    expect(listboxKey({ key: "Tab" }, open(3), OPTIONS)).toMatchObject({ open: false, commit: 3, handled: false });
  });

  it("type-ahead opens and jumps to a match, and repeating a letter cycles", () => {
    const first = listboxKey({ key: "a" }, closed(4), OPTIONS);
    expect(first).toMatchObject({ open: true, active: 0, buffer: "a" });
    const again = listboxKey({ key: "a" }, { ...first, buffer: "a" }, OPTIONS);
    expect(again.active).toBe(2);
    expect(listboxKey({ key: "c" }, open(0), OPTIONS).active).toBe(4);
    expect(listboxKey({ key: "n" }, { ...open(3), buffer: "ba" }, OPTIONS)).toMatchObject({ active: 3, buffer: "ban" });
  });

  it("treats Space as a type-ahead character while a search is in progress", () => {
    const out = listboxKey({ key: " " }, { ...open(3), buffer: "b" }, OPTIONS);
    expect(out).toMatchObject({ open: true, buffer: "b " });
    expect(out.commit).toBeUndefined();
  });

  it("leaves printable keys and Space to the search box", () => {
    expect(listboxKey({ key: "a" }, open(0), OPTIONS, true).handled).toBe(false);
    expect(listboxKey({ key: " " }, open(0), OPTIONS, true).handled).toBe(false);
    expect(listboxKey({ key: "ArrowDown" }, open(0), OPTIONS, true).active).toBe(2);
    expect(listboxKey({ key: "Enter" }, open(3), OPTIONS, true)).toMatchObject({ commit: 3, open: false });
    const tab = listboxKey({ key: "Tab" }, open(3), OPTIONS, true);
    expect(tab.open).toBe(false);
    expect(tab.commit).toBeUndefined();
  });

  it("ignores modifier shortcuts", () => {
    expect(listboxKey({ key: "a", metaKey: true }, closed(), OPTIONS).handled).toBe(false);
    expect(listboxKey({ key: "c", ctrlKey: true }, open(0), OPTIONS).handled).toBe(false);
  });
});

describe("listbox helpers", () => {
  it("steps over disabled options", () => {
    expect(stepIndex(OPTIONS, 0, 1)).toBe(2);
    expect(stepIndex(OPTIONS, 2, -1)).toBe(0);
    expect(stepIndex(OPTIONS, 0, 10)).toBe(4);
  });

  it("type-ahead matches whole prefixes and returns -1 without a match", () => {
    expect(typeaheadIndex(OPTIONS, "ch", 0)).toBe(4);
    expect(typeaheadIndex(OPTIONS, "z", 0)).toBe(-1);
  });

  it("filters on every word across label, value, description and keywords, ignoring case and underscores", () => {
    const zones = [
      { value: "America/New_York", label: "America/New York", keywords: "GMT-04:00 EDT" },
      { value: "America/Los_Angeles", label: "America/Los Angeles", keywords: "GMT-07:00 PDT" },
      { value: "Europe/Paris", label: "Europe/Paris", description: "UTC+02:00" },
    ];
    expect(filterOptions(zones, "new york").map((z) => z.value)).toEqual(["America/New_York"]);
    expect(filterOptions(zones, "america angeles").map((z) => z.value)).toEqual(["America/Los_Angeles"]);
    expect(filterOptions(zones, "edt").map((z) => z.value)).toEqual(["America/New_York"]);
    expect(filterOptions(zones, "+02").map((z) => z.value)).toEqual(["Europe/Paris"]);
    expect(filterOptions(zones, "  ")).toHaveLength(3);
    expect(filterOptions(zones, "tokyo")).toHaveLength(0);
  });
});
