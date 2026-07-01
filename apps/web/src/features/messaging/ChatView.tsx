"use client";
import { getChatSignedUrl, publicStorageUrl, uploadChatFile, useAuth, useChat, useConversations } from "@inkora/data-access";
import { type Message, messageKind } from "@inkora/domain";
import { useEffect, useRef, useState } from "react";
import { env } from "../../lib/env";
import { getSupabaseBrowser } from "../../lib/supabase-browser";

const img = (p?: string | null) => (p ? publicStorageUrl(env.SUPABASE_URL, p) : undefined);

export function ChatView({ conversationId }: { conversationId: string }) {
  const client = getSupabaseBrowser();
  const { ctx } = useAuth();
  const meId = ctx.userId;
  const chat = useChat(client, conversationId, meId);
  const convs = useConversations(client);
  const conv = convs.data?.find((c) => c.id === conversationId);
  const title = conv?.otherName ?? "Chat";
  const avatarUrl = img(conv?.otherAvatarPath);
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastTyping = useRef(0);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chat.messages.length, chat.typingOther]);

  const lastMineId = [...chat.messages].reverse().find((m) => m.senderId === meId)?.id;
  const seen = !!(chat.otherReadAt && lastMineId && (() => {
    const lm = chat.messages.find((m) => m.id === lastMineId);
    return lm ? new Date(lm.createdAt) <= new Date(chat.otherReadAt!) : false;
  })());

  const onChange = (t: string) => {
    setText(t);
    const now = Date.now();
    if (now - lastTyping.current > 1500) { chat.sendTyping(); lastTyping.current = now; }
  };
  const onSend = () => { if (text.trim()) { chat.sendText(text.trim()); setText(""); } };
  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.type.includes("png") ? "png" : "jpg";
    const path = await uploadChatFile(client, conversationId, file, file.type, ext);
    chat.sendImage(path);
    e.target.value = "";
  }

  return (
    <main className="mx-auto flex h-screen max-w-2xl flex-col">
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-[#1F1B2E] text-sm font-bold text-white">
          {avatarUrl ? <img src={avatarUrl} alt={title} className="h-full w-full object-cover" /> : title.charAt(0).toUpperCase()}
        </div>
        <span className="text-lg font-bold">{title}</span>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {chat.messages.map((m) => <Bubble key={m.id} message={m} mine={m.senderId === meId} isLastMine={m.id === lastMineId} seen={seen} />)}
        {chat.typingOther && <p className="mt-2 text-sm italic text-zinc-500">typing…</p>}
        <div ref={bottomRef} />
      </div>

      <div className="flex items-center gap-2 border-t p-3">
        <label className="cursor-pointer text-zinc-500">📎<input type="file" accept="image/*" className="hidden" onChange={onFile} /></label>
        <button className="text-zinc-500" onClick={() => { chat.sendQuote({ description: text.trim() || undefined }); setText(""); }}>💬</button>
        <button className="text-zinc-500" onClick={() => { chat.sendConsultation({ note: text.trim() || undefined }); setText(""); }}>📅</button>
        <input
          className="flex-1 rounded-full bg-zinc-100 px-4 py-2"
          placeholder="Message"
          value={text}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSend()}
        />
        <button className="font-semibold text-[#E5484D] disabled:opacity-40" disabled={!text.trim()} onClick={onSend}>Send</button>
      </div>
    </main>
  );
}

function Bubble({ message, mine, isLastMine, seen }: { message: Message; mine: boolean; isLastMine: boolean; seen: boolean }) {
  const kind = messageKind(message);
  return (
    <div className={`my-1 flex flex-col ${mine ? "items-end" : "items-start"}`}>
      <div className={`max-w-[75%] rounded-2xl px-3 py-2 ${mine ? "bg-[#E5484D] text-white" : "bg-zinc-100 text-black"}`}>
        {kind === "text" && <span>{message.body}</span>}
        {kind === "image" && <SignedImage path={message.attachments[0]?.path} />}
        {kind === "voice" && <SignedAudio path={message.attachments[0]?.path} />}
        {(kind === "quote" || kind === "consultation") && (
          <div>
            <p className="font-bold">{kind === "quote" ? "💬 Quote request" : "📅 Consultation request"}</p>
            <p className="text-sm opacity-90">{Object.values(message.metadata).filter((v) => typeof v === "string" && v !== kind).join(" · ")}</p>
          </div>
        )}
      </div>
      {mine && isLastMine && <span className="mt-0.5 text-xs text-zinc-400">{seen ? "Seen" : "Sent"}</span>}
    </div>
  );
}

function SignedImage({ path }: { path?: string }) {
  const [url, setUrl] = useState<string>();
  useEffect(() => { if (path) void getChatSignedUrl(getSupabaseBrowser(), path).then((u) => setUrl(u ?? undefined)); }, [path]);
  return url ? <img src={url} alt="" className="h-52 w-52 rounded-xl object-cover" /> : <div className="h-52 w-52 rounded-xl bg-zinc-200" />;
}
function SignedAudio({ path }: { path?: string }) {
  const [url, setUrl] = useState<string>();
  useEffect(() => { if (path) void getChatSignedUrl(getSupabaseBrowser(), path).then((u) => setUrl(u ?? undefined)); }, [path]);
  return url ? <audio controls src={url} className="h-8" /> : <span>🎤 Voice</span>;
}
