# INT — AI COO: setup notes

INT is now positioned as an **AI COO (Chief Operating Officer)** for African SMEs
(starting with Ghana). The **Home** page is a daily *Morning Brief* computed from
real business records — cash, receivables, sales trend, best-seller margin, cash
runway, low stock — plus decision cards INT can act on, and a business-grounded
"Ask INT" chat.

## What was added

**Backend (`server/`)**
- `prisma/schema.prisma` — business models: `Product`, `Customer`, `SalesInvoice`,
  `SalesInvoiceItem`, `Payment`, `Expense`, `CooAction`. They use a scalar
  `workspaceId` (no back-relations) so existing models are untouched.
- `src/routes/coo.ts` — `/api/coo/*` routes. `computeBrief()` derives every KPI
  **deterministically from the database** (no LLM, so it's always accurate and
  works even without a model key). Endpoints: `GET /brief`, `GET /receivables`,
  `GET /inventory`, `POST /actions`, `GET /actions`.
- `src/routes/chat.ts` — injects the real Morning-Brief figures into the chat
  system prompt so INT answers "Who owes me?", "How's cash?", "Should I restock?"
  from actual data and never invents numbers.
- `prisma/coo-tables.sql` — raw SQL to create the COO tables (see below).
- `seed-coo.ts` — seeds a demo Ghanaian provisions shop.

**Frontend (`app/`)**
- `src/pages/CooHomePage.tsx` (+`.css`) — the Morning Brief home page.
- `/home` is the new default landing route; sidebar/nav rebranded to the COO framing.
- "Ask INT" box deep-links a question straight into the grounded chat.

## First-time database setup

The COO models are in `schema.prisma`, but `prisma db push` can fail on the
pgvector column used by document search (error P4002), so create the COO tables
with the included SQL instead:

```bash
cd server
npm run coo:tables     # runs prisma/coo-tables.sql against $DATABASE_URL
npm run pos:tables     # POS tables (settings, cashiers, shifts) + product/sale columns
npm run coo:seed       # optional: demo Ghanaian shop (cash, invoices, stock, a cashier)
```

## Point-of-sale (Till)

INT includes a tablet POS. Open it at **/pos** (or “Open Till” in the menu).

- **Install on a tablet:** open the site in Chrome and “Add to Home screen” — it
  installs as a fullscreen app (PWA) and the till keeps working offline.
- **Offline-first:** the catalogue is cached on the device; sales made with no
  internet are queued and sync automatically when the connection returns.
- **Cashiers & shifts:** staff sign in with a PIN, open the till with a cash
  float, and close it with a counted-cash Z-report (expected vs actual).
- **Hardware (per store):** toggle barcode scanner, receipt printer and cash
  drawer in **Till setup**. Barcode scanning supports keyboard-style USB/Bluetooth
  scanners; printing uses the browser print dialog to a connected receipt printer.
- **Tax:** optional per store (e.g. Ghana VAT/NHIL/GETFund), set in Till setup.
- Demo cashier: **Akosua**, PIN **1234** (from `coo:seed`).

**First-run setup:** if you skip `coo:seed` (empty business), the Home page shows a
short **welcome wizard** — the owner enters their shop name and a few starter
products/customers, then lands on their dashboard. Run `coo:seed` instead when you
want the populated demo. The wizard only appears until there's data or it's completed.

`coo:tables` needs `psql` on the machine and `DATABASE_URL` set. If you'd rather
not install `psql`, run the contents of `server/prisma/coo-tables.sql` from any
database client.

After that, start the app as usual — the Home page will show your live figures.

## Notes

- All money is Ghana cedis (GH₵). Sample customers/products are Ghanaian.
- The dashboard is LLM-free; only the *conversation* uses a model. Your OpenRouter
  key drives chat — set `OPENROUTER_API_KEY` (and pick OpenRouter as the provider).
- `CooAction` records approved decisions (e.g. "Reminder queued for …"). Actually
  sending WhatsApp/MoMo messages is a later integration; today it records intent.
