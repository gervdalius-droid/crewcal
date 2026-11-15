// Public client config. The anon key is designed to be public: every rule that
// matters is enforced by row-level security in supabase/migrations/.
export const SB_URL = 'https://zlzkefhhzrzbturapjth.supabase.co';
export const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpsemtlZmhoenJ6YnR1cmFwanRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzNzUzNTQsImV4cCI6MjA5MDk1MTM1NH0.qUbCoA5nNeVq9bfZSYCwjQuziaH4XwHVup_bAXs-JFg';

// Must match AI_FREE_MONTHLY in the edge function (display only).
export const AI_FREE_MONTHLY = 25;

// Pricing shown on the upgrade sheet. Billing is not wired yet.
export const PRO_PRICE = { month: '€4.99', year: '€39' };
export const SUPPORT_EMAIL = 'hello@whossup.app';
