// PROTOTYPE, throwaway. For "What does the Notification Feed look like in Cadence?" (#26).
// Shared headless Knock feed for all variants: same data, different rendering.
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { MessageSquare, MessageCircleQuestion, Receipt, UsersRound, GraduationCap, Bell } from "lucide-react";

export type FeedItem = {
  id: string;
  source: { key: string };
  data: Record<string, any>;
  blocks: { name: string; rendered: string }[];
  inserted_at: string;
  seen_at: string | null;
  read_at: string | null;
  archived_at: string | null;
  actors: { name?: string; avatar?: string }[];
};

type Feed = {
  status: string;
  items: FeedItem[];
  unread: number;
  unseen: number;
  markAsSeen: (i: FeedItem | FeedItem[]) => void;
  markAsRead: (i: FeedItem | FeedItem[]) => void;
  markAsUnread: (i: FeedItem) => void;
  markAsArchived: (i: FeedItem) => void;
  markAllAsSeen: () => void;
  markAllAsRead: () => void;
};

const Ctx = createContext<Feed | null>(null);
export const useFeed = () => useContext(Ctx);

export function FeedProvider({
  knock,
  children,
}: {
  knock: { userId: number; token: string; publicKey: string; channelId: string } | null;
  children: React.ReactNode;
}) {
  const [state, setState] = useState<any>(null);
  const feedRef = useRef<any>(null);

  useEffect(() => {
    if (!knock) return;
    let unsub: (() => void) | undefined;
    let client: any;
    let cancelled = false;
    (async () => {
      const { default: Knock } = await import("@knocklabs/client");
      if (cancelled) return;
      client = new Knock(knock.publicKey);
      client.authenticate(String(knock.userId), knock.token);
      const feed = client.feeds.initialize(knock.channelId, { page_size: 30, archived: "exclude" });
      feedRef.current = feed;
      unsub = feed.store.subscribe((s: any) => setState({ ...s }));
      feed.listenForUpdates();
      await feed.fetch();
      // eslint-disable-next-line no-console
      console.log("[feed prototype] fetched", feed.store.getState());
    })();
    return () => {
      cancelled = true;
      unsub?.();
      feedRef.current?.dispose?.();
      client?.teardown?.();
      setState(null);
    };
  }, [knock?.userId, knock?.token]);

  const f = () => feedRef.current;
  const value: Feed | null = knock
    ? {
        status: state?.networkStatus ?? "loading",
        items: state?.items ?? [],
        unread: state?.metadata?.unread_count ?? 0,
        unseen: state?.metadata?.unseen_count ?? 0,
        markAsSeen: (i) => f()?.markAsSeen(i),
        markAsRead: (i) => f()?.markAsRead(i),
        markAsUnread: (i) => f()?.markAsUnread(i),
        markAsArchived: (i) => f()?.markAsArchived(i),
        markAllAsSeen: () => f()?.markAllAsSeen(),
        markAllAsRead: () => f()?.markAllAsRead(),
      }
    : null;
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// ── shared bits of presentation (fine to share; layouts are not shared) ──

export function kindOf(i: FeedItem): string {
  if (i.data?.kind) return i.data.kind;
  if (i.source.key === "refund-request-decided") return `refund-${i.data?.decision}`;
  return i.source.key;
}

export function KindIcon({ item, className = "size-4" }: { item: FeedItem; className?: string }) {
  const k = kindOf(item);
  if (k === "discussion-reply") return <MessageSquare className={className} />;
  if (k === "discussion-question") return <MessageCircleQuestion className={className} />;
  if (k.startsWith("refund")) return <Receipt className={className} />;
  if (k === "seat-claimed") return <UsersRound className={className} />;
  if (k === "new-enrollment") return <GraduationCap className={className} />;
  return <Bell className={className} />;
}

export const KIND_LABEL: Record<string, string> = {
  "discussion-reply": "Discussion Reply",
  "discussion-question": "Discussion Question",
  "refund-approved": "Refund approved",
  "refund-declined": "Refund declined",
  "refund-request-opened": "Refund Request",
  "seat-claimed": "Seat claimed",
  "new-enrollment": "Enrollment",
};

/** The Knock-rendered template (markdown → HTML). Rendering the copy in Knock vs in our code is one of the questions. */
export function Body({ item, className }: { item: FeedItem; className?: string }) {
  const html = item.blocks.find((b) => b.name === "body")?.rendered ?? "";
  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

/** Secondary line built from data in our code: snippet / decision note / amount / seats left. */
export function detailLine(i: FeedItem): string | null {
  const d = i.data ?? {};
  const k = kindOf(i);
  if (k.startsWith("discussion")) return d.snippet ? `“${d.snippet}”` : null;
  if (k === "refund-approved" || k === "refund-declined") return d.decision_note ?? null;
  if (k === "refund-request-opened") return [d.amount, d.reason].filter(Boolean).join(" · ");
  if (k === "seat-claimed") return d.seats_left != null ? `${d.seats_left} Seats left on ${d.course_title}` : null;
  if (k === "new-enrollment") return d.course_title ?? null;
  return null;
}

export function ago(iso: string) {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}
