import fs from "fs";
import path from "path";
import { notFound } from "next/navigation";
import { MarkdownRenderer } from "./markdown-renderer";

function findDocsDir(): string {
  const candidates = [
    path.join(process.cwd(), "content", "docs"),
    path.join(process.cwd(), "..", "docs"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return candidates[0];
}

const validSlugs = [
  "architecture", "auth", "cli", "clients", "comparison",
  "config", "development", "lifecycle", "tech-stack", "tools", "troubleshooting",
];

export function generateStaticParams() {
  return validSlugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const title = slug
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return {
    title: `${title} — Mux Docs`,
  };
}

export default async function DocPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  if (!validSlugs.includes(slug)) {
    notFound();
  }

  const docsDir = findDocsDir();
  const filePath = path.join(docsDir, `${slug}.md`);

  if (!fs.existsSync(filePath)) {
    notFound();
  }

  const content = fs.readFileSync(filePath, "utf-8");

  return (
    <article className="docs-content">
      <MarkdownRenderer content={content} />
    </article>
  );
}
