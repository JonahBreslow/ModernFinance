import { read as xlsxRead, utils as xlsxUtils } from 'xlsx';

// ─────────────────────────────────────────────────────────────────────────────
// Shared utilities
// ─────────────────────────────────────────────────────────────────────────────

/** Parse a date string from various bank formats into YYYY-MM-DD */
function parseDate(raw) {
  if (!raw) return null;
  const s = String(raw).trim();

  // OFX/QFX: YYYYMMDD or YYYYMMDDHHMMSS[.000][+00:00]
  if (/^\d{8}/.test(s)) {
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  }
  // MM/DD/YYYY or M/D/YYYY
  const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (mdy) return `${mdy[3]}-${mdy[1].padStart(2, '0')}-${mdy[2].padStart(2, '0')}`;

  // YYYY-MM-DD already
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);

  // Excel serial date number
  const n = Number(s);
  if (!isNaN(n) && n > 40000) {
    const date = xlsxUtils.format_cell({ t: 'n', v: n, z: 'yyyy-mm-dd' });
    if (date) return date;
  }

  return null;
}

function parseAmount(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  const n = parseFloat(String(raw).replace(/[$, ]/g, ''));
  return isNaN(n) ? null : n;
}

// ─────────────────────────────────────────────────────────────────────────────
// QFX / OFX parser
// OFX is SGML-like — we extract values with simple regex rather than a
// full XML parser since the format is tag-value pairs on separate lines.
// ─────────────────────────────────────────────────────────────────────────────

function parseQfx(text) {
  // Extract a top-level tag value (non-nested)
  function tag(t, src) {
    const m = src.match(new RegExp(`<${t}>([^<\r\n]+)`, 'i'));
    return m ? m[1].trim() : null;
  }

  // Account hint from the file header
  const acctId   = tag('ACCTID',  text);
  const bankId   = tag('BANKID',  text);
  const acctType = tag('ACCTTYPE', text) || tag('ACCTTYPE', text);
  const suggestedAccountHint = [bankId, acctId, acctType].filter(Boolean).join(' ');

  // Split into individual transaction blocks
  const txnBlocks = text.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) || [];

  const rows = txnBlocks.map((block) => {
    const dtRaw = tag('DTPOSTED', block) || tag('DTAVAIL', block);
    const date  = parseDate(dtRaw);
    const amount = parseAmount(tag('TRNAMT', block));
    const fitId  = tag('FITID', block);
    const name   = tag('NAME',  block) || '';
    const memo   = tag('MEMO',  block) || '';
    const description = name || memo;

    return { fitId, date, description, amount, memo: memo || null };
  }).filter((r) => r.date && r.amount !== null);

  return {
    format: 'qfx',
    suggestedAccountHint: suggestedAccountHint || null,
    needsMapping: false,
    headers: [],
    rows,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CSV parser
// ─────────────────────────────────────────────────────────────────────────────

/** Very small CSV parser — handles quoted fields with commas inside */
function parseCsvText(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const result = [];
  for (const line of lines) {
    const row = [];
    let cur = '';
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
        else inQuote = !inQuote;
      } else if (ch === ',' && !inQuote) {
        row.push(cur.trim()); cur = '';
      } else {
        cur += ch;
      }
    }
    row.push(cur.trim());
    result.push(row);
  }
  return result;
}

/**
 * Known bank CSV layouts.
 * Each entry has:
 *   detect(headers)  → boolean: does this layout match?
 *   map(row, headers) → { date, description, amount, memo }
 */
const KNOWN_LAYOUTS = [
  {
    name: 'Chase',
    // "Transaction Date","Post Date","Description","Category","Type","Amount","Memo"
    detect: (h) => h.some((c) => /transaction.?date/i.test(c)) && h.some((c) => /description/i.test(c)),
    map(row, h) {
      const idx = (pat) => h.findIndex((c) => pat.test(c));
      // Use Post Date as primary (matches what GnuCash stores from QFX).
      // Fall back to Transaction Date if Post Date column is absent.
      const postDateIdx = idx(/post.?date/i);
      const txnDateIdx  = idx(/transaction.?date/i);
      return {
        date:        parseDate(row[postDateIdx] ?? row[txnDateIdx]),
        description: row[idx(/description/i)] || '',
        amount:      parseAmount(row[idx(/^amount$/i)]),
        memo:        row[idx(/memo/i)] || null,
      };
    },
  },
  {
    name: 'BofA',
    // "Posted Date","Reference Number","Payee","Address","Amount"
    detect: (h) => h.some((c) => /posted.?date/i.test(c)) && h.some((c) => /payee/i.test(c)),
    map(row, h) {
      const idx = (pat) => h.findIndex((c) => pat.test(c));
      return {
        date:        parseDate(row[idx(/posted.?date/i)]),
        description: row[idx(/payee/i)] || row[idx(/description/i)] || '',
        amount:      parseAmount(row[idx(/amount/i)]),
        memo:        null,
      };
    },
  },
  {
    name: 'Fidelity',
    // "Run Date","Action","Symbol","Security Description","Security Type","Quantity","Price","Commission","Fees","Accrued Interest","Amount","Settlement Date"
    detect: (h) => h.some((c) => /run.?date/i.test(c)) && h.some((c) => /action/i.test(c)),
    map(row, h) {
      const idx = (pat) => h.findIndex((c) => pat.test(c));
      return {
        date:        parseDate(row[idx(/run.?date/i)]),
        description: [row[idx(/action/i)], row[idx(/security.?desc/i)]].filter(Boolean).join(' '),
        amount:      parseAmount(row[idx(/^amount$/i)]),
        memo:        row[idx(/symbol/i)] || null,
      };
    },
  },
];

/**
 * Generic fallback: find the most plausible date, description, amount columns
 * by scanning header names.
 */
function genericMap(headers) {
  const idx = (pats) => {
    for (const pat of pats) {
      const i = headers.findIndex((h) => pat.test(h));
      if (i !== -1) return i;
    }
    return -1;
  };

  const dateCol   = idx([/^date$/i, /transaction.?date/i, /posted/i, /run.?date/i, /date/i]);
  const descCol   = idx([/description/i, /payee/i, /name/i, /memo/i, /narrative/i]);
  const amtCol    = idx([/^amount$/i, /debit.?credit/i, /credit/i, /debit/i, /amount/i]);
  const memoCol   = idx([/memo/i, /note/i]);

  if (dateCol === -1 || descCol === -1 || amtCol === -1) return null;

  return { dateCol, descCol, amtCol, memoCol };
}

function parseCsv(buffer, forcedHeaderRowIdx = null) {
  const text  = buffer.toString('utf-8').replace(/^\uFEFF/, ''); // strip BOM
  const rows  = parseCsvText(text);
  if (rows.length < 2) return { format: 'csv', needsMapping: true, headers: [], rows: [] };

  // Find the header row: scan up to 20 rows and pick the best match.
  // "Best" = most columns containing recognised header keywords.
  let headerRowIdx = forcedHeaderRowIdx ?? 0;
  if (forcedHeaderRowIdx === null) {
    let bestScore = -1;
    const HEADER_KEYWORDS = /date|amount|debit|credit|payee|desc|memo|balance|reference|posting/i;
    for (let i = 0; i < Math.min(20, rows.length); i++) {
      if (rows[i].length < 2) continue;
      const score = rows[i].filter((c) => HEADER_KEYWORDS.test(c)).length;
      if (score > bestScore) { bestScore = score; headerRowIdx = i; }
      if (score >= 3) break; // good enough — stop early
    }
  }

  const headers = rows[headerRowIdx].map((h) => h.replace(/^"|"$/g, '').trim());
  const dataRows = rows.slice(headerRowIdx + 1).filter((r) => r.some((c) => c.trim()));

  // Try known layouts
  for (const layout of KNOWN_LAYOUTS) {
    if (layout.detect(headers)) {
      const parsed = dataRows.map((r) => {
        const m = layout.map(r, headers);
        return m.date && m.amount !== null
          ? { fitId: null, date: m.date, description: m.description, amount: m.amount, memo: m.memo }
          : null;
      }).filter(Boolean);

      return { format: 'csv', needsMapping: false, headerRowIdx, headers, rows: parsed };
    }
  }

  // Generic fallback
  // (also handles this BofA statement format: Date, Description, Amount, Running Bal.)
  const mapping = genericMap(headers);
  if (mapping) {
    const { dateCol, descCol, amtCol, memoCol } = mapping;
    const parsed = dataRows.map((r) => {
      const date   = parseDate(r[dateCol]);
      const amount = parseAmount(r[amtCol]);
      if (!date || amount === null) return null;
      return {
        fitId:       null,
        date,
        description: r[descCol] || '',
        amount,
        memo:        memoCol !== -1 ? (r[memoCol] || null) : null,
      };
    }).filter(Boolean);

    return { format: 'csv', needsMapping: false, headerRowIdx, headers, rows: parsed };
  }

  // Could not auto-detect — return headers so frontend can show the column mapper
  return { format: 'csv', needsMapping: true, headerRowIdx, headers, rows: [] };
}

// ─────────────────────────────────────────────────────────────────────────────
// XLSX parser — convert to CSV rows then run through CSV logic
// ─────────────────────────────────────────────────────────────────────────────

function parseXlsx(buffer) {
  const wb = xlsxRead(buffer, { type: 'buffer', cellDates: false });
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const csv = xlsxUtils.sheet_to_csv(sheet, { blankrows: false });
  const result = parseCsv(Buffer.from(csv, 'utf-8'));
  return { ...result, format: 'xlsx' };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse an uploaded file buffer.
 *
 * Returns:
 * {
 *   format: 'qfx'|'csv'|'xlsx',
 *   suggestedAccountHint: string|null,
 *   needsMapping: boolean,   // true = frontend must show column mapper
 *   headers: string[],       // CSV column names (for mapper UI)
 *   rows: ParsedRow[],
 * }
 *
 * ParsedRow: { fitId, date, description, amount, memo }
 */
export function parseImportFile(buffer, filename, forcedHeaderRowIdx = null) {
  const ext = filename.split('.').pop().toLowerCase();

  if (ext === 'qfx' || ext === 'ofx') {
    return parseQfx(buffer.toString('utf-8'));
  }
  if (ext === 'xlsx' || ext === 'xls') {
    return parseXlsx(buffer);
  }
  // Default: treat as CSV
  return parseCsv(buffer, forcedHeaderRowIdx);
}

/**
 * Given a mapping from the frontend (when needsMapping was true), re-parse
 * CSV rows using explicit column indexes.
 *
 * mapping: { dateCol, descCol, amtCol, memoCol, negateAmount }
 */
export function parseCsvWithMapping(buffer, mapping) {
  const text    = buffer.toString('utf-8').replace(/^\uFEFF/, '');
  const allRows = parseCsvText(text);
  if (allRows.length < 2) return [];

  // Use explicitly-supplied headerRowIdx from mapping, or auto-detect
  const headerRowIdx = (mapping.headerRowIdx != null)
    ? mapping.headerRowIdx
    : (() => {
        const HEADER_KEYWORDS = /date|amount|debit|credit|payee|desc|memo|balance|reference|posting/i;
        let best = 0, bestScore = -1;
        for (let i = 0; i < Math.min(20, allRows.length); i++) {
          if (allRows[i].length < 2) continue;
          const score = allRows[i].filter((c) => HEADER_KEYWORDS.test(c)).length;
          if (score > bestScore) { bestScore = score; best = i; }
          if (score >= 3) break;
        }
        return best;
      })();

  const dataRows = allRows.slice(headerRowIdx + 1).filter((r) => r.some((c) => c.trim()));

  return dataRows.map((r) => {
    const date   = parseDate(r[mapping.dateCol]);
    let   amount = parseAmount(r[mapping.amtCol]);
    if (amount !== null && mapping.negateAmount) amount = -amount;
    if (!date || amount === null) return null;
    return {
      fitId:       null,
      date,
      description: r[mapping.descCol] || '',
      amount,
      memo:        mapping.memoCol != null ? (r[mapping.memoCol] || null) : null,
    };
  }).filter(Boolean);
}
