# My Family Allowance — Functional Documentation

A private, single-family allowance tracker. One parent owns the family account;
kids each get their own sign-in to view their balance and record their own
spending. Built with Astro (server-rendered), Firebase Hosting + Cloud Functions,
and Firestore.

## 1. Accounts & access

- **Parent setup**: the first parent claims the account at `/setup` using a
  private deployment token (`INITIAL_SETUP_TOKEN`); only `OWNER_EMAIL` can
  initialize it, and setup succeeds once.
- **Parent sign-in**: email + password at `/parent-login`. An existing parent
  can create additional parent accounts for the same family (`/admin` → Add a
  parent), each with its own password.
- **Kid sign-in**: a generated username + parent-set password at `/kid-login`.
  Parents can reset a kid's password or disable their sign-in entirely from
  `/admin`.
- **Passwords**: 12–128 characters, hashed server-side with random-salted
  scrypt (N=131072, r=8, p=1). No plaintext or reversible password is stored,
  and passwords cannot be displayed — only reset.
- **Sessions**: one sealed cookie per browser identifies either a parent or a
  kid. Signing in as someone else on the same browser switches the active
  account. Password changes invalidate that account's existing sessions.
- **Scoped visibility**: kids only ever see their own balance and history.
  Parents see every kid in their family plus family-wide summaries.
- **Family URL**: each family has a short slug (`/f/<slug>`); kids also have a
  memorable vanity URL (`/<kid-name>`) that redirects to their page.

## 2. Kids

- Parents add a kid with a name, a monthly allowance, and an optional monthly
  spending limit (blank = unlimited; zero = warn on any purchase).
- Each kid can pick an avatar character from a fixed set (fox, robot, panda,
  unicorn, dinosaur, cat, astronaut, penguin, frog, lion, octopus, bear); the
  chosen avatar shows on their own page and on the parent dashboard.
- A kid's optional email is stored encrypted at rest; a parent must re-enter
  their own password to view or change it.
- Deleting a kid revokes their sign-in first (no new sessions can start during
  cleanup), then recursively deletes the kid and all of their transactions and
  planned items.

## 3. Money & balances

- A kid's balance is the sum of every one of their transactions, each
  converted to CAD cents for display (`formatMoney`).
- **Monthly allowance credit**: a scheduled Cloud Function runs the 1st of
  each month at 7am America/Vancouver and credits every kid their configured
  monthly allowance. Each credit uses a deterministic transaction ID
  (`allowance-<date>`) so retries or overlapping invocations never double-pay.
- **Currencies**: transactions can be recorded in CAD or ILS; everything is
  converted to CAD for balance and spending-limit math.

## 4. Transactions

A transaction has: amount (cents, signed), currency, memo, an optional
**category**, a date, and whether it came from the scheduled allowance.

- **Kids** can record two kinds of entry from their own page's "Add purchase"
  panel:
  - **Purchase** — a negative entry. Requires a description (what/where) and
    accepts an optional date, currency, and category.
  - **Gift from family** — a positive entry (money received), e.g. a cash
    gift. Uses the same form with a "Type" switch; hides the location/category
    fields since they don't apply.
- **Parents** can add or deduct any amount directly for a kid from `/admin`
  ("Add / deduct"), with memo, category, currency, and a backdated/forward-
  capped date.
- **Editing**: parents can edit any transaction inline from the kid's
  transaction history (date, amount, currency, memo, category). Editing is
  parent-only both in the UI (hidden from kids) and server-side (the API route
  requires a parent session regardless of what the client sends).
- **Deleting**: parents can permanently delete a transaction from the same
  inline row, with a confirmation prompt. Also parent-only, enforced
  server-side.
- **Over-limit confirmation**: if a kid's purchase would push their monthly
  spending over their configured limit, the purchase is held and the kid is
  shown a warning (current spend, new total, amount over) with the option to
  confirm anyway or cancel — nothing is recorded until they decide.

## 5. Categories & family spending rules

Categories are free text (with autocomplete suggestions) rather than a fixed
enum, so historical/imported data is never invalidated. The suggested list —
and the special handling below — mirrors the family's written policy in
`data/rules.md`.

- Suggested categories: **Clothing, Recreation & Sport, Food, Entertainment &
  Connectivity, Transportation, Toileting & Care, Other**.
- **Parent-paid categories** — Recreation & Sport, Transportation,
  Entertainment & Connectivity, and Toileting & Care — are, per the family
  rules, covered by parents and are **excluded from the kid's monthly
  spending-limit calculation**. They still appear in the transaction history
  as normal, tagged with a muted **"Parent-paid"** badge so nothing is hidden
  — it's just visually marked as not counting against the kid's own budget.
- **Clothing yearly cap**: each kid gets $500 CAD/year for clothing (their own
  money — it still counts toward the monthly limit). A dedicated "Clothing
  budget" gauge on the kid's page and on the admin dashboard tracks spend
  against this cap for the selected year.
- University and driving-lesson rules from `data/rules.md` are documented on
  the rules page but have no budget tracking in the app yet.

## 6. Spending visibility

- **Kid page**: a "Monthly spending" panel shows spend so far this month
  against the kid's limit (or their allowance as a soft reference if no limit
  is set), plus the Clothing yearly-cap gauge described above.
- **Admin dashboard** — "Spending — all kids combined":
  - A **month picker** (defaults to the current month, can't go into the
    future) drives a combined gauge plus a per-kid gauge grid for that month.
  - A **yearly expense** section with a **year picker** (current year back 5
    years) shows total and per-kid spend for the selected calendar year.
  - A **Clothing budget** gauge grid for the selected year, one bar per kid.

## 7. Transaction history

- Paginated (20 per page) on the kid's page, newest first. Pagination is a
  numbered control (Prev / page numbers with an ellipsis for far-away pages /
  Next), with the current page highlighted, replacing a simple Older/Newer
  toggle.
- Columns: Date, Amount, Memo, Category (with the Parent-paid badge where it
  applies), and — parents only — an Edit action that expands an inline
  edit/delete form for that row.

## 8. Planned next-month spending

- A kid can save a link + description + amount they're saving up for
  ("Planned next month spending" panel). The server fetches the page's
  `og:image` to show a thumbnail (with SSRF protections: http/https only,
  private/localhost hosts blocked, 5s timeout, response capped at 200KB).
- Each planned item has a **"Buy now"** action that pre-fills the Add Purchase
  form with that item's amount/description/currency — it does not commit
  anything until the kid actually submits the purchase.
- A planned item can be **archived** once bought or no longer wanted; archived
  items drop out of the list but aren't deleted.

## 9. Family rules page

- `/f/<slug>/rules` renders `data/rules.md` (the family's written expense
  policy — income, university, driving lessons, clothing, recreation & sport,
  food, entertainment, transportation, toileting & care) as a readable page.
  Linked from both the admin dashboard and every kid's page. Viewable by any
  parent or kid who belongs to that family; redirects anyone else to sign in.

## 10. Bulk CSV transaction import (operator tool)

- `scripts/import-csv-transactions.mjs` is a one-off, locally-run script (not
  part of the deployed app) that reads `data/<kid-name>/transaction-history*.csv`
  (a card-transaction export: ID, status, direction, dates, source/target
  amounts & currencies, merchant name, category) and imports one transaction
  per row under the matching kid — capturing amount, currency, date,
  merchant name (as the memo), and category.
- Idempotent: each imported transaction is stored under a deterministic doc ID
  derived from the CSV row's own transaction ID, so re-running the script after
  new rows are appended only imports the new ones.

## 11. Security & data model notes

- Firestore security rules deny all direct client access; every read/write
  goes through server-side API routes using the Admin SDK, with server-side
  role checks (parent vs. the specific kid) on every route.
- Same-origin enforcement on form submissions; login attempts are rate-limited.
- Data model: `parents/{id}`, `kids/{id}` with subcollections
  `transactions/{id}` and `plannedItems/{id}`; a `familySlugs/{slug}` lookup
  maps a family's short URL to its owning parent.

## 12. Other pages

- `/privacy` and `/terms` — Privacy Policy and Terms of Use, linked from the
  home page footer.
- Local demo mode (`DEMO_MODE=true`) seeds sample kids/transactions in memory
  for trying the UI without Firebase; resets on server restart and cannot run
  in production.
