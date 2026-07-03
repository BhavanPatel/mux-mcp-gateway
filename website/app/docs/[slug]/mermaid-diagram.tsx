/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useRef, useState } from "react";

let mermaidLoaded: Promise<any> | null = null;

function loadMermaid(): Promise<any> {
  if (!mermaidLoaded) {
    mermaidLoaded = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js";
      script.onload = () => {
      const mermaid = (window as any).mermaid;
        mermaid.initialize({
          startOnLoad: false,
          theme: "dark",
          themeVariables: {
            primaryColor: "#1a1a2e",
            primaryTextColor: "#f0f4ff",
            primaryBorderColor: "#a78bfa",
            lineColor: "#6b7394",
            secondaryColor: "#0d3b66",
            tertiaryColor: "#2d2d44",
            background: "#050510",
            mainBkg: "#1a1a2e",
            nodeBorder: "#a78bfa",
            clusterBkg: "#0a0a1a",
            clusterBorder: "#ffffff10",
            titleColor: "#f0f4ff",
            edgeLabelBackground: "#0a0a1a",
          },
          fontFamily: "var(--font-jetbrains-mono), JetBrains Mono, monospace",
          fontSize: 14,
        });
        resolve(mermaid);
      };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }
  return mermaidLoaded;
}

export function MermaidDiagram({ chart }: { chart: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    const renderChart = async () => {
      try {
        const mermaid = await loadMermaid();
        const id = `mermaid-${Math.random().toString(36).slice(2, 9)}`;
        const { svg: renderedSvg } = await mermaid.render(id, chart);
        setSvg(renderedSvg);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to render diagram");
      }
    };

    renderChart();
  }, [chart]);

  if (error) {
    return (
      <pre className="bg-[#0a0a1a] border border-red-500/20 rounded-xl p-4 mb-4 overflow-x-auto text-sm font-mono text-red-400">
        {chart}
      </pre>
    );
  }

  if (!svg) {
    return (
      <div className="bg-[#0a0a1a] border border-white/5 rounded-xl p-8 mb-4 flex items-center justify-center">
        <span className="text-white/30 text-sm">Loading diagram...</span>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="bg-[#0a0a1a] border border-white/5 rounded-xl p-6 mb-4 overflow-x-auto flex justify-center [&_svg]:max-w-full"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
