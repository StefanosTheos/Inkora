"use client";
import { publicStorageUrl, useConversations } from "@inkora/data-access";
import Link from "next/link";

import { env } from "../../lib/env";
import { getSupabaseBrowser } from "../../lib/supabase-browser";

const img = (p?: string | null) => (p ? publicStorageUrl(env.SUPABASE_URL, p) : undefined);

export function ConversationsList() {
  const convs = useConversations(getSupabaseBrowser());
  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="mb-4 text-2xl font-bold">Chats</h1>
      {convs.isLoading ? (
        <p className="text-zinc-500">Loading…</p>
      ) : (convs.data ?? []).length === 0 ? (
        <p className="text-zinc-500">No conversations yet. Message an artist to start one.</p>
      ) : (
        <ul className="divide-y">
          {(convs.data ?? []).map((c) => (
            <li key={c.id}>
              <Link href={`/messages/${c.id}`} className="flex items-center gap-3 py-3">
                <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-[#1F1B2E] font-bold text-white">
                  {img(c.otherAvatarPath) ? <img src={img(c.otherAvatarPath)} alt={c.otherName} className="h-full w-full object-cover" /> : c.otherName.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={c.unread ? "font-extrabold" : "font-semibold"}>{c.otherName}</p>
                  <p className={`truncate text-sm ${c.unread ? "font-semibold text-black" : "text-zinc-400"}`}>{c.lastMessagePreview ?? "No messages yet"}</p>
                </div>
                {c.unread && <span className="h-2.5 w-2.5 rounded-full bg-[#E5484D]" />}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
