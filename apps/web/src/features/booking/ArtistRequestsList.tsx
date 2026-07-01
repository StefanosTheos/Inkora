"use client";
import { useMyRequests } from "@inkora/data-access";
import { type AppointmentRequestView, REQUEST_STATUS_LABEL } from "@inkora/domain";
import Link from "next/link";
import { getSupabaseBrowser } from "../../lib/supabase-browser";

export function ArtistRequestsList() {
  const client = getSupabaseBrowser();
  const reqs = useMyRequests(client, "artist");
  const items = reqs.data ?? [];
  const needsAction = items.filter((r) => r.status === "pending" || r.status === "reviewing");
  const rest = items.filter((r) => r.status !== "pending" && r.status !== "reviewing");

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="mb-4 text-2xl font-bold">Booking requests</h1>
      {items.length === 0 ? <p className="text-zinc-500">No requests yet.</p> : (
        <>
          <Group title="Needs your reply" items={needsAction} />
          <Group title="Other" items={rest} />
        </>
      )}
    </main>
  );
}

function Group({ title, items }: { title: string; items: AppointmentRequestView[] }) {
  if (items.length === 0) return null;
  return (
    <section className="mb-6">
      <h2 className="mb-2 text-sm font-bold text-zinc-500">{title}</h2>
      <ul className="space-y-2">
        {items.map((r) => (
          <li key={r.id}>
            <Link href={`/booking/${r.id}`} className="flex items-center justify-between rounded-xl border p-3 hover:bg-zinc-50">
              <div>
                <p className="font-bold">{r.title}</p>
                <p className="text-sm text-zinc-500">{r.counterparty.name}</p>
              </div>
              <span className="text-xs font-semibold text-zinc-500">{REQUEST_STATUS_LABEL[r.status]}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
