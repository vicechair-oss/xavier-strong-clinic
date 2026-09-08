# Airtable setup

This is your database and your admin panel. Build it before deploying, because the
site writes into it on the first registration.

Time: about 20 minutes.

---

## 1. Create the base

1. Go to airtable.com and sign in with the foundation's account, not a personal one.
2. Create a new base named **Xavier Strong Clinic**.
3. Rename the default table to **Registrations**.

Airtable's free plan allows 1,000 records per base. You expect 500+, so it fits,
but it is not a lot of headroom. If you cross 1,000 you will need a paid plan.
Airtable offers nonprofit discounts, worth asking about with the 501(c)(3) letter.

## 2. Create the fields

Delete Airtable's starter fields, then add these exactly. Names must match the
code, including capitalization.

| Field name | Type | Options |
|---|---|---|
| `Reference` | Single line text | Make this the primary field |
| `Player Name` | Single line text | |
| `Date of Birth` | Date | ISO format |
| `Grade` | Single select | 3rd, 4th, 5th, 6th, 7th, 8th, 9th, 10th, 11th, 12th |
| `T-Shirt Size` | Single select | Youth S, Youth M, Youth L, Youth XL, Adult S, Adult M, Adult L, Adult XL, Adult XXL |
| `Position` | Single select | Pitcher, Catcher, First base, Second base, Third base, Shortstop, Outfield, Utility, Not sure yet |
| `Guardian Name` | Single line text | |
| `Guardian Email` | Email | |
| `Guardian Phone` | Phone number | |
| `Emergency Contact` | Single line text | |
| `Emergency Phone` | Phone number | |
| `Medical Notes` | Long text | |
| `Other Notes` | Long text | |
| `Photo Consent` | Checkbox | |
| `Payment Status` | Single select | Unpaid, Paid, Paid (amount mismatch), Refunded, Waived |
| `Payment Method` | Single select | Venmo, PayPal, Cash at door, Waived |
| `Payment Ref` | Single line text | PayPal capture ID, or the Venmo note |
| `Paid At` | Date | |
| `Amount` | Currency | USD |
| `Source` | Single select | Web form, Walk-up, Phone |
| `Checked In` | Checkbox | Used day-of |
| `Coach Follow-Up` | Checkbox | |
| `Staff Notes` | Long text | For your team, not the parent |

Add one formula field, which saves you doing mental math at the field:

| Field name | Type | Formula |
|---|---|---|
| `Age At Clinic` | Formula | `DATETIME_DIFF('2026-10-09', {Date of Birth}, 'years')` |

## 3. Create the views

Views are the actual admin panel. Each one is a saved filter, and this is where
the work gets done.

**All Registrations** (Grid, default)
Everything, newest first.

**Unpaid** (Grid)
Filter: `Payment Status` is `Unpaid`.
This is your chase list. Under the Venmo handoff path it is also your daily
reconciliation queue.

**Check-In** (Grid)
Filter: `Payment Status` is not `Unpaid`.
Sort by `Player Name`. Show only: Player Name, Reference, Age At Clinic,
T-Shirt Size, Medical Notes, Checked In.
Open this on a phone at the field. Tap the checkbox as players arrive.

**Medical Flags** (Grid)
Filter: `Medical Notes` is not empty.
Print this before the clinic and give a copy to every coach and the first-aid
station. This is the view that matters most on the day.

**Shirt Counts** (Grid, grouped)
Group by `T-Shirt Size`. Airtable shows a count per group.
This is your ordering sheet.

**Roster By Age** (Grid, grouped)
Group by `Age At Clinic`. Use it to split players into stations.

## 4. Create the API token

1. Go to airtable.com/create/tokens.
2. Create a personal access token named **Xavier Strong site**.
3. Scopes: `data.records:read` and `data.records:write`.
4. Access: the **Xavier Strong Clinic** base only. Do not grant all workspaces.
5. Copy the token. Airtable shows it once.

You will paste it into Cloudflare as `AIRTABLE_TOKEN`. It never goes in the code
and never reaches the browser, because only the server-side function uses it.

Also grab the **base ID**: open the base, and it is the `appXXXXXXXXXXXXXX`
segment of the URL.

## 5. Reconciling Venmo payments (handoff path only)

Every parent is told to put their reference, for example `XS-SMI-1234`, in the
Venmo note. To reconcile:

1. Open the **Unpaid** view.
2. Open Venmo and look at recent payments.
3. For each payment, search the reference from the note in Airtable.
4. Set `Payment Status` to Paid, `Payment Method` to Venmo, paste the note or
   Venmo transaction ID into `Payment Ref`, and set `Paid At`.

Doing this once a day takes a few minutes. Letting it pile up to 500 does not.

Payments that arrive with no reference or a wrong one are the failure mode to
watch. Search by the payer's name against `Guardian Name`, and if you cannot
match it, leave it and email the parent. Do not guess.
