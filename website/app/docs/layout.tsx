import type { Metadata } from "next";
import { DocsSidebar } from "./sidebar";

export const metadata: Metadata = {
  title: "Docs — Mux MCP Gateway",
  description: "Documentation for Mux MCP Gateway Router",
};

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex" style={{ background: "#050510" }}>
      <DocsSidebar />
      <main className="flex-1 min-w-0 px-8 py-12 md:px-16 lg:px-24 max-w-4xl">
        {children}
      </main>
    </div>
  );
}
