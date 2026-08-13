# ReimburseFlow

## Overview

ReimburseFlow is a full-stack expense reporting and approval workflow application.

**Every workflow ends at the General Manager.** The Executive Chairman is involved in exactly one case: a report submitted by the GM themselves. So an employee's report goes Manager → GM → QuickBooks bill → Reimbursed; the GM's own goes EC → QuickBooks bill → Reimbursed; and the EC's own goes to the GM. A direct report of the GM needs one approval, not two — the GM approving as their manager finalises it. Purchase orders always end at the GM and never reach the EC. The Accounts Payable stage has been removed (its status values survive on historical rows); final approval directly triggers QuickBooks bill creation.

These rules are enforced server-side in `canTransitionExpense` / `canTransitionPo` (`server/routes.ts`) and covered by `server/approval-rules.test.ts`. Nobody may approve their own submission, including admins, and stages cannot be skipped. The app features role-based views with a reporting structure (managerId on users), a dashboard with clickable summary cards, expense creation forms, approval queues filtered by direct reports, and admin user management with admin privileges separated from roles. Submitters can cancel or edit their own expenses at any stage (except Reimbursed/Cancelled). Editing a post-approval expense resets it to "Submitted" to restart the full approval process. Server-side ownership checks enforce that only the submitter can cancel or edit their own expenses. Expense history/audit trail tracks all changes (creation, status changes, edits).

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend

- **Framework**: React with TypeScript, bundled by Vite
- **Routing**: Wouter (lightweight client-side router)
- **State Management**: TanStack React Query for server state; React Context for auth/role state
- **UI Components**: shadcn/ui (new-york style) built on Radix UI primitives with Tailwind CSS v4
- **Styling**: Tailwind CSS with CSS variables for theming, custom fonts (Inter + Space Grotesk)
- **Path aliases**: `@/` maps to `client/src/`, `@shared/` maps to `shared/`

**Key pages:**
- `/` — Dashboard with expense summaries and statistics (when authenticated), Login page (when not)
- `/new-expense` — Expense creation form with validation (zod + react-hook-form)
- `/approvals` — "Action Needed" page: unified view with three tabs — Pending Review (expense/PO approvals), My Items (drafts, rejected expenses, POs needing info — all clickable), and History
- `/admin/users` — Admin panel for managing user roles

**Authentication**: OpenID Connect (OIDC) via OneLogin SSO. Users sign in through OneLogin (impulse.onelogin.com). Sessions managed via passport + connect-pg-simple for PostgreSQL-backed sessions. Login page shown when unauthenticated; session checked via GET /api/auth/user. Users are matched to existing app users by email (via `oidcId` field). New OIDC users automatically get a default Employee role. Secrets: `ONELOGIN_CLIENT_ID`, `ONELOGIN_CLIENT_SECRET`, `ONELOGIN_ISSUER_URL`.

**Role system**: Four roles — Employee, Manager, General Manager, Executive Chairman. Admin is a separate boolean flag (`isAdmin`) on any user; admins may act out of turn but still cannot approve their own submissions, nor apply a stage an expense does not have. `isAccountsPayable` no longer gates an approval stage (the AP stage is retired) but does permit marking an expense Reimbursed. User identity comes from OIDC session. Managers only see approvals from their direct reports (via managerId reporting structure). Admin page access is controlled by `isAdmin` flag.

### Backend

- **Framework**: Express 5 on Node.js with TypeScript (run via tsx)
- **API pattern**: RESTful JSON API under `/api/` prefix
- **Server entry**: `server/index.ts` creates an HTTP server, sets up OIDC auth (setupAuth + registerAuthRoutes), registers routes, and serves static files in production or uses Vite dev middleware in development
- **Auth integration**: `server/auth/` — OIDC setup via passport, session management, user upsert by oidcId/email matching

**API endpoints:**
- `GET /api/login` — Begin OIDC login flow (redirects to provider)
- `GET /api/callback` — OIDC callback handler
- `GET /api/logout` — End session and redirect
- `GET /api/auth/user` — Get current authenticated user (via OIDC session)
- `GET/POST /api/users` — List and create users
- `PATCH /api/users/:id/role` — Update user role
- `PATCH /api/users/:id/admin` — Update user admin status
- `PATCH /api/users/:id/manager` — Update user's reporting manager
- `GET /api/users/:id/direct-reports` — List direct reports for a manager
- `GET/POST /api/expenses` — List and create expenses (supports `?status=` and `?employeeId=` query filters)
- `PATCH /api/expenses/:id/status` — Update expense status
- `GET /api/expenses/:id/history` — Get expense change history
- `GET/POST /api/expenses/:expenseId/comments` — List and create comments on expenses
- `GET /api/notifications` — Get notifications for authenticated user
- `GET /api/notifications/unread-count` — Get unread notification count
- `PATCH /api/notifications/:id/read` — Mark a notification as read
- `POST /api/notifications/mark-all-read` — Mark all notifications as read
- `POST /api/scan-receipt` — Receipt scanning via local Tesseract OCR (`server/receipt-ocr.ts`), matched against the active categories. No API key and no per-scan cost; **requires the `tesseract` binary on PATH**.
- `GET /api/categories` — List active expense categories (public)
- `POST /api/categories` — Create a new category (admin-only)
- `DELETE /api/categories/:id` — Delete a category (admin-only)

### Database

- **Database**: PostgreSQL (required, via `DATABASE_URL` environment variable)
- **ORM**: Drizzle ORM with `drizzle-zod` for schema-to-validation integration
- **Schema location**: `shared/schema.ts` (shared between client and server), `shared/models/auth.ts` (sessions table)
- **Migrations**: Managed via `drizzle-kit push` (`npm run db:push`)
- **Connection**: `pg` Pool in `server/db.ts`

**Tables:**
- `users` — id (UUID), name, email (unique), role, is_admin (boolean), is_accounts_payable (boolean), department, manager_id (FK→users, nullable), avatar_initials, profile_picture, profile_image_url, oidc_id (unique, nullable), notify_email, notify_text, notify_webex (boolean), phone_number, created_at, updated_at
- `sessions` — sid (PK), sess (JSONB), expire (timestamp) — OIDC session storage
- `expenses` — id (UUID), description, amount (numeric), date, category, status, receipt_url, employee_id (FK→users), employee_name, notes, miles (numeric, nullable), created_at
- `comments` — id (UUID), expense_id (FK→expenses), author, text, date
- `notifications` — id (UUID), user_id (FK→users), type, title, message, expense_id (FK→expenses, nullable), is_read (boolean), created_at
- `expense_history` — id (UUID), expense_id (FK→expenses), action, from_status, to_status, changed_by, details, created_at
- `expense_categories` — id (UUID), name (unique), is_active (boolean), sort_order (numeric), created_at

**Seed data**: `server/seed.ts` populates initial users (without passwords) and sample expenses on first run (checks if users table is empty). OIDC users are linked to seed users by email matching.

### Shared Code

The `shared/` directory contains the database schema and Zod validation schemas used by both the frontend and backend. This ensures type safety across the stack. Key exports include `insertUserSchema`, `insertExpenseSchema`, `insertCommentSchema`, and TypeScript types for all entities.

### Running it locally

Prerequisites: Node 20+, PostgreSQL, and the **`tesseract`** binary (`brew install tesseract`) for receipt scanning.

```bash
createdb expense_po_manager        # plus a role, see DATABASE_URL below
npm install
npm run db:push                    # creates the tables from shared/schema.ts
npm run dev                        # http://localhost:$PORT
```

`npm run dev` and `npm run db:push` source `.env` (gitignored). Minimum to boot:

| Variable | Notes |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `PORT` | Note: **5000 is taken by AirPlay Receiver on macOS**; 5001 works |
| `APP_URL` | Required in production — see below |
| `SESSION_SECRET` | Any long random string |
| `BYPASS_AUTH` | `true` for local dev — see below |

Everything else (`QBO_*`, `MS_*`, `WEBEX_BOT_TOKEN`, `GUSTO_*`, `ONELOGIN_*`) is optional; the features degrade quietly when unset.

**`BYPASS_AUTH=true`** skips OneLogin entirely: `setupAuth` is not called (`server/index.ts`) and every request is treated as `mpapa@aseva.com` from the seed data. It exists so the app runs locally without real SSO credentials. It must never be set in a deployed environment — it disables all authentication, and `requireAuth` short-circuits on it.

**`APP_URL`** builds the OneLogin OIDC callback, the post-logout redirect, and the QuickBooks OAuth `redirect_uri`, all of which must exactly match what is registered with those providers. `getAppUrl()` (`server/app-url.ts`) therefore **throws at startup in production if it is unset**, rather than falling back to a wrong value.

### Build & Development

- **Dev mode**: `npm run dev` runs the Express server with Vite middleware for HMR, under `tsx watch` so server changes reload
- **Production build**: `npm run build` runs Vite for the client and esbuild for the server, outputting to `dist/`
- **Production start**: `npm start` serves the built files from `dist/` (`node dist/index.cjs`, static root `dist/public`)
- **Type checking**: `npm run check`. Server code is clean; there are pre-existing client-side errors, mostly in `purchase-orders.tsx`, which imports its types from `@/lib/mockData` rather than `@shared/schema`
- **Approval rules**: `npx tsx server/approval-rules.test.ts`

### Deployment notes

- Install the `tesseract` binary on the host (e.g. `apt-get install tesseract-ocr`), or receipt scanning returns an error and users fall back to manual entry.
- Set `APP_URL` to the real public origin, and give IT that origin so the OneLogin app's callback (`<APP_URL>/api/callback`) and the Intuit app's redirect URI (`<APP_URL>/api/quickbooks/callback`) match.
- Do **not** set `BYPASS_AUTH`.
- Run `npm run db:push` against the production database before first boot.

### Webex Notifications

- **Service module**: `server/webex.ts` — direct messages via a Webex bot
- **Secret**: `WEBEX_BOT_TOKEN`; disabled when unset
- **Trigger points**: the same events as email, sent to users with `notifyWebex=true`, addressed by email

### Email Notifications

- **Provider**: Microsoft Graph API via M365 (Azure AD app registration)
- **Service module**: `server/email.ts` — Graph API client with ClientSecretCredential auth
- **Dependencies**: `@azure/identity`, `@microsoft/microsoft-graph-client`
- **Secrets**: `MS_TENANT_ID`, `MS_CLIENT_ID`, `MS_CLIENT_SECRET` (Azure AD app registration)
- **Env vars**: `MS_SEND_FROM_EMAIL` (defaults to `expenses@aseva.com`)
- **Trigger points**: Email sent alongside in-app notifications when user has `notifyEmail=true`:
  - New expense submitted → manager gets email
  - Expense approved/rejected/reimbursed → submitter gets email (with rejection note if applicable)
  - Expense advances to the final approver (Manager Approved → GM, or → EC for a report the GM submitted) → that approver gets email. Final approval is the end of the chain; there is no notification after it.
  - New comment on expense → submitter gets email
  - Bulk status changes → each affected submitter gets email
- **Email templates**: Branded HTML emails with Aseva navy/teal colors, responsive layout
- **Error handling**: Non-blocking fire-and-forget with `.catch()`, graceful degradation if credentials missing

### QuickBooks Online Integration

- **Service module**: `server/quickbooks.ts` — OAuth 2.0 flow, bill creation, payment sync
- **Secrets**: `QBO_CLIENT_ID`, `QBO_CLIENT_SECRET` (from Intuit Developer portal)
- **Token encryption**: AES-256-GCM via `server/encryption.ts` with `enc:v1:` prefix marker; legacy plaintext tokens auto-encrypted on first read
- **Env vars**: `QBO_ENCRYPTION_KEY` (required, 32+ char random string for token encryption at rest), `QBO_SANDBOX` (set to "true" for sandbox mode, omit for production)
- **DB tables**: `quickbooks_tokens` (OAuth tokens + realm ID), `quickbooks_bills` (expense-to-QBO bill mapping), `gl_mappings` (category-to-GL account mapping, configurable via admin UI)
- **GL Mapping**: Each expense category maps to a QBO GL account (number, name, parent). Admins configure via UI at `/admin/quickbooks`. DB mappings override hardcoded defaults. Fallback defaults: Flights→6305 Airfare, Meals→6301 Meals & Entertainment, Hotel→6306 Hotel, Mileage→6303 Mileage, Taxi→6304 Local Transportation (all under "Travel and Entertainment" parent).
- **Flow**: When expense reaches "GM Approved" or "EC Approved" status → Bill auto-created in QBO → QBO user pays bill → Sync endpoint detects payment → Expense marked "Reimbursed"
- **Admin UI**: `/admin/quickbooks` — Connect/disconnect QBO account, GL account mapping tool, manual sync trigger, pending bills count. Sidebar label: "QuickBooks Online"
- **API endpoints**:
  - `GET /api/quickbooks/status` — Connection status (admin-only)
  - `GET /api/quickbooks/auth` — Start OAuth flow (admin-only)
  - `GET /api/quickbooks/callback` — OAuth callback handler
  - `POST /api/quickbooks/disconnect` — Disconnect QBO (admin-only)
  - `POST /api/quickbooks/sync` — Sync pending bills (admin-only)
  - `GET /api/quickbooks/bills` — List pending bills (admin-only)
  - `GET /api/gl-mappings` — List all GL mappings (admin-only)
  - `PUT /api/gl-mappings` — Create/update GL mapping (admin-only)
  - `DELETE /api/gl-mappings/:id` — Delete GL mapping (admin-only)
- **Integration is optional**: If QBO not connected, bill creation is silently skipped (fire-and-forget)

### Purchase Orders

- **Feature**: Full purchase order workflow with multi-level approval chain (same as expenses: Manager → GM → EC)
- **Pages**: `/purchase-orders` (list with expandable details), `/new-purchase-order` (creation form)
- **Sidebar**: "Purchase Orders" link; page has two tabs: Active (actionable POs) and Repository (full history searchable by vendor/requestor with Open/Rejected/Approved category filter)
- **Approvals integration**: PO approvals appear in the unified Approvals page alongside expense approvals; PO approval items contribute to the Dashboard Attention count
- **PO Numbering**: Auto-generated sequential `PO-00001`, `PO-00002`, etc.
- **Fields**: Vendor, Usage (Internal/Customer/Other), Description, Cost Breakdown (cost/tax/shipping/total), Billing Frequency (One-Time or Recurring with frequency and term), Project Name, Key Stakeholder, Notes
- **DB tables**: `purchase_orders`, `po_history`, `po_comments`, `po_attachments`
- **Notifications**: In-app notifications scoped per user — only shown when (1) a new task/approval action is needed by that user, or (2) a status change occurs on a PO/expense they submitted. Self-notification guards prevent users from being notified about their own actions. Types: `new_po`, `po_approval`, `po_rejection`, `po_more_info`, `po_approval_needed`, `new_expense`, `approval`, `rejection`, `approval_needed`, `comment`.
- **PO Admin**: Toggleable permission (`isPOAdmin` on users). PO Admin reviews submitted POs first and places orders after final approval.
- **Status flow**: Draft → Submitted → PO Admin Review → Manager Approved → GM Approved → Order Placed (or rejected/more info requested at any stage). Michael Papa (GM) is the final PO approver — POs do NOT go through Executive Chairman (Tony Papa). After GM approval, the PO goes directly to PO Admin (Dane Allen) who clicks "Mark as Ordered/Provisioned" and selects payment type (Already Paid or Accrual). This triggers QBO integration: "Already Paid" creates a QBO Expense (Purchase), "Accrual" creates a QBO Bill. The `paymentStatus` field on purchase_orders stores the selection ("paid" or "accrual"). QBO records are tracked in `quickbooks_bills` table with `purchaseOrderId` and `qboType` ("bill" or "expense") columns.
- **Rejection/More Info**: Managers can reject with a required reason; PO Admin cannot reject but can request more info. Both actions require a reason that is sent to the submitter via notification and recorded in PO history. Submitter can resubmit after "More Info Requested".
- **API endpoints**:
  - `GET /api/purchase-orders` — List POs (filtered by role/access)
  - `GET /api/purchase-orders/next-number` — Get next PO number
  - `GET /api/purchase-orders/:id` — Get single PO
  - `POST /api/purchase-orders` — Create PO
  - `PUT /api/purchase-orders/:id` — Edit draft PO
  - `PATCH /api/purchase-orders/:id/status` — Update PO status
  - `GET/POST /api/purchase-orders/:id/comments` — PO comments
  - `GET/POST /api/purchase-orders/:id/attachments` — PO attachments
  - `DELETE /api/purchase-orders/attachments/:id` — Delete attachment

### Documents

- **Feature**: Upload and manage business documents (invoices, W9s, W8s, contracts, receipts, quotes, insurance, licenses)
- **Page**: `/documents` (list with search/filter, upload dialog with drag-and-drop)
- **Sidebar**: "Documents" with FolderOpen icon, visible to all users
- **DB table**: `documents` (stores file data as Base64, up to 10MB per file)
- **Access**: Users see their own documents; admins see all documents
- **API endpoints**:
  - `GET /api/documents` — List documents (filtered by role)
  - `GET /api/documents/:id` — Get document details
  - `GET /api/documents/:id/download` — Download document file
  - `POST /api/documents` — Upload new document
  - `DELETE /api/documents/:id` — Delete document

## External Dependencies

- **PostgreSQL** — Primary database, connected via `DATABASE_URL` environment variable
- **Google Fonts** — Inter and Space Grotesk loaded from `fonts.googleapis.com`
- **Authentication** — OIDC via OneLogin SSO (openid-client, passport), express-session with connect-pg-simple for PostgreSQL-backed sessions
- **Tesseract OCR** — receipt scanning, via the `tesseract` binary (`brew install tesseract` locally; on a deployment host this must be installed explicitly, e.g. `apt-get install tesseract-ocr`). This is a **system prerequisite**, not an npm dependency.
- **Email** — Microsoft Graph API via @azure/identity and @microsoft/microsoft-graph-client for M365 email notifications
- **QuickBooks Online** — Intuit OAuth 2.0 + REST API for bill creation and payment sync
