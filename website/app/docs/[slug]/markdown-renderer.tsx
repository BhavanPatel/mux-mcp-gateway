"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import rehypeRaw from "rehype-raw";
import { MermaidDiagram } from "./mermaid-diagram";

export function MarkdownRenderer({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeRaw, rehypeHighlight]}
      components={{
        h1: ({ children }) => (
          <h1 className="text-3xl font-bold text-white mt-8 mb-4 first:mt-0">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-2xl font-semibold text-white mt-10 mb-4 pb-2 border-b border-white/10">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-xl font-medium text-white mt-8 mb-3">{children}</h3>
        ),
        h4: ({ children }) => (
          <h4 className="text-lg font-medium text-white/90 mt-6 mb-2">{children}</h4>
        ),
        p: ({ children }) => (
          <p className="text-white/70 leading-relaxed mb-4">{children}</p>
        ),
        a: ({ href, children }) => (
          <a href={href} className="text-[#a78bfa] hover:text-[#c4b5fd] underline underline-offset-2 transition-colors">
            {children}
          </a>
        ),
        ul: ({ children }) => (
          <ul className="list-disc list-inside text-white/70 mb-4 space-y-1.5 ml-2">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal list-inside text-white/70 mb-4 space-y-1.5 ml-2">{children}</ol>
        ),
        li: ({ children }) => (
          <li className="text-white/70 leading-relaxed">{children}</li>
        ),
        pre: ({ children }) => {
          // Check if this is a mermaid code block
          const child = children as React.ReactElement<{ className?: string; children?: string }>;
          if (child?.props?.className?.includes("language-mermaid")) {
            const chart = String(child.props.children).trim();
            return <MermaidDiagram chart={chart} />;
          }
          return (
            <pre className="bg-[#0a0a1a] border border-white/5 rounded-xl p-4 mb-4 overflow-x-auto text-sm font-mono">
              {children}
            </pre>
          );
        },
        code: ({ className, children }) => {
          const isBlock = className?.includes("language-");
          if (isBlock) {
            return (
              <code className={`${className} text-sm`}>
                {children}
              </code>
            );
          }
          return (
            <code className="bg-white/10 text-[#c4b5fd] px-1.5 py-0.5 rounded text-sm font-mono">
              {children}
            </code>
          );
        },
        table: ({ children }) => (
          <div className="overflow-x-auto mb-6">
            <table className="w-full text-sm border-collapse">{children}</table>
          </div>
        ),
        thead: ({ children }) => (
          <thead className="border-b border-white/10">{children}</thead>
        ),
        th: ({ children }) => (
          <th className="text-left text-white/80 font-medium px-3 py-2">{children}</th>
        ),
        td: ({ children }) => (
          <td className="text-white/60 px-3 py-2 border-b border-white/5">{children}</td>
        ),
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-[#a78bfa]/50 pl-4 my-4 text-white/50 italic">
            {children}
          </blockquote>
        ),
        hr: () => <hr className="border-white/10 my-8" />,
        strong: ({ children }) => (
          <strong className="text-white font-semibold">{children}</strong>
        ),
        em: ({ children }) => (
          <em className="text-white/80">{children}</em>
        ),
        img: ({ src, alt }) => (
          <img src={src} alt={alt || ""} className="inline-block h-5 mr-1" />
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
