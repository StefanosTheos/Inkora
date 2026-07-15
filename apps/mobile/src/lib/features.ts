/**
 * App feature flags. Flip a value to enable/disable a feature app-wide.
 *
 * EMAIL_NOTIFICATIONS_ENABLED: gated OFF until a verified sending domain is set
 * up in Resend (see supabase/functions/send-welcome-email). While off, the
 * onboarding email-consent step and the Account Settings email toggle are
 * hidden. The backend already treats email as opt-in/off by default, so flipping
 * this back to `true` is all that's needed to re-enable — no data migration.
 */
export const EMAIL_NOTIFICATIONS_ENABLED: boolean = false;
