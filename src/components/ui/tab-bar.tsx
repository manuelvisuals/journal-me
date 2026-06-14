"use client";

import Link from "next/link";

export type TabKey =
  | "today"
  | "month"
  | "mic"
  | "remember"
  | "settings";

type Props = {
  active: TabKey;
};

type Tab = {
  key: TabKey;
  label: string;
  href: string;
  icon: React.ReactNode;
};

const SIDE_TABS_LEFT: Tab[] = [
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
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
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
];

const SIDE_TABS_RIGHT: Tab[] = [
  {
    key: "remember",
    label: "Ricorda",
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
  {
    key: "settings",
    label: "Altro",
    href: "/settings",
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
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
    ),
  },
];

export function TabBar({ active }: Props) {
  return (
    <nav
      className="sticky bottom-0 left-0 right-0 z-10 grid items-center border-t backdrop-blur"
      style={{
        gridTemplateColumns: "repeat(5, 1fr)",
        borderColor: "var(--color-line)",
        background: "rgba(10, 5, 7, 0.50)",
        paddingTop: 12,
        paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 14px)",
      }}
    >
      {SIDE_TABS_LEFT.map((tab) => (
        <SideTab key={tab.key} tab={tab} active={active === tab.key} />
      ))}

      {/* Mic centrale — premium iOS-like, sempre disponibile */}
      <Link
        href="/?record=1"
        aria-label="Registra"
        className="flex flex-col items-center select-none"
        style={{
          gap: 4,
          WebkitTapHighlightColor: "transparent",
          touchAction: "manipulation",
          color: "var(--color-accent)",
        }}
      >
        <span className="jm-mic-circle">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            width="22"
            height="22"
            aria-hidden="true"
          >
            <rect x="9" y="3" width="6" height="12" rx="3" />
            <path d="M5 11a7 7 0 0 0 14 0" />
            <path d="M12 18v3" />
          </svg>
        </span>
        <span
          style={{
            fontSize: 9,
            fontWeight: 600,
            letterSpacing: "0.10em",
            textTransform: "uppercase",
          }}
        >
          Registra
        </span>
      </Link>

      {SIDE_TABS_RIGHT.map((tab) => (
        <SideTab key={tab.key} tab={tab} active={active === tab.key} />
      ))}
    </nav>
  );
}

function SideTab({ tab, active }: { tab: Tab; active: boolean }) {
  return (
    <Link
      href={tab.href}
      className="flex flex-col items-center gap-1 select-none"
      style={{
        color: active ? "var(--color-accent)" : "var(--color-ink-faint)",
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
}
