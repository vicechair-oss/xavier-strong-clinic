# Deploying to Cloudflare Pages

Time: about 30 minutes the first time. Do the Airtable setup first.

---

## 1. Put the code on GitHub

Create a repo under the foundation's account, not a personal one, so the site
does not disappear when someone graduates.

```bash
cd xavier-strong-clinic
git init
git add .
git commit -m "Xavier Strong Clinic registration"
git remote add origin https://github.com/<org>/xavier-strong-clinic.git
git push -u origin main
```

`.gitignore` already excludes `.dev.vars`, so secrets stay out of the repo.
If a token ever does get committed, rotate it rather than deleting the commit.

## 2. Create the Pages project

1. Cloudflare dashboard, **Workers & Pages**, **Create**, **Pages**,
   **Connect to Git**.
2. Pick the repo.
3. Build settings:
   - Framework preset: **None**
   - Build command: leave empty
   - Build output directory: `public`
4. Deploy.

There is no build step. It is static files plus functions, which is why the
free tier covers it comfortably.

## 3. Add the environment variables

**Settings**, **Environment variables**, **Production**. Add each as an
**encrypted** secret, not plaintext:

| Name | Value |
|---|---|
| `AIRTABLE_TOKEN` | the token from Airtable step 4 |
| `AIRTABLE_BASE_ID` | `appXXXXXXXXXXXXXX` |
| `AIRTABLE_TABLE` | `Registrations` |

For the Pay with Venmo path, also add `PAYPAL_CLIENT_ID`, `PAYPAL_SECRET`, and
`PAYPAL_ENV` (`sandbox` while testing, `live` when you go live).

Redeploy after adding variables. Cloudflare does not apply them to an existing
deployment.

## 4. Point the domain

**Custom domains**, add for example `register.allthingsfoundation.org`. If the
domain is already on Cloudflare the DNS record is created for you. Otherwise
add the CNAME they show you at your registrar.

HTTPS is automatic.

---

## Switching payment paths

Everything lives in one block at the top of `public/app.js`.

**Venmo handoff** (no PayPal account needed):

```js
paymentMode: 'venmo-handoff',
venmoHandle: 'AllThingsFoundation',   // exact username, no @
```

**Pay with Venmo** (automatic, needs a PayPal business account):

```js
paymentMode: 'paypal-venmo',
paypalClientId: 'AXXXxxxx...',        // from the PayPal developer dashboard
```

Commit, push, and Cloudflare redeploys on its own. No rebuild, no data
migration. Registrations already in Airtable are unaffected.

---

## Before you launch: test it

Do all of these on a phone, not just a laptop. Most parents will register on a
phone.

- [ ] Submit a real registration. Confirm the row lands in Airtable with every
      field populated.
- [ ] Confirm the reference on screen matches the `Reference` in Airtable.
- [ ] **Tap the Venmo button on an actual phone with Venmo installed.** Confirm
      it opens Venmo with the amount and note prefilled. Venmo's link parameters
      are not officially documented and can change without notice, so verify
      this yourself rather than trusting that it works. If the note does not
      prefill, the fallback text on the page tells the parent what to type, so
      registration still works, but you will reconcile more slowly.
- [ ] Submit with a blank required field and confirm it is refused.
- [ ] Submit with a medical note and confirm it appears in the Medical Flags view.
- [ ] For the PayPal path, run a full sandbox payment before switching
      `PAYPAL_ENV` to `live`, then run one real $20 payment and refund it.

## Watching it during registration

Cloudflare, **Workers & Pages**, your project, **Functions**, **Real-time logs**.

The functions log loudly on failure. The one to watch for is
`register: airtable write failed`, which means a parent submitted and the row
did not save. That is the only failure that silently loses a registration, so
check logs daily during the run-up.

If Airtable hits its 1,000-record cap, writes start failing and this is what you
will see. Upgrade before that happens rather than after.
