import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Listbox } from "@/components/listbox";
import { timezoneOptions } from "@/lib/timezones";

const OPTIONS = [
  { value: "us", label: "Americas", description: "North and South America" },
  { value: "eu", label: "Europe" },
];

const render = (props: Parameters<typeof Listbox>[0]) => renderToStaticMarkup(createElement(Listbox, props));

describe("Listbox markup", () => {
  it("renders a collapsed select-only combobox showing the chosen label", () => {
    const html = render({ id: "region", name: "region", options: OPTIONS, defaultValue: "eu" });
    expect(html).toContain('role="combobox"');
    expect(html).toContain('aria-haspopup="listbox"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('id="region"');
    expect(html).toMatch(/<button[^>]*type="button"/);
    expect(html).toContain(">Europe<");
    expect(html).not.toContain('role="listbox"');
  });

  it("submits the value through a hidden input named for the field", () => {
    const html = render({ name: "region", options: OPTIONS, defaultValue: "eu" });
    const input = html.match(/<input[^>]*>/)?.[0] ?? "";
    expect(input).toContain('type="hidden"');
    expect(input).toContain('name="region"');
    expect(input).toContain('value="eu"');
    expect(html).toContain('data-field-name="region"');
  });

  it("starts on the first option without a default, like a native select", () => {
    expect(render({ name: "region", options: OPTIONS })).toContain('value="us"');
  });

  it("shows the placeholder and submits nothing until a choice is made", () => {
    const html = render({ name: "region", options: OPTIONS, placeholder: "Choose a region" });
    expect(html).toContain("Choose a region");
    expect(html).toContain('value=""');
  });

  it("uses a constraint-validated input when required", () => {
    const html = render({ name: "boss", options: OPTIONS, placeholder: "Pick", required: true });
    expect(html).toMatch(/<input[^>]*required=""[^>]*name="boss"/);
    expect(html).not.toContain('type="hidden"');
    expect(html).toContain('aria-required="true"');
  });

  it("marks the trigger invalid and names it", () => {
    const html = render({ options: OPTIONS, invalid: true, "aria-label": "Region", "aria-describedby": "hint" });
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('aria-label="Region"');
    expect(html).toContain('aria-describedby="hint"');
  });

  it("makes a searchable trigger a listbox button, leaving the combobox role to its search box", () => {
    const html = render({ options: OPTIONS, searchable: true, "aria-label": "Region" });
    expect(html).not.toContain('role="combobox"');
    expect(html).toContain('aria-haspopup="listbox"');
  });

  it("shows a value outside the options as itself", () => {
    expect(render({ options: OPTIONS, value: "Mars/Olympus" })).toContain("Mars/Olympus");
  });
});

describe("timezone options", () => {
  it("lists IANA zones with offsets, and keeps an unlisted current value", () => {
    const at = new Date("2026-01-15T12:00:00Z");
    const options = timezoneOptions("Etc/Unlisted", at);
    expect(options[0]!.value).toBe("Etc/Unlisted");
    const ny = options.find((o) => o.value === "America/New_York")!;
    expect(ny.label).toBe("America/New York");
    expect(ny.description).toMatch(/^UTC-05:00/);
    expect(options.some((o) => o.value === "UTC")).toBe(true);
    expect(options.length).toBeGreaterThan(300);
  });
});
