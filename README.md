# GnuCash Web

A modern, local web interface for [GnuCash](https://gnucash.org/) data files.
View accounts, edit transactions, import bank statements (QFX / CSV / XLSX),
run income statements and balance sheets, and project future cash flow — all
from a browser, with your data staying 100% on your machine.

> **Note:** This project assumes basic familiarity with [double-entry bookkeeping](https://en.wikipedia.org/wiki/Double-entry_bookkeeping), the accounting method used by GnuCash and most accounting software. If you're new to this concept, you may want to review the fundamentals before using or contributing to this project.


---

## Prerequisites

| Tool | Version | Required |
|------|---------|----------|
| [Node.js](https://nodejs.org/) | 18 or later | Yes |
| npm | bundled with Node | Yes |
| [Ollama](https://ollama.com/) | any | Optional — for AI Advisor |

No database, no cloud service, no account required.

---

## Quick start

### 1. Clone the repo

```bash
git clone https://github.com/JonahBreslow/ModernFinance.git
cd ModernFinance
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

## AI Financial Advisor (optional)

A floating chat assistant is built into the app. It has read-only access to your
real account balances, spending history, and budgets, and can answer questions
like *"where am I overspending?"* or *"what would a realistic budget look like?"*

All processing runs locally — your financial data is never sent anywhere.

### Setup

**1. Install Ollama**

Download and install from **[ollama.com](https://ollama.com/)**.

*Recommended:* `curl -fsSL https://ollama.com/install.sh | sh` 

**2. Start the Ollama server**

```bash
ollama launch openclaw
ollama serve
```

If you see `address already in use`, Ollama is already running — skip this step.

**3. Pull a model**

At the time of writing, the local options are 

- qwen3:8b
- glm-4.7-flash
- minimmax-m2.5:cloud

There are other cloud options as well, but these models do not remain local.

**4. Open the app**

Click the **✦ sparkles button** in the bottom-right corner of any screen.
The advisor will detect Ollama automatically and show the available models in a
dropdown. Select your model and start chatting.

> **Tip:** You can also use `ollama launch openclaw` to browse and download
> models interactively, then restart the app to pick them up.

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
- **AI Financial Advisor** — local LLM chat with full access to your financial data

---

## Your data is yours

- Nothing leaves your machine. The backend runs locally on port 3001.
- All writes produce GnuCash-compatible timestamped backups
  (`finances.gnucash.YYYYMMDDHHMMSS.gnucash`) and `.log` audit files.
- Your `.gnucash` file can still be opened in the GnuCash desktop app at any time.

---

## Spec-driven development (Spec-Kit)

This project was built using **spec-driven development** with [Spec-Kit](https://github.com/github/spec-kit), a workflow that turns natural-language feature descriptions into structured specs, technical plans, and implementation tasks before writing code.

### Workflow

Each feature follows a defined pipeline:

1. **Specify** — Describe the feature in plain language; Spec-Kit generates a formal specification (`spec.md`) with user stories, requirements, and success criteria.
2. **Clarify** — Resolve ambiguities through targeted questions; answers are recorded in the spec.
3. **Plan** — Generate a technical plan (`plan.md`), research notes (`research.md`), data model (`data-model.md`), and API/UI contracts (`contracts/`).
4. **Tasks** — Break the plan into dependency-ordered, executable tasks (`tasks.md`).
5. **Implement** — Execute tasks phase-by-phase, with checklists and manual validation (`quickstart.md`).

### Artifacts per feature

Features live under `specs/NNN-feature-name/`:

```
specs/001-recategorize-multi-split/
├── spec.md           # User stories, requirements, success criteria
├── plan.md           # Technical approach, architecture
├── research.md       # Design decisions and rationale
├── data-model.md     # Entities and validation rules
├── tasks.md          # Implementation task list
├── quickstart.md     # Manual test steps
├── contracts/        # API and UI contracts
└── checklists/       # Quality and acceptance checklists
```

### Benefits

- **Traceability** — Every feature links back to a spec; requirements stay testable and measurable.
- **Incremental delivery** — User stories are prioritized (P1, P2, P3); MVP can ship after the first story.
- **AI-friendly** — Structured artifacts give LLMs clear context for implementation and refactoring.

---

## License

MIT
