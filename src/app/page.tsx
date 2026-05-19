import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const cookieStore = await cookies();
  const isDemo = cookieStore.get("journalme-demo")?.value === "1";

  const isAuthed = !!user;
  const displayName = user?.email?.split("@")[0] ?? "ospite";
  const headingText = isAuthed ? "Bentornato" : "Modalita demo";

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 relative">
      {isDemo && !isAuthed && (
        <div className="absolute top-7 left-0 right-0 text-center text-[10px] font-semibold tracking-[0.2em] uppercase text-accent">
          App tour
        </div>
      )}
      <h1
        className="text-[48px] tracking-tight text-ink"
        style={{ fontWeight: 650, letterSpacing: "-0.025em" }}
      >
        {headingText}
        <span
          className="text-accent"
          style={{ textShadow: "0 0 12px rgba(227,161,95,0.55)" }}
        >
          .
        </span>
      </h1>
      <p className="mt-5 text-[11px] uppercase tracking-[0.2em] text-ink-faint">
        Today screen · in costruzione
      </p>
      <p className="mt-2 text-xs text-ink-muted">
        ciao {isAuthed ? displayName : "ospite"}
      </p>
    </main>
  );
}
