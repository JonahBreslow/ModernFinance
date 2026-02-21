# GnuCash Web

A modern, local web interface for [GnuCash](https://gnucash.org/) data files.
View accounts, edit transactions, import bank statements (QFX / CSV / XLSX),
run income statements and balance sheets, and project future cash flow — all
from a browser, with your data staying 100% on your machine.

---

## Prerequisites

| Tool | Version |
|------|---------|
| [Node.js](https://nodejs.org/) | 18 or later |
| npm | bundled with Node |

No database, no cloud service, no account required.

---

## Quick start

### 1. Clone the repo

```bash
git clone https://github.com/your-username/gnucash-web.git
cd gnucash-web
```

### 2. Install dependencies

```bash
npm install
npm install --prefix frontend
```

### 3. Start the dev server

```bash
npm run dev
```

This starts the backend on **port 3001** and the Vite frontend on **port 5173**
(or the next available port). Open **http://localhost:5173** in your browser.

### 4. Set up your data file

On first launch you'll see the **Setup** screen. Choose one of:

#### Option A — Link an existing GnuCash file

Enter the absolute path to your `.gnucash` file (e.g.
`/Users/you/Documents/finances.gnucash`). The file must already exist.
The app reads and writes it directly, creating GnuCash-compatible backups and
`.log` files in the same directory.

#### Option B — Start fresh

Enter a path for the new file (e.g. `/Users/you/Documents/finances.gnucash`).
The directory must exist. A new file will be created with starter accounts:

- **Assets** — Checking Account, Savings Account  
- **Liabilities** — Credit Card  
- **Income** — Salary, Other Income  
- **Expenses** — Groceries, Utilities, Housing, Transportation, Other  
- **Equity** — Opening Balances, Imbalance-USD  

You can rename, add, or delete any account afterwards.

The chosen path is saved to `app/.env` so you won't need to configure it again.

---

## Manual configuration (optional)

Instead of the setup wizard, copy `.env.example` to `.env` and set the path:

```bash
cp .env.example .env
# then edit .env:
GNUCASH_FILE=/absolute/path/to/finances.gnucash
```

---

## Project structure

```
app/
├── backend/          Express API server
│   ├── config.js     Path config & .env reader/writer
│   ├── parser.js     GnuCash XML → JS objects
│   ├── serializer.js JS objects → GnuCash XML
│   ├── importer.js   QFX / CSV / XLSX parser
│   ├── setup.js      New-file generator
│   └── index.js      Routes
├── frontend/         Vite + React + TypeScript
│   └── src/
│       ├── components/
│       ├── lib/      Utilities & API client
│       ├── store/    Zustand UI state
│       └── types/    TypeScript interfaces
├── .env              Your local config (gitignored)
├── .env.example      Template
└── package.json
```

---

## Features

- **Account tree** with live balances
- **Transaction register** per account, with split support
- **Create / rename / delete accounts** (right-click in the sidebar)
- **Income Statement** — multi-column, sortable by month
- **Balance Sheet** with retained earnings
- **Spending charts** on the dashboard
- **Projections** — mark recurring transactions, project 6-month cash flow
- **Recategorize** — bulk-reassign expense categories
- **Import** — QFX, CSV (Chase, BofA, Fidelity auto-detected), XLSX
  - Per-transaction ML category suggestion
  - Duplicate detection (FITID + fuzzy date/amount/description)
- **Search** across all transactions

---

## Your data is yours

- Nothing leaves your machine. The backend runs locally on port 3001.
- All writes produce GnuCash-compatible timestamped backups
  (`finances.gnucash.YYYYMMDDHHMMSS.gnucash`) and `.log` audit files.
- Your `.gnucash` file can still be opened in the GnuCash desktop app at any time.

---

## License

MIT
