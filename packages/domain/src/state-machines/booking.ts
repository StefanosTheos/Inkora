import type { AppointmentStatus, OfferStatus, RequestStatus } from "../enums";

/**
 * Declarative legal-transition tables for the booking flow.
 * This is DATA, not logic — the guard checks (who may transition, side effects)
 * live in data-access's BookingService. RLS enforces "who"; these enforce "what".
 */
export const APPOINTMENT_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  scheduled: ["rescheduled", "completed", "cancelled", "no_show"],
  rescheduled: ["rescheduled", "completed", "cancelled", "no_show"],
  completed: [], // terminal → unlocks review + rewards
  cancelled: [],
  no_show: [],
};

export const REQUEST_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  pending: ["reviewing", "declined", "cancelled", "expired"],
  reviewing: ["offered", "declined", "cancelled", "expired"],
  offered: ["accepted", "declined", "cancelled", "expired"],
  accepted: ["converted", "cancelled"],
  declined: [],
  expired: [],
  cancelled: [],
  converted: [],
};

export const OFFER_TRANSITIONS: Record<OfferStatus, OfferStatus[]> = {
  pending: ["accepted", "declined", "withdrawn", "expired"],
  accepted: [],
  declined: [],
  withdrawn: [],
  expired: [],
};

// TODO: export a pure `canTransition(from, to, table)` helper (still pure — no IO).
