"use client";

import Link from "next/link";

export type TabKey = "today" | "month" | "recap" | "remember";

type Props = {
  active: TabKey;
};

type Tab = {
  key: TabKey;
  label: string;
  href: string;
  icon: React.ReactNode;
};

const TABS: Tab[] = [
  {
    key: "today",
    label: "Oggi",
    href: "/",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 2v20M2 12h20" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
  },
  {
    key: "month",
    label: "Mese",
    href: "/mese",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
      </svg>
    ),
  },
  {
    key: "recap",
    label: "Recap",
    href: "/recap",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2zM18 14h-8M15 18h-5M10 6h8v4h-8V6z" />
      </svg>
    ),
  },
  {
    key: "remember",
    label: "Remember",
    href: "/remember",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
];

export function TabBar({ active }: Props) {
  return (
    <nav
      className="sticky bottom-0 left-0 right-0 z-10 flex items-center justify-around border-t backdrop-blur"
      style={{
        borderColor: "var(--color-line)",
        background: "rgba(10, 5, 7, 0.45)",
        paddingTop: 14,
        paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 14px)",
      }}
    >
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            className="flex flex-col items-center gap-1 select-none"
            style={{
              color: isActive ? "var(--color-accent)" : "var(--color-ink-faint)",
              WebkitTapHighlightColor: "transparent",
              touchAction: "manipulation",
            }}
          >
            <span style={{ width: 22, height: 22, display: "block" }}>
              {tab.icon}
            </span>
            <span
              style={{
                fontSize: 9,
                fontWeight: 600,
                letterSpacing: "0.10em",
                textTransform: "uppercase",
              }}
            >
              {tab.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
