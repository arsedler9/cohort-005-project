// PROTOTYPE, throwaway (#26). Floating variant switcher + "send me a Notification" control.
import { useEffect, useState } from "react";
import { useFetcher, useSearchParams } from "react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { VARIANTS } from "./variants";

const LS = "cadence-feed-prototype-variant";

export function useVariant() {
  const [params] = useSearchParams();
  const fromUrl = params.get("variant");
  const [stored, setStored] = useState<string | null>(null);
  useEffect(() => {
    if (fromUrl) localStorage.setItem(LS, fromUrl);
    setStored(localStorage.getItem(LS));
  }, [fromUrl]);
  const key = fromUrl ?? stored ?? "A";
  return VARIANTS.find((v) => v.key === key) ?? VARIANTS[0];
}

const KINDS: [string, string][] = [
  ["all", "One of each"],
  ["discussion-reply", "Discussion Reply"],
  ["discussion-question", "Discussion Question"],
  ["refund-approved", "Refund approved"],
  ["refund-declined", "Refund declined"],
  ["refund-request-opened", "New Refund Request"],
  ["seat-claimed", "Seat claimed"],
  ["new-enrollment", "Enrollment (off unless opted in)"],
];

export function PrototypeSwitcher() {
  const [params, setParams] = useSearchParams();
  const current = useVariant();
  const fetcher = useFetcher<{ ok: boolean; error?: string }>();
  const idx = VARIANTS.indexOf(current);
  const go = (d: number) => {
    const next = VARIANTS[(idx + d + VARIANTS.length) % VARIANTS.length];
    const p = new URLSearchParams(params);
    p.set("variant", next.key);
    setParams(p, { replace: true, preventScrollReset: true });
  };
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [contenteditable]")) return;
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });
  if (!import.meta.env.DEV) return null;
  return (
    <div className="fixed bottom-4 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-3 rounded-full bg-zinc-900 px-3 py-1.5 text-sm text-white shadow-xl ring-2 ring-amber-400">
      <button onClick={() => go(-1)} className="rounded-full p-1 hover:bg-white/10">
        <ChevronLeft className="size-4" />
      </button>
      <span className="min-w-36 text-center font-medium">
        {current.key} ({current.name})
      </span>
      <button onClick={() => go(1)} className="rounded-full p-1 hover:bg-white/10">
        <ChevronRight className="size-4" />
      </button>
      <span className="h-5 w-px bg-white/20" />
      <fetcher.Form method="post" action="/prototype/notify" className="flex items-center gap-1.5">
        <select name="kind" className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs">
          {KINDS.map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </select>
        <button className="rounded-full bg-amber-400 px-2.5 py-0.5 text-xs font-semibold text-zinc-900">
          {fetcher.state !== "idle" ? "Sending…" : "Send me"}
        </button>
        {fetcher.data && !fetcher.data.ok && <span className="text-xs text-red-300">{fetcher.data.error}</span>}
      </fetcher.Form>
    </div>
  );
}
