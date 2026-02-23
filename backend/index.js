import express from 'express';
import cors from 'cors';
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { parseGnuCash } from './parser.js';
import { saveTransaction, saveAccount, renameAccount, deleteAccount, invalidateCache } from './serializer.js';
import { getGnuCashFile, setGnuCashFile, isConfigured, getProjectionsFile, getBudgetFile } from './config.js';
import { createNewGnuCashFile } from './setup.js';
import { parseImportFile, parseCsvWithMapping } from './importer.js';
import { v4 as uuidv4 } from 'uuid';

// multer: store uploaded file in memory (files are small — bank statements)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors());
app.use(express.json());

// In-memory store
let store = null;

async function getStore() {
  if (!store) {
    store = await parseGnuCash();
  }
  return store;
}

function invalidateStore() {
  store = null;
  invalidateCache();
}

function buildAccountMap(accounts) {
  return new Map(accounts.map((a) => [a.id, a]));
}

// ─── Setup / status endpoints ─────────────────────────────────────────────────

// GET /api/status — tells the frontend whether a data file is configured
app.get('/api/status', (_req, res) => {
  const filePath = getGnuCashFile();
  res.json({ configured: isConfigured(), filePath: filePath || null });
});

// POST /api/setup/link — point the app at an existing .gnucash file
app.post('/api/setup/link', async (req, res) => {
  try {
    const { filePath } = req.body;
    if (!filePath) return res.status(400).json({ error: 'filePath is required' });
    if (!existsSync(filePath)) return res.status(400).json({ error: `File not found: ${filePath}` });
    setGnuCashFile(filePath);
    store = null;
    res.json({ ok: true, filePath });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/setup/new — create a fresh GnuCash file with starter accounts
app.post('/api/setup/new', async (req, res) => {
  try {
    const { filePath } = req.body;
    if (!filePath) return res.status(400).json({ error: 'filePath is required' });
    if (existsSync(filePath)) return res.status(400).json({ error: 'File already exists at that path. Choose a different location.' });
    await createNewGnuCashFile(filePath);
    setGnuCashFile(filePath);
    store = null;
    res.json({ ok: true, filePath });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Local filesystem browser (for the setup file picker) ────────────────────

// GET /api/fs/home — returns the best starting directory (~/Documents if it exists, else ~)
app.get('/api/fs/home', (_req, res) => {
  const home = os.homedir();
  const docs = path.join(home, 'Documents');
  res.json({ path: existsSync(docs) ? docs : home });
});

// Helper: resolve whether a path (including symlinks) is a directory, without throwing
function isDir(fullPath) {
  try { return statSync(fullPath).isDirectory(); } catch { return false; }
}

// GET /api/fs/list?path=/some/dir — lists files and subdirectories
app.get('/api/fs/list', (req, res) => {
  try {
    const dir = req.query.path;
    if (!dir) return res.status(400).json({ error: 'path query param required' });

    const resolved = path.resolve(String(dir));
    if (!existsSync(resolved)) return res.status(404).json({ error: 'Path does not exist' });
    if (!isDir(resolved)) return res.status(400).json({ error: 'Path is not a directory' });

    let names;
    try {
      names = readdirSync(resolved);
    } catch (err) {
      return res.status(403).json({ error: `Cannot read folder: ${err.message}` });
    }

    const entries = [];
    for (const name of names) {
      if (name.startsWith('.')) continue; // skip dotfiles
      const fullPath = path.join(resolved, name);
      const entryIsDir = isDir(fullPath); // resolves symlinks properly
      const isGnuCash  = name.endsWith('.gnucash');

      if (!entryIsDir && !isGnuCash) continue; // only show dirs + .gnucash files
      entries.push({ name, isDir: entryIsDir, isGnuCash });
    }

    entries.sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    // Build parent path (null when already at filesystem root)
    const parent = resolved !== path.parse(resolved).root
      ? path.dirname(resolved)
      : null;

    res.json({ path: resolved, parent, entries });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Data endpoints (require a configured file) ───────────────────────────────

// GET /api/data - all accounts and transactions
app.get('/api/data', async (req, res) => {
  try {
    const data = await getStore();
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/accounts - just accounts
app.get('/api/accounts', async (req, res) => {
  try {
    const { accounts } = await getStore();
    res.json(accounts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/accounts - create a new account
app.post('/api/accounts', async (req, res) => {
  try {
    const { name, type, parentId, description, placeholder } = req.body;
    if (!name || !type) return res.status(400).json({ error: 'name and type are required' });

    const account = {
      id:          uuidv4().replace(/-/g, ''),
      name,
      type,
      parentId:    parentId || null,
      description: description || '',
      placeholder: !!placeholder,
      hidden:      false,
    };

    await saveAccount(account);

    // Update in-memory store
    store = null; // invalidate so next getStore() re-parses
    res.status(201).json(account);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/accounts/:id - delete an account
app.delete('/api/accounts/:id', async (req, res) => {
  try {
    const data = await getStore();
    await deleteAccount(req.params.id, data.transactions);
    store = null;
    res.json({ deleted: req.params.id });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/accounts/:id - rename an account
app.put('/api/accounts/:id', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'name is required' });
    await renameAccount(req.params.id, name.trim());
    store = null;
    res.json({ id: req.params.id, name: name.trim() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/transactions - all transactions (optionally filter by accountId)
app.get('/api/transactions', async (req, res) => {
  try {
    const { transactions } = await getStore();
    const { accountId } = req.query;
    if (accountId) {
      const filtered = transactions.filter((t) =>
        t.splits.some((s) => s.accountId === accountId)
      );
      res.json(filtered);
    } else {
      res.json(transactions);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/transactions - create
app.post('/api/transactions', async (req, res) => {
  try {
    const data = await getStore();
    const txn = {
      ...req.body,
      id: req.body.id || uuidv4().replace(/-/g, ''),
      dateEntered: new Date().toISOString().slice(0, 10),
    };
    data.transactions.push(txn);
    await saveTransaction(txn, 'create', null, buildAccountMap(data.accounts));
    res.json(txn);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/transactions/:id - update
app.put('/api/transactions/:id', async (req, res) => {
  try {
    const data = await getStore();
    const idx = data.transactions.findIndex((t) => t.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    const txnBefore = data.transactions[idx];
    const txnAfter = { ...txnBefore, ...req.body, id: req.params.id };
    data.transactions[idx] = txnAfter;
    await saveTransaction(txnAfter, 'update', txnBefore, buildAccountMap(data.accounts));
    res.json(txnAfter);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/transactions/:id
app.delete('/api/transactions/:id', async (req, res) => {
  try {
    const data = await getStore();
    const idx = data.transactions.findIndex((t) => t.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    const [txn] = data.transactions.splice(idx, 1);
    await saveTransaction(txn, 'delete', txn, buildAccountMap(data.accounts));
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/reload - force re-parse from disk
app.post('/api/reload', (_req, res) => {
  invalidateStore();
  res.json({ ok: true });
});

// GET /api/projections - load recurring item settings
app.get('/api/projections', (_req, res) => {
  try {
    const PROJECTIONS_FILE = getProjectionsFile();
    if (!existsSync(PROJECTIONS_FILE)) return res.json({ items: [] });
    const data = JSON.parse(readFileSync(PROJECTIONS_FILE, 'utf-8'));
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/projections - save recurring item settings
app.post('/api/projections', (req, res) => {
  try {
    writeFileSync(getProjectionsFile(), JSON.stringify(req.body, null, 2), 'utf-8');
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/budget - load monthly budget amounts
app.get('/api/budget', (_req, res) => {
  try {
    const file = getBudgetFile();
    if (!existsSync(file)) return res.json({ monthly: {} });
    res.json(JSON.parse(readFileSync(file, 'utf-8')));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/budget - save monthly budget amounts
app.post('/api/budget', (req, res) => {
  try {
    writeFileSync(getBudgetFile(), JSON.stringify(req.body, null, 2), 'utf-8');
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/change-log — parse all GnuCash .log files and return account-change entries
//
// Each GnuCash .log file is tab-separated with columns:
//   mod  trans_guid  split_guid  time_now  date_entered  date_posted
//   acc_guid  acc_name  num  description  notes  memo  action
//   reconciled  amount  value  date_reconciled
//
// We look for START/END blocks where a B row and C row exist for the same split_guid
// and the acc_guid differs — that indicates an account reassignment.
app.get('/api/change-log', (_req, res) => {
  try {
    const gf = getGnuCashFile();
    const GNUCASH_DIR      = path.dirname(gf);
    const GNUCASH_BASENAME = path.basename(gf);
    const logFiles = readdirSync(GNUCASH_DIR)
      .filter((f) => f.startsWith(GNUCASH_BASENAME + '.') && f.endsWith('.log'))
      .sort(); // chronological by timestamp in filename

    const changes = [];

    for (const filename of logFiles) {
      // Extract timestamp from filename: basename.YYYYMMDDHHmmss.log
      const tsMatch = filename.match(/\.(\d{14})\.log$/);
      const fileTimestamp = tsMatch ? tsMatch[1] : null;
      // "20260219210745" → ISO string
      const changedAt = fileTimestamp
        ? `${fileTimestamp.slice(0,4)}-${fileTimestamp.slice(4,6)}-${fileTimestamp.slice(6,8)}T${fileTimestamp.slice(8,10)}:${fileTimestamp.slice(10,12)}:${fileTimestamp.slice(12,14)}Z`
        : null;

      const content = readFileSync(path.join(path.dirname(getGnuCashFile()), filename), 'utf-8');
      const lines = content.split('\n');

      let inBlock = false;
      // splitGuid → { B: row, C: row }
      let block = {};

      for (const line of lines) {
        if (line.startsWith('===== START')) {
          inBlock = true;
          block = {};
          continue;
        }
        if (line.startsWith('===== END')) {
          inBlock = false;
          // Process the block — find splits where B acc_guid !== C acc_guid
          for (const [splitGuid, { B, C }] of Object.entries(block)) {
            if (!B || !C) continue;
            if (B[6] !== C[6]) { // acc_guid changed
              changes.push({
                changedAt,
                transGuid:       B[1],
                splitGuid,
                datePosted:      B[5] ? B[5].slice(0, 10) : '',
                description:     B[9] || '',
                amount:          parseFloat((B[14] || '0').split('/')[0]) /
                                 parseFloat((B[14] || '1/100').split('/')[1] || 100),
                fromAccountId:   B[6],
                fromAccountName: B[7],
                toAccountId:     C[6],
                toAccountName:   C[7],
              });
            }
          }
          block = {};
          continue;
        }
        if (!inBlock) continue;

        const cols = line.split('\t');
        if (cols.length < 10) continue;
        const mod      = cols[0]; // B, C, N, D
        const splitGuid = cols[2];
        if (!splitGuid) continue;

        if (mod === 'B' || mod === 'C') {
          if (!block[splitGuid]) block[splitGuid] = {};
          block[splitGuid][mod] = cols;
        }
      }
    }

    // Sort newest first
    changes.sort((a, b) => (b.changedAt ?? '').localeCompare(a.changedAt ?? ''));
    res.json(changes);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/import/preview
// Accepts a multipart file upload, parses it, and returns rows with duplicate flags.
// Optional body field `targetAccountId` allows duplicate checking against a specific account.
// Optional body field `mapping` (JSON string) forces CSV column mapping.
app.post('/api/import/preview', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const { buffer, originalname } = req.file;
    const targetAccountId    = req.body.targetAccountId || null;
    const mappingRaw         = req.body.mapping || null;
    const forcedHeaderRowIdx = req.body.headerRowIdx != null
      ? parseInt(req.body.headerRowIdx, 10)
      : null;

    // Parse the file
    let result;
    if (mappingRaw) {
      // Re-parse CSV with explicit column mapping supplied by the frontend
      const mapping = JSON.parse(mappingRaw);
      const rows = parseCsvWithMapping(buffer, mapping);
      result = { format: 'csv', needsMapping: false, headers: [], rows, suggestedAccountHint: null };
    } else {
      result = parseImportFile(buffer, originalname, forcedHeaderRowIdx);
    }

    // If mapping is still needed, return early — frontend will show the column mapper
    if (result.needsMapping) {
      return res.json({ needsMapping: true, headers: result.headers, format: result.format });
    }

    // Duplicate detection
    const data = await getStore();

    // Normalise an online ID / FITID so type differences and trailing ".000000"
    // suffixes (Chase, Wells Fargo QFX format) don't prevent matching.
    function normaliseOnlineId(id) {
      if (id == null) return null;
      return String(id).trim().replace(/\.0+$/, '');
    }

    // Add date ±1 day variants to a Set so that "transaction date" vs
    // "post date" mismatches (common with credit cards) are still caught.
    function addFuzzyKeys(set, dateStr, amount, description) {
      const base = `${Math.abs(amount).toFixed(2)}|${(description || '').slice(0, 20).toLowerCase()}`;
      const d = new Date(dateStr + 'T12:00:00Z');
      for (let offset = -1; offset <= 1; offset++) {
        const dd = new Date(d.getTime() + offset * 86_400_000);
        set.add(`${dd.toISOString().slice(0, 10)}|${base}`);
      }
    }

    function fuzzyKey(dateStr, amount, description) {
      return `${dateStr}|${Math.abs(amount).toFixed(2)}|${(description || '').slice(0, 20).toLowerCase()}`;
    }

    // Set of all known onlineIds (for QFX FITID exact matching)
    const knownOnlineIds = new Set();
    // Set of "date|amount|descPrefix" keys (with ±1 day) for fuzzy fallback
    const knownFuzzyKeys = new Set();

    for (const txn of data.transactions) {
      for (const split of txn.splits) {
        const nid = normaliseOnlineId(split.onlineId);
        if (nid) knownOnlineIds.add(nid);
        // Build fuzzy keys for splits on the target account (or all if no target)
        if (!targetAccountId || split.accountId === targetAccountId) {
          addFuzzyKeys(knownFuzzyKeys, txn.datePosted, split.value, txn.description);
        }
      }
    }

    const rows = result.rows.map((row) => {
      let isDuplicate = false;
      const normFitId = normaliseOnlineId(row.fitId);

      if (normFitId && knownOnlineIds.has(normFitId)) {
        // Exact FITID match
        isDuplicate = true;
      } else {
        // Fuzzy fallback — used for CSV always, and for QFX when FITIDs have
        // changed format (e.g. Chase switched from short to 31-digit IDs)
        const key = fuzzyKey(row.date, row.amount, row.description);
        if (knownFuzzyKeys.has(key)) isDuplicate = true;
      }
      return { ...row, isDuplicate };
    });

    res.json({
      needsMapping: false,
      format: result.format,
      suggestedAccountHint: result.suggestedAccountHint ?? null,
      headers: result.headers,
      headerRowIdx: result.headerRowIdx ?? null,
      rows,
    });
  } catch (err) {
    console.error('Import preview error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── AI Advisor (Ollama) ──────────────────────────────────────────────────────

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';

/** Build a compact financial snapshot to inject into the system prompt */
function buildFinancialContext(accounts, transactions, budgetData = {}) {
  const accountMap = new Map(accounts.map((a) => [a.id, a]));

  function getPath(account) {
    const parts = [];
    let current = account;
    while (current && current.type !== 'ROOT') {
      parts.unshift(current.name);
      current = current.parentId ? accountMap.get(current.parentId) : null;
    }
    return parts.join(' > ');
  }

  // Account balances
  const balances = new Map();
  for (const txn of transactions) {
    for (const split of txn.splits) {
      balances.set(split.accountId, (balances.get(split.accountId) || 0) + split.value);
    }
  }

  // Net worth components
  let totalAssets = 0;
  let totalLiabilities = 0;
  const bankLines = [];
  const expenseTotals = new Map();  // accountId -> { path, total }
  const incomeTotals  = new Map();  // accountId -> { path, total }

  for (const a of accounts) {
    if (a.placeholder) continue;
    const bal = balances.get(a.id) || 0;
    const p   = getPath(a);
    if (a.type === 'BANK' || a.type === 'CASH') {
      bankLines.push({ path: p, balance: bal });
      totalAssets += bal;
    } else if (a.type === 'ASSET') {
      totalAssets += bal;
    } else if (a.type === 'LIABILITY' || a.type === 'CREDIT' || a.type === 'PAYABLE') {
      totalLiabilities += Math.abs(bal);
    } else if (a.type === 'EXPENSE') {
      expenseTotals.set(a.id, { path: p, total: bal });
    } else if (a.type === 'INCOME') {
      incomeTotals.set(a.id, { path: p, total: Math.abs(bal) });
    }
  }

  // Last 3 full months + current month
  const now = new Date();
  const months = [];
  for (let i = 3; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    months.push({ key, label: d.toLocaleString('en-US', { month: 'long', year: 'numeric' }) });
  }

  const monthlyExp = Object.fromEntries(months.map((m) => [m.key, 0]));
  const monthlyInc = Object.fromEntries(months.map((m) => [m.key, 0]));
  const catMonthly  = new Map(); // accountId -> { [monthKey]: number }

  for (const txn of transactions) {
    const mk = txn.datePosted.substring(0, 7);
    if (!monthlyExp.hasOwnProperty(mk)) continue;
    for (const split of txn.splits) {
      const a = accountMap.get(split.accountId);
      if (!a) continue;
      if (a.type === 'EXPENSE') {
        monthlyExp[mk] = (monthlyExp[mk] || 0) + split.value;
        if (!catMonthly.has(split.accountId)) catMonthly.set(split.accountId, {});
        const cm = catMonthly.get(split.accountId);
        cm[mk] = (cm[mk] || 0) + split.value;
      } else if (a.type === 'INCOME') {
        monthlyInc[mk] = (monthlyInc[mk] || 0) + Math.abs(split.value);
      }
    }
  }

  const fmt = (n) => `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Top 15 expense categories by all-time total
  const topExpenses = Array.from(expenseTotals.entries())
    .map(([id, { path, total }]) => ({ id, path, total }))
    .filter((e) => e.total > 0.01)
    .sort((a, b) => b.total - a.total)
    .slice(0, 15);

  const currentMonthKey = months[months.length - 1].key;

  let ctx = `\n\n## User's Real Financial Data\n`;

  ctx += `\n### Net Worth Snapshot\n`;
  ctx += `- Total Assets: ${fmt(totalAssets)}\n`;
  ctx += `- Total Liabilities: ${fmt(totalLiabilities)}\n`;
  ctx += `- Net Worth: ${fmt(totalAssets - totalLiabilities)}\n`;

  ctx += `\n### Liquid Accounts (Bank / Cash)\n`;
  for (const acc of bankLines.sort((a, b) => b.balance - a.balance)) {
    ctx += `- ${acc.path}: ${fmt(acc.balance)}\n`;
  }

  ctx += `\n### Monthly Cash Flow (last 4 months)\n`;
  for (const m of months) {
    const exp = monthlyExp[m.key] || 0;
    const inc = monthlyInc[m.key] || 0;
    const net = inc - exp;
    ctx += `- ${m.label}: Income ${fmt(inc)}, Expenses ${fmt(exp)}, Net ${net >= 0 ? '+' : ''}${fmt(net)}\n`;
  }

  ctx += `\n### Top Expense Categories (All Time)\n`;
  for (const e of topExpenses) {
    const thisMonth = (catMonthly.get(e.id) || {})[currentMonthKey] || 0;
    ctx += `- ${e.path}: ${fmt(e.total)} total (current month: ${fmt(thisMonth)})\n`;
  }

  if (budgetData && Object.keys(budgetData).length > 0) {
    ctx += `\n### Monthly Budgets vs Current Month Actuals\n`;
    for (const [accountId, budget] of Object.entries(budgetData)) {
      if (typeof budget !== 'number' || budget < 0) continue;
      const a = accountMap.get(accountId);
      if (!a) continue;
      const actual = (catMonthly.get(accountId) || {})[currentMonthKey] || 0;
      const pctUsed = budget > 0 ? Math.round((actual / budget) * 100) : null;
      ctx += `- ${getPath(a)}: Budget ${fmt(budget)}/mo, Spent so far this month ${fmt(actual)}${pctUsed !== null ? ` (${pctUsed}%)` : ''}\n`;
    }
  }

  return ctx;
}

// GET /api/chat/models — list models installed in Ollama
app.get('/api/chat/models', async (_req, res) => {
  try {
    const r = await fetch(`${OLLAMA_URL}/api/tags`);
    if (!r.ok) return res.status(503).json({ error: 'Ollama not reachable', models: [] });
    const data = await r.json();
    const models = (data.models || []).map((m) => m.name);
    res.json({ models });
  } catch {
    res.status(503).json({ error: 'Ollama not reachable', models: [] });
  }
});

// POST /api/chat — streaming chat with financial context injected
app.post('/api/chat', async (req, res) => {
  try {
    const { messages = [], model = 'llama3.2' } = req.body;
    if (!Array.isArray(messages)) return res.status(400).json({ error: 'messages must be an array' });

    // Build financial context
    let financialContext = '';
    try {
      const { accounts, transactions } = await getStore();
      let budgetData = {};
      const budgetFile = getBudgetFile();
      if (existsSync(budgetFile)) {
        budgetData = JSON.parse(readFileSync(budgetFile, 'utf8'));
      }
      financialContext = buildFinancialContext(accounts, transactions, budgetData);
    } catch (e) {
      console.warn('Could not build financial context:', e.message);
    }

    const systemPrompt = `You are a knowledgeable, friendly personal financial advisor integrated directly into the user's financial management app. You have real-time access to their actual financial data shown below.

Your role:
- Help them understand their spending patterns and trends
- Suggest specific, actionable ways to reduce spending or improve cash flow
- Help them set realistic budgets based on their actual history
- Answer general personal finance questions (savings strategies, debt payoff, emergency funds, etc.)
- Point out patterns or anomalies you notice in their data

Your style:
- Be direct and specific — reference their actual account names and numbers when relevant
- Be encouraging but honest; don't sugarcoat overspending
- Keep responses concise and scannable (use bullet points when listing multiple items)
- Focus on practical improvements, not theoretical advice
- Do NOT give investment advice or recommend specific securities or financial products${financialContext}`;

    const fullMessages = [
      { role: 'system', content: systemPrompt },
      ...messages,
    ];

    const ollamaRes = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages: fullMessages, stream: true }),
    });

    if (!ollamaRes.ok) {
      const errText = await ollamaRes.text();
      return res.status(502).json({ error: `Ollama error: ${errText}` });
    }

    // Stream plain text tokens back to the client
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Cache-Control', 'no-cache');

    const reader = ollamaRes.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      // Process complete lines (NDJSON)
      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep incomplete last chunk
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const obj = JSON.parse(line);
          if (obj.message?.content) res.write(obj.message.content);
          if (obj.done) { res.end(); return; }
        } catch { /* ignore malformed lines */ }
      }
    }
    res.end();
  } catch (err) {
    console.error('Chat error:', err);
    if (!res.headersSent) res.status(500).json({ error: err.message });
    else res.end();
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`GnuCash API server running on http://localhost:${PORT}`);
});
