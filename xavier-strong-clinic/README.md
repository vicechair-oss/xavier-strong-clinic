# Xavier Strong Baseball Clinic

Registration site for the inaugural All Things Foundation Xavier Strong Baseball
Clinic. October 9, 2026, 6:00 to 9:00 PM. Ages 8 to 18. $20.

## What this is

A static registration form on Cloudflare Pages, with three server-side functions
that write to Airtable and, optionally, take payment through PayPal's Venmo
integration. Airtable is both the database and the admin panel.

```
public/index.html          the form
public/app.js              step flow, validation, payment. CONFIG block at the top
functions/api/register.js  validates and writes the registration to Airtable
functions/api/create-order.js   PayPal order, $20 fixed server-side
functions/api/capture-order.js  captures payment, marks the Airtable row Paid
```

## Setup

1. [docs/AIRTABLE_SETUP.md](docs/AIRTABLE_SETUP.md) - build the base and views first
2. [docs/DEPLOY.md](docs/DEPLOY.md) - deploy, configure, and test

## Payment

Two paths, switched by one line in `public/app.js`.

**Venmo handoff** (default). The parent is handed a Venmo link with the amount
and their registration reference prefilled. Staff match payments to rows in the
Unpaid view. No PayPal account needed. Someone has to do the reconciling.

**Pay with Venmo.** A Venmo button on the page. Payment is captured and the
Airtable row is marked Paid automatically. Requires a PayPal business account,
because PayPal's checkout is the only supported way to accept Venmo on a
website. Venmo has no standalone merchant API.

Start on the handoff path if the account is not ready. Switching later is a
one-line change and does not affect registrations already collected.

## Local development

```bash
npm install -g wrangler
cp .dev.vars.example .dev.vars   # fill in real values
wrangler pages dev public
```

## Notes

- The `$20` amount is set server-side in `functions/_shared.js`. The browser
  never sends a price, so it cannot be tampered with.
- `AIRTABLE_TOKEN` and `PAYPAL_SECRET` are only ever read inside functions. They
  do not reach the browser.
- The form carries a hidden honeypot field to absorb basic bot submissions.
- Walk-ups are accepted at the clinic. Add those to Airtable by hand with
  `Source` set to Walk-up.
