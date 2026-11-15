# Synthetic demo fixture

A small static site ("Demo Console") used to exercise the recording pipeline end to end
when the real product cannot be reached: in CI, offline, or before a demo environment is
ready. It is plain HTML, CSS and JavaScript with no build step and no network requests.

It simulates a booking business that takes manual deposit payments. It is **not** the Iker
dashboard and must never be presented as if it were.

## Rules

Anyone changing this fixture keeps all of these true:

- **Always labelled.** Every page carries the fixed banner
  "SYNTHETIC DEMO — simulated data, not the Iker product". It is in each page's HTML, not
  added by script, so it cannot fail to appear.
- **Does not look like the product.** System fonts, a grey and slate palette, no Iker logo,
  no terracotta or other Iker brand colours, and the product is named "Demo Console". It
  uses Iker's own terminology, read from the web app's source ("Rate card item",
  "New walk-in booking", "Record a payment", "Amount received (₦)", "Balance remaining"),
  so that an explanation recorded here is accurate.
- **Obviously synthetic people and businesses.** Names such as "Sample Client A" and
  "Sample Studio", email addresses only at `example.com`, phone numbers such as
  `0800 000 0001`, ids such as `demo-booking-2041`.
- **Naira, formatted as Iker shows it.** Amounts read like `₦45,000`.
- **Deterministic.** Every date and value is fixed. Nothing reads the clock or uses
  randomness, so two recordings of the same scenario show the same thing.
- **Accessible names on everything.** Scenarios may only find elements by role, label,
  visible text or test id, so every control here has one.
- **No real uploads.** "Upload proof of payment" attaches a named sample file without
  opening a file picker or reading the disk.

## Pages

| Path                          | What it shows                                                                                                                                                                                      |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/login`                      | Iker's log-in flow: "Email" and "Send magic link" (simulated, sends nothing), then "Use a password instead", "Email", "Password", "Log in". Accepts any non-empty values, then opens `/dashboard`. |
| `/dashboard`                  | Heading "Dashboard": this month's income, expenses and profit, today's bookings, "+ Walk-in" and a "View bookings" link.                                                                           |
| `/bookings`                   | Heading "Bookings": five sample bookings with status, payment status and balance; "Search client name" filters them; "+ Add walk-in".                                                              |
| `/bookings/new`               | Heading "New walk-in booking": Appointment, Customer and Payment sections and "Save booking", which reports "Booking saved" in the "Save status".                                                  |
| `/bookings/demo-booking-2041` | Sample Client A's Box braids booking (₦45,000, 30% deposit). "Record a payment" opens a dialog; saving updates the Payments section and "Payment update".                                          |

Logging in sets a `sessionStorage` flag; nothing typed into the form is stored or sent. Every
other page redirects to `/login` when the flag is missing. Nothing a page changes is kept:
reloading it starts again from the fixed data.

## Serving it

```ts
const server = await startStaticServer({
  mounts: { "/": "fixtures/synthetic-demo" },
  htmlFallback: true,
});
```

The scenarios that drive it live in `src/scenarios/synthetic.ts`.
