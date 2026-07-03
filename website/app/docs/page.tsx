import fs from "fs";
import path from "path";
import { MarkdownRenderer } from "./[slug]/markdown-renderer";

function findReadme(): string {
  const candidates = [
    path.join(process.cwd(), "content", "README.md"),
    path.join(process.cwd(), "..", "README.md"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return candidates[0];
}

export default function DocsIndex() {
  const readmePath = findReadme();
  const content = fs.existsSync(readmePath)
    ? fs.readFileSync(readmePath, "utf-8")
    : "# Documentation\n\nREADME not found.";

  return (
    <article className="docs-content">
      <MarkdownRenderer content={content} />
    </article>
  );
}
