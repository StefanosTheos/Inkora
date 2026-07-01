"use client";
import { useMyAppointments, useMyRequests } from "@inkora/data-access";
import { APPOINTMENT_STATUS_LABEL, REQUEST_STATUS_LABEL } from "@inkora/domain";
import Link from "next/link";
import { useState } from "react";
import { getSupabaseBrowser } from "../../lib/supabase-browser";
import { fmtDateTime, money } from "./format";

export function BookingsList() {
  const client = getSupabaseBrowser();
  const appts = useMyAppointments(client);
  const reqs = useMyRequests(client, "client");
  const [tab, setTab] = useState<"upcoming" | "requests">("upcoming");
  const openReqs = (reqs.data ?? []).filter((r) => r.status !== "converted");

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="mb-4 text-2xl font-bold">My bookings</h1>
      <div className="mb-4 flex gap-2">
        {(["upcoming", "requests"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold ${tab === t ? "bg-black text-white" : "bg-zinc-100 text-zinc-600"}`}
          >
            {t === "upcoming" ? "Upcoming" : "Requests"}
          </button>
        ))}
      </div>

      {tab === "upcoming" ? (
        (appts.data ?? []).length === 0 ? <p className="text-zinc-500">No appointments yet.</p> : (
          <ul className="space-y-2">
            {(appts.data ?? []).map((a) => (
              <li key={a.id}>
                <Link href={`/booking/${a.id}`} className="flex items-center justify-between rounded-xl border p-3 hover:bg-zinc-50">
                  <div>
                    <p className="font-bold">{a.counterparty.name}</p>
                    <p className="text-sm text-zinc-500">{fmtDateTime(a.scheduledStart)} · {money(a.priceAmount)}</p>
                  </div>
                  <span className="text-xs font-semibold text-zinc-500">{APPOINTMENT_STATUS_LABEL[a.status]}</span>
                </Link>
              </li>
            ))}
          </ul>
        )
      ) : (
        openReqs.length === 0 ? <p className="text-zinc-500">No open requests.</p> : (
          <ul className="space-y-2">
            {openReqs.map((r) => (
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
        )
      )}
    </main>
  );
}
