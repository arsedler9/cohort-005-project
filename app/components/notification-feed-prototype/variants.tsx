// PROTOTYPE, throwaway. For "What does the Notification Feed look like in Cadence?" (#26).
//
// Three variants of the Notification Feed, mounted in the real app layout and switched
// with ?variant=A|B|C (sticky via localStorage so it survives navigation):
//   A  Bell popover    – bell in the sidebar header, badge = UNSEEN, opening marks all seen.
//   B  Drawer inbox    – "Notifications" nav item, pill = UNREAD, right slide-over with tabs + day groups.
//   C  Inbox page      – "Notifications" nav item → /notifications, two-pane list + detail.
import { useEffect, useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router";
import { Bell, Check, CheckCheck, Archive, X, ArrowRight, Inbox, MailOpen, Mail } from "lucide-react";
import { cn } from "~/lib/utils";
import { UserAvatar } from "~/components/user-avatar";
import { useFeed, KindIcon, Body, detailLine, ago, kindOf, KIND_LABEL, type FeedItem } from "./feed";

export type Variant = {
  key: string;
  name: string;
  HeaderSlot?: () => React.ReactNode;
  NavSlot?: () => React.ReactNode;
  Overlay?: () => React.ReactNode;
};

function useOpen(item: FeedItem, after?: () => void) {
  const feed = useFeed()!;
  const navigate = useNavigate();
  return () => {
    if (!item.read_at) feed.markAsRead(item);
    after?.();
    if (item.data?.url) navigate(item.data.url);
  };
}

// ───────────────────────────── A: Bell popover ─────────────────────────────

function ABell() {
  const feed = useFeed();
  const [open, setOpen] = useState(false);
  if (!feed) return null;
  return (
    <button
      onClick={() => {
        setOpen(!open);
        if (!open && feed.unseen > 0) feed.markAllAsSeen();
      }}
      className="relative ml-auto rounded-md p-1.5 text-sidebar-foreground/70 hover:bg-sidebar-accent"
      title="Notifications"
    >
      <Bell className="size-5" />
      {feed.unseen > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
          {feed.unseen > 9 ? "9+" : feed.unseen}
        </span>
      )}
      {open && <APopover onClose={() => setOpen(false)} />}
    </button>
  );
}

function APopover({ onClose }: { onClose: () => void }) {
  const feed = useFeed()!;
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    setTimeout(() => document.addEventListener("click", h));
    return () => document.removeEventListener("click", h);
  }, []);
  return (
    <div
      ref={ref}
      onClick={(e) => e.stopPropagation()}
      className="fixed left-52 top-3 z-40 w-96 cursor-default rounded-lg border bg-popover text-left text-popover-foreground shadow-xl"
    >
      <div className="flex items-center justify-between border-b px-4 py-2.5">
        <span className="text-sm font-semibold">Notifications</span>
        {feed.unread > 0 && (
          <button onClick={feed.markAllAsRead} className="text-xs text-primary hover:underline">
            Mark all as read
          </button>
        )}
      </div>
      <div className="max-h-[28rem] overflow-y-auto">
        {feed.items.length === 0 && (
          <div className="p-8 text-center text-sm text-muted-foreground">You're all caught up.</div>
        )}
        {feed.items.map((i) => (
          <ARow key={i.id} item={i} onClose={onClose} />
        ))}
      </div>
    </div>
  );
}

function ARow({ item, onClose }: { item: FeedItem; onClose: () => void }) {
  const open = useOpen(item, onClose);
  return (
    <div
      role="button"
      onClick={open}
      className={cn("flex gap-3 border-b px-4 py-3 last:border-0 hover:bg-muted/60", !item.read_at && "bg-primary/5")}
    >
      <KindIcon item={item} className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <Body item={item} className="text-sm leading-snug [&_strong]:font-semibold" />
        <div className="mt-0.5 text-xs text-muted-foreground">{ago(item.inserted_at)} ago</div>
      </div>
      {!item.read_at && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />}
    </div>
  );
}

// ───────────────────────────── B: Drawer inbox ─────────────────────────────

let setBOpen: (b: boolean) => void = () => {};

function BNav() {
  const feed = useFeed();
  if (!feed) return null;
  return (
    <button
      onClick={() => setBOpen(true)}
      className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
    >
      <Inbox className="size-4" />
      Notifications
      {feed.unread > 0 && (
        <span className="ml-auto rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">
          {feed.unread}
        </span>
      )}
    </button>
  );
}

function BDrawer() {
  const feed = useFeed();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"all" | "unread">("all");
  setBOpen = setOpen;
  useEffect(() => {
    if (open && feed && feed.unseen > 0) feed.markAllAsSeen();
  }, [open, feed?.unseen]);
  if (!feed || !open) return null;
  const items = feed.items.filter((i) => tab === "all" || !i.read_at);
  const today = items.filter((i) => Date.now() - new Date(i.inserted_at).getTime() < 864e5);
  const earlier = items.filter((i) => !today.includes(i));
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/30" onClick={() => setOpen(false)}>
      <div className="flex h-full w-[440px] flex-col bg-background shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b px-5 py-4">
          <h2 className="text-lg font-semibold">Notifications</h2>
          <button onClick={feed.markAllAsRead} className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <CheckCheck className="size-3.5" /> Mark all read
          </button>
          <button onClick={() => setOpen(false)} className="rounded p-1 hover:bg-muted">
            <X className="size-4" />
          </button>
        </div>
        <div className="flex gap-1 border-b px-5">
          {(["all", "unread"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "-mb-px border-b-2 px-3 py-2 text-sm capitalize",
                tab === t ? "border-primary font-medium" : "border-transparent text-muted-foreground"
              )}
            >
              {t}
              {t === "unread" && feed.unread > 0 && ` (${feed.unread})`}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto">
          {items.length === 0 && (
            <div className="p-12 text-center text-sm text-muted-foreground">
              {tab === "unread" ? "No unread Notifications." : "Nothing here yet."}
            </div>
          )}
          {[["Today", today], ["Earlier", earlier]].map(([label, group]) =>
            (group as FeedItem[]).length ? (
              <div key={label as string}>
                <div className="sticky top-0 bg-muted/80 px-5 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground backdrop-blur">
                  {label as string}
                </div>
                {(group as FeedItem[]).map((i) => (
                  <BRow key={i.id} item={i} onClose={() => setOpen(false)} />
                ))}
              </div>
            ) : null
          )}
        </div>
      </div>
    </div>
  );
}

function BRow({ item, onClose }: { item: FeedItem; onClose: () => void }) {
  const feed = useFeed()!;
  const open = useOpen(item, onClose);
  const actor = item.actors?.[0];
  const detail = detailLine(item);
  return (
    <div role="button" onClick={open} className="group relative flex gap-3 border-b px-5 py-4 hover:bg-muted/50">
      {!item.read_at && <span className="absolute left-1.5 top-1/2 size-2 -translate-y-1/2 rounded-full bg-primary" />}
      <div className="relative shrink-0">
        <UserAvatar name={actor?.name ?? "Cadence"} avatarUrl={actor?.avatar ?? null} className="size-10" />
        <span className="absolute -bottom-1 -right-1 rounded-full border bg-background p-0.5 text-muted-foreground">
          <KindIcon item={item} className="size-3" />
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <Body item={item} className={cn("text-sm [&_strong]:font-semibold", item.read_at && "text-muted-foreground")} />
        {detail && <div className="mt-1 line-clamp-2 text-sm text-muted-foreground">{detail}</div>}
        <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="rounded bg-muted px-1.5 py-0.5">{KIND_LABEL[kindOf(item)] ?? item.source.key}</span>
          {ago(item.inserted_at)} ago
        </div>
      </div>
      <div className="absolute right-3 top-3 hidden gap-1 group-hover:flex" onClick={(e) => e.stopPropagation()}>
        <button
          title={item.read_at ? "Mark as unread" : "Mark as read"}
          onClick={() => (item.read_at ? feed.markAsUnread(item) : feed.markAsRead(item))}
          className="rounded border bg-background p-1 hover:bg-muted"
        >
          {item.read_at ? <Mail className="size-3.5" /> : <Check className="size-3.5" />}
        </button>
        <button title="Archive" onClick={() => feed.markAsArchived(item)} className="rounded border bg-background p-1 hover:bg-muted">
          <Archive className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

// ───────────────────────────── C: Inbox page ─────────────────────────────

function CNav() {
  const feed = useFeed();
  if (!feed) return null;
  return (
    <NavLink
      to="/notifications"
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          isActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        )
      }
    >
      <Bell className="size-4" />
      Notifications
      {feed.unread > 0 && <span className="ml-auto text-xs font-semibold text-primary">{feed.unread} new</span>}
    </NavLink>
  );
}

const C_FILTERS: [string, (k: string) => boolean][] = [
  ["All", () => true],
  ["Discussions", (k) => k.startsWith("discussion")],
  ["Refunds", (k) => k.startsWith("refund")],
  ["Team & Enrollments", (k) => k === "seat-claimed" || k === "new-enrollment"],
];

export function CInboxPage() {
  const feed = useFeed();
  const navigate = useNavigate();
  const [filter, setFilter] = useState("All");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  useEffect(() => {
    if (feed && feed.unseen > 0) feed.markAllAsSeen();
  }, [feed?.unseen]);
  if (!feed) return <div className="p-8">Select a user from the DevUI panel.</div>;
  const pred = C_FILTERS.find(([l]) => l === filter)![1];
  const items = feed.items.filter((i) => pred(kindOf(i)));
  const selected = items.find((i) => i.id === selectedId) ?? null;
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-4 border-b px-6 py-4">
        <h1 className="text-xl font-semibold">Notifications</h1>
        <div className="flex gap-1">
          {C_FILTERS.map(([l]) => (
            <button
              key={l}
              onClick={() => setFilter(l)}
              className={cn("rounded-full border px-3 py-1 text-xs", filter === l ? "bg-foreground text-background" : "hover:bg-muted")}
            >
              {l}
            </button>
          ))}
        </div>
        <button onClick={feed.markAllAsRead} className="ml-auto text-sm text-muted-foreground hover:text-foreground">
          Mark all as read
        </button>
      </div>
      <div className="flex min-h-0 flex-1">
        <ul className="w-[26rem] shrink-0 overflow-y-auto border-r">
          {items.length === 0 && <li className="p-8 text-center text-sm text-muted-foreground">Nothing here.</li>}
          {items.map((i) => (
            <li
              key={i.id}
              onClick={() => {
                setSelectedId(i.id);
                if (!i.read_at) feed.markAsRead(i);
              }}
              className={cn(
                "cursor-pointer border-b px-4 py-3",
                selected?.id === i.id ? "bg-muted" : "hover:bg-muted/50",
                !i.read_at && "border-l-4 border-l-primary"
              )}
            >
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <KindIcon item={i} className="size-3.5" />
                {KIND_LABEL[kindOf(i)] ?? i.source.key}
                <span className="ml-auto">{ago(i.inserted_at)}</span>
              </div>
              <Body item={i} className={cn("mt-1 truncate text-sm", !i.read_at && "font-medium")} />
            </li>
          ))}
        </ul>
        <div className="flex-1 overflow-y-auto p-8">
          {!selected ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Pick a Notification to see it in full.
            </div>
          ) : (
            <div className="max-w-xl space-y-5">
              <div className="flex items-center gap-3">
                <UserAvatar name={selected.actors?.[0]?.name ?? "Cadence"} avatarUrl={selected.actors?.[0]?.avatar ?? null} className="size-12" />
                <div>
                  <div className="font-medium">{selected.actors?.[0]?.name ?? "Cadence"}</div>
                  <div className="text-xs text-muted-foreground">
                    {KIND_LABEL[kindOf(selected)]} · {new Date(selected.inserted_at).toLocaleString()}
                  </div>
                </div>
              </div>
              <Body item={selected} className="text-lg [&_strong]:font-semibold" />
              {detailLine(selected) && (
                <blockquote className="border-l-4 pl-4 text-muted-foreground">{detailLine(selected)}</blockquote>
              )}
              <div className="text-sm text-muted-foreground">
                {selected.data?.course_title}
                {kindOf(selected).startsWith("discussion") && ` › ${selected.data?.lesson_title}`}
              </div>
              <div className="flex gap-2">
                {selected.data?.url && (
                  <button
                    onClick={() => navigate(selected.data.url)}
                    className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
                  >
                    Go to it <ArrowRight className="size-4" />
                  </button>
                )}
                <button onClick={() => feed.markAsUnread(selected)} className="flex items-center gap-1.5 rounded-md border px-4 py-2 text-sm">
                  <MailOpen className="size-4" /> Mark unread
                </button>
                <button
                  onClick={() => {
                    feed.markAsArchived(selected);
                    setSelectedId(null);
                  }}
                  className="flex items-center gap-1.5 rounded-md border px-4 py-2 text-sm"
                >
                  <Archive className="size-4" /> Archive
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export const VARIANTS: Variant[] = [
  { key: "A", name: "Bell popover", HeaderSlot: ABell },
  { key: "B", name: "Drawer inbox", NavSlot: BNav, Overlay: BDrawer },
  { key: "C", name: "Inbox page", NavSlot: CNav },
];
