"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface DocItem {
  slug: string;
  title: string;
}

interface DocCategory {
  label: string;
  items: DocItem[];
}

const categories: DocCategory[] = [
  {
    label: "Getting Started",
    items: [
      { slug: "architecture", title: "Architecture" },
      { slug: "config", title: "Configuration" },
      { slug: "cli", title: "CLI Reference" },
    ],
  },
  {
    label: "Core Concepts",
    items: [
      { slug: "tools", title: "Tools" },
      { slug: "lifecycle", title: "Lifecycle" },
      { slug: "auth", title: "Authentication" },
      { slug: "troubleshooting", title: "Troubleshooting" },
    ],
  },
  {
    label: "Integration",
    items: [
      { slug: "clients", title: "Clients" },
      { slug: "comparison", title: "Comparison" },
    ],
  },
  {
    label: "Reference",
    items: [
      { slug: "tech-stack", title: "Tech Stack" },
      { slug: "development", title: "Development" },
    ],
  },
];

export function DocsSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex w-60 flex-col border-r border-white/5 sticky top-0 h-screen overflow-y-auto py-8 px-4">
      <Link href="/" className="text-xl font-bold tracking-tight mb-6 px-3 hover:opacity-80 transition-opacity animated-gradient-text" style={{
        backgroundImage: 'linear-gradient(135deg, #f0f4ff, #a78bfa, #6366f1, #a78bfa, #f0f4ff)',
        backgroundSize: '300% 300%',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
      }}>
        mux
      </Link>

      <Link
        href="/docs"
        className={`px-3 py-2 rounded-lg text-sm font-medium mb-4 transition-all ${
          pathname === "/docs"
            ? "bg-[#a78bfa]/10 text-[#a78bfa]"
            : "text-white/80 hover:text-white hover:bg-white/5"
        }`}
      >
        Home
      </Link>

      <nav className="flex flex-col gap-5">
        {categories.map((category) => (
          <div key={category.label}>
            <span className="px-3 text-[10px] uppercase tracking-wider text-white/30 font-medium">
              {category.label}
            </span>
            <div className="flex flex-col gap-0.5 mt-1.5">
              {category.items.map((doc) => {
                const isActive = pathname === `/docs/${doc.slug}`;
                return (
                  <Link
                    key={doc.slug}
                    href={`/docs/${doc.slug}`}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                      isActive
                        ? "bg-[#a78bfa]/10 text-[#a78bfa] font-medium"
                        : "text-white/50 hover:text-white/80 hover:bg-white/5"
                    }`}
                  >
                    {doc.title}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
