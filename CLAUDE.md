# expense-po-manager

Expense reporting and purchase-order approval app for Aseva. React (Vite) + Express + Drizzle/Postgres. Migrated off Replit on 2026-08-13.

Read `ARCHITECTURE.md` for the full picture — routes, tables, integrations. This file covers only what is easy to get wrong.

## Running it

```bash
npm run dev        # http://localhost:5001
```

- **Port 5001, not 5000.** macOS AirPlay Receiver (ControlCenter) holds 5000.
- `npm run dev` and `npm run db:push` source `.env`, which is gitignored. If `.env` is missing the app will not start — see the table in ARCHITECTURE.md for the minimum set.
- Postgres is local via Homebrew `postgresql@16`. For `psql`, prepend `PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"`.
- Receipt scanning shells out to the **`tesseract` binary** (`brew install tesseract`). It is not an npm dependency, so it must be installed on any host that runs this.
- The dev server runs under `tsx watch`. Server edits reload; if a change seems to have no effect, check the server actually restarted rather than assuming the edit was wrong.

## Auth in development

`BYPASS_AUTH=true` in `.env` skips OneLogin entirely and treats every request as `mpapa@aseva.com` (Michael Papa — General Manager **and** admin).

Two consequences when testing:

- Authorization denials mostly will not reproduce through HTTP locally, because the session user is an admin. Test the rules as functions instead — that is what `server/approval-rules.test.ts` does.
- `BYPASS_AUTH` must never be set in a deployed environment. `requireAuth` short-circuits on it.

## The approval chain

**Every workflow ends at the General Manager.** The Executive Chairman is involved in exactly one case: a report submitted by the GM themselves.

- Employee/Manager report → their manager → GM → QuickBooks bill → Reimbursed
- GM's own report → EC → QuickBooks bill → Reimbursed
- EC's own report → GM
- A direct report of the GM needs **one** approval, not two
- Purchase orders always end at the GM and never reach the EC; the PO Admin then marks them ordered
- Nobody approves their own submission, admins included; stages cannot be skipped

Michael Papa is the GM, Tony Papa the EC.

Enforced in `canTransitionExpense` / `canTransitionPo` (`server/routes.ts`). Change the rules and the tests together:

```bash
npx tsx server/approval-rules.test.ts     # 44 checks
```

The code as exported from Replit did *not* match this — it routed everyone to the EC after GM approval. Do not "restore" that behaviour on the assumption the old code was right.

## Working on this safely

- **The local database holds data the user actually cares about**, not disposable fixtures. They use the running app themselves. Do not mutate seed rows to test; create clearly-marked throwaway records and delete them, including dependent rows in `expense_history`, `notifications`, `po_history`, `quickbooks_bills`.
- If data changed and you did not change it, **find out why before reverting it** — it was probably the user working in their own browser.
- Approving an expense past GM/EC calls `createBillForExpense`, which creates a **real bill in QuickBooks** when credentials are configured. They are not configured locally, but do not rely on that.

## State of play

Work is on branch `local-migration-and-fixes`, open as [PR #1](https://github.com/michaelapapa92/expense-po-manager/pull/1). `main` is the untouched Replit export, so anything here can be diffed against the original.

Done: local setup, local-OCR receipt scanning, five crash/corruption fixes, API-wide authentication, the approval rules above, and removal of the Replit scaffolding (17 unused deps, five dead directories, `.replit`).

Known and not addressed:

- **16 client-side type errors**, mostly `client/src/pages/purchase-orders.tsx` importing `PurchaseOrder`/`POStatus` from `@/lib/mockData` instead of `@shared/schema`. That stale copy lacks `More Info Requested` and `paymentStatus`. Type drift, not broken behaviour. `npm run check` to see them; server is clean.
- `new-purchase-order.tsx:26` and `purchase-orders.tsx:80` destructure `effectiveUser` from `RoleContextType`, which does not define it — reads `undefined` at runtime.
- Deployment is deferred. The plan was Render (managed Postgres, auto-deploy from GitHub); IT registers a OneLogin OIDC app against whatever URL that produces. `APP_URL` must be set — `getAppUrl()` throws in production without it, deliberately.
