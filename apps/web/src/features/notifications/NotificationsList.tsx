"use client";
import { useNotifications } from "@inkora/data-access";
import { NOTIFICATION_ICON, notificationHref } from "@inkora/domain";
import { useRouter } from "next/navigation";
import { getSupabaseBrowser } from "../../lib/supabase-browser";

export function NotificationsList() {
  const client = getSupabaseBrowser();
  const router = useRouter();
  const { notifications, unread, isLoading, markRead, markAllRead } = useNotifications(client);

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Notifications</h1>
        {unread > 0 && <button className="text-sm font-semibold text-[#E5484D]" onClick={() => void markAllRead()}>Mark all read</button>}
      </div>
      {isLoading ? <p className="text-zinc-500">Loading…</p> : notifications.length === 0 ? (
        <p className="text-zinc-500">You’re all caught up.</p>
      ) : (
        <ul className="divide-y">
          {notifications.map((n) => (
            <li key={n.id}>
              <button
                className={`flex w-full items-start gap-3 py-3 text-left ${!n.readAt ? "font-semibold" : ""}`}
                onClick={() => { void markRead(n.id); router.push(notificationHref(n)); }}
              >
                <span className="text-xl">{NOTIFICATION_ICON[n.type] ?? "🔔"}</span>
                <span className="flex-1">
                  <span className="block">{n.title}</span>
                  {n.body && <span className="block text-sm font-normal text-zinc-500">{n.body}</span>}
                </span>
                {!n.readAt && <span className="mt-2 h-2 w-2 rounded-full bg-[#E5484D]" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
