import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Renders officer-authored Markdown. Raw HTML is not rendered. */
export function Markdown({ children, tone = "parchment" }: { children: string; tone?: "parchment" | "dark" }) {
  return (
    <div className={tone === "parchment" ? "prose-order" : "prose-order prose-dark"}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}
