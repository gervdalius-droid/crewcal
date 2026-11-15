// Public client config. The anon key is designed to be public: every rule that
// matters is enforced by row-level security in supabase/migrations/.
export const SB_URL = 'https://zlzkefhhzrzbturapjth.supabase.co';
export const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpsemtlZmhoenJ6YnR1cmFwanRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzNzUzNTQsImV4cCI6MjA5MDk1MTM1NH0.qUbCoA5nNeVq9bfZSYCwjQuziaH4XwHVup_bAXs-JFg';

// Must match AI_FREE_MONTHLY in the edge function (display only).
export const AI_FREE_MONTHLY = 25;

// Pricing shown on the upgrade sheet. Billing is not wired yet.
export const PRO_PRICE = { month: '€4.99', year: '€39' };
export const SUPPORT_EMAIL = 'hello@whossup.app';

// ── Booking partners (how the trip planner earns) ────────────
// Paste what each affiliate programme gives you. Two forms work:
//   'aid=1234567'                               → added to the partner link as a query parameter
//   'https://tp.media/r?marker=..&p=..&u={url}' → a deep-link wrapper; {url} is replaced with the encoded partner link
// Empty = plain link, no commission. Keys match the cards in the trip planner.
export const AFFILIATE = {
  stay: '',      // Booking.com      (hotels, apartments, hostels)
  flights: '',   // Skyscanner
  trains: '',    // Omio             (trains & buses)
  car: '',       // Rentalcars
  todo: '',      // GetYourGuide     (tours, tickets, activities)
};
