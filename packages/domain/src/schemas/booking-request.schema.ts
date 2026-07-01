/**
 * EXAMPLE schema stub — shape only, NOT implemented.
 * Demonstrates the pattern every schema file follows.
 */
// import { z } from "zod";

// TODO: define and export the real schema, e.g.
// export const newAppointmentRequestSchema = z.object({
//   artistId: z.string().uuid(),
//   title: z.string().min(3).max(120),
//   budgetMin: z.number().nonnegative().optional(),
//   budgetMax: z.number().nonnegative().optional(),
//   ...
// }).refine(v => !v.budgetMin || !v.budgetMax || v.budgetMax >= v.budgetMin, {
//   message: "budgetMax must be >= budgetMin", path: ["budgetMax"],
// });
// export type NewAppointmentRequestInput = z.infer<typeof newAppointmentRequestSchema>;

export {};
