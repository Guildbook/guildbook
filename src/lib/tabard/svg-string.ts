import { Fragment, isValidElement, type ReactElement, type ReactNode } from "react";

/** SVG attributes whose names stay camelCase. */
const CAMEL_ATTRS = new Set(["viewBox", "preserveAspectRatio", "tableValues"]);
const VOID = new Set(["path", "circle", "ellipse", "rect", "line", "polygon", "polyline", "stop", "use"]);

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function attrName(key: string) {
  if (key === "className") return "class";
  if (CAMEL_ATTRS.has(key) || key.startsWith("data-") || key.startsWith("aria-")) return key;
  return key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

/**
 * Serializes plain SVG JSX (intrinsic elements, fragments and function components without hooks) to markup.
 * Route handlers use it to rasterize crests: `react-dom/server` isn't available in the server bundle there.
 */
export function svgToString(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return escape(String(node));
  if (Array.isArray(node)) return node.map(svgToString).join("");
  if (!isValidElement(node)) return "";
  const el = node as ReactElement<Record<string, unknown> & { children?: ReactNode }>;
  if (el.type === Fragment) return svgToString(el.props.children);
  if (typeof el.type === "function") return svgToString((el.type as (p: unknown) => ReactNode)(el.props));
  if (typeof el.type !== "string") return "";
  const attrs = Object.entries(el.props)
    .filter(([k, v]) => k !== "children" && k !== "key" && v !== undefined && v !== null && v !== false)
    .map(([k, v]) => ` ${attrName(k)}="${escape(String(v))}"`)
    .join("");
  const children = svgToString(el.props.children);
  return !children && VOID.has(el.type) ? `<${el.type}${attrs}/>` : `<${el.type}${attrs}>${children}</${el.type}>`;
}
