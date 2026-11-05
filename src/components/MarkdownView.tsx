import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "./MarkdownView.css";

export interface MarkdownViewProps {
  markdown: string;
  className?: string;
}

export function MarkdownView({ markdown, className }: MarkdownViewProps) {
  const rootClass = ["markdown-view", className].filter(Boolean).join(" ");

  return (
    <div className={rootClass}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // `node` is react-markdown's syntax-tree node; it must not reach the DOM.
          a: ({ node: _node, href, children, ...props }) => {
            const external =
              href?.startsWith("http://") || href?.startsWith("https://");
            return (
              <a
                href={href}
                {...props}
                {...(external
                  ? { target: "_blank", rel: "noopener noreferrer" }
                  : {})}
              >
                {children}
              </a>
            );
          },
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
