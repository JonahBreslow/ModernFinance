import { createReadStream, createWriteStream, copyFileSync, writeFileSync } from 'fs';
import { createGunzip, createGzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { Writable, Readable } from 'stream';
import { getGnuCashFile } from './config.js';

// Helper so every function uses the live path (supports setup wizard)
function GNUCASH_FILE() { return getGnuCashFile(); }

// ─────────────────────────────────────────────────────────────────────────────
// XML cache
// ─────────────────────────────────────────────────────────────────────────────

let cachedRawXml = null;

export async function getRawXml() {
  if (cachedRawXml) return cachedRawXml;
  const chunks = [];
  await pipeline(
    createReadStream(GNUCASH_FILE()),
    createGunzip(),
    new Writable({ write(chunk, _enc, cb) { chunks.push(chunk); cb(); } })
  );
  cachedRawXml = Buffer.concat(chunks).toString('utf-8');
  return cachedRawXml;
}

export function invalidateCache() {
  cachedRawXml = null;
}

// ─────────────────────────────────────────────────────────────────────────────
// XML helpers
// ─────────────────────────────────────────────────────────────────────────────

function fraction(amount) {
  const cents = Math.round(amount * 100);
  return `${cents}/100`;
}

function gnucashDatetime(dateStr) {
  // "YYYY-MM-DD" → "YYYY-MM-DD 10:59:00 +0000"
  if (!dateStr) return '1970-01-01 00:00:00 +0000';
  return `${dateStr} 10:59:00 +0000`;
}

function escapeXml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function serializeTransaction(txn) {
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' +0000';
  const dateEntered = txn.dateEntered ? gnucashDatetime(txn.dateEntered) : now;

  const splitsXml = txn.splits.map((s) => {
    const reconcileDate = s.reconcileDate
      ? `\n  <split:reconcile-date>\n    <ts:date>${gnucashDatetime(s.reconcileDate)}</ts:date>\n  </split:reconcile-date>`
      : '';
    const memo     = s.memo   ? `\n  <split:memo>${escapeXml(s.memo)}</split:memo>`     : '';
    const action   = s.action ? `\n  <split:action>${escapeXml(s.action)}</split:action>` : '';
    const onlineSlot = s.onlineId
      ? `\n  <split:slots>\n    <slot>\n      <slot:key>online_id</slot:key>\n      <slot:value type="string">${escapeXml(s.onlineId)}</slot:value>\n    </slot>\n  </split:slots>`
      : '';
    return `  <trn:split>
  <split:id type="guid">${s.id}</split:id>${action}${reconcileDate}
  <split:reconciled-state>${s.reconciledState || 'n'}</split:reconciled-state>
  <split:value>${fraction(s.value)}</split:value>
  <split:quantity>${fraction(s.quantity)}</split:quantity>
  <split:account type="guid">${s.accountId}</split:account>${memo}${onlineSlot}
</trn:split>`;
  }).join('\n');

  const notesSlot = txn.notes
    ? `  <slot>\n    <slot:key>notes</slot:key>\n    <slot:value type="string">${escapeXml(txn.notes)}</slot:value>\n  </slot>`
    : '';
  const datePostedSlot = `  <slot>\n    <slot:key>date-posted</slot:key>\n    <slot:value type="gdate">\n      <gdate>${txn.datePosted}</gdate>\n    </slot:value>\n  </slot>`;
  const slotsSection = `<trn:slots>\n${datePostedSlot}${notesSlot ? '\n' + notesSlot : ''}\n</trn:slots>`;

  return `<gnc:transaction version="2.0.0">
  <trn:id type="guid">${txn.id}</trn:id>
  <trn:currency>
    <cmdty:space>CURRENCY</cmdty:space>
    <cmdty:id>${txn.currency || 'USD'}</cmdty:id>
  </trn:currency>
  <trn:date-posted>
    <ts:date>${gnucashDatetime(txn.datePosted)}</ts:date>
  </trn:date-posted>
  <trn:date-entered>
    <ts:date>${dateEntered}</ts:date>
  </trn:date-entered>
  <trn:description>${escapeXml(txn.description || '')}</trn:description>
  ${slotsSection}
  <trn:splits>
${splitsXml}
  </trn:splits>
</gnc:transaction>`;
}

function updateCount(xml, type, delta) {
  return xml.replace(
    new RegExp(`(<gnc:count-data cd:type="${type}">)(\\d+)(<\\/gnc:count-data>)`),
    (_, open, num, close) => `${open}${parseInt(num) + delta}${close}`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GnuCash-format log writer
//
// Format (tab-separated):
//   mod  trans_guid  split_guid  time_now  date_entered  date_posted
//   acc_guid  acc_name  num  description  notes  memo  action
//   reconciled  amount  value  date_reconciled
//
// 'B' = before, 'C' = after (changed), 'N' = new, 'D' = deleted
// ─────────────────────────────────────────────────────────────────────────────

const LOG_HEADER =
  'mod\ttrans_guid\tsplit_guid\ttime_now\tdate_entered\tdate_posted\t' +
  'acc_guid\tacc_name\tnum\tdescription\tnotes\tmemo\taction\t' +
  'reconciled\tamount\tvalue\tdate_reconciled\n' +
  '-----------------';

function nowTimestamp() {
  // "YYYY-MM-DD HH:MM:SS"
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

function logSplitRow(mod, txn, split, accountName) {
  const now          = nowTimestamp();
  const dateEntered  = txn.dateEntered  || txn.datePosted || '';
  const datePosted   = txn.datePosted   || '';
  const reconcileDate = split.reconcileDate || '1970-01-01';
  const fields = [
    mod,
    txn.id,
    split.id,
    now,
    dateEntered,
    datePosted,
    split.accountId,
    accountName ?? '',
    '',                          // num
    txn.description ?? '',
    txn.notes ?? '',
    split.memo ?? '',
    split.action ?? '',
    split.reconciledState || 'n',
    fraction(split.value),
    fraction(split.value),
    reconcileDate,
  ];
  return fields.join('\t');
}

/**
 * Write a GnuCash-compatible log entry for a transaction update.
 * beforeTxn = the transaction object before modification
 * afterTxn  = the transaction object after modification
 * accountMap = Map<id, { name }>
 */
function writeGnuCashLog(beforeTxn, afterTxn, accountMap, action) {
  const timestamp = new Date()
    .toISOString()
    .replace(/[-T:]/g, '')
    .slice(0, 14); // "YYYYMMDDHHmmss"

  const logPath = `${GNUCASH_FILE()}.${timestamp}.log`;

  const lines = [LOG_HEADER];

  if (action === 'delete') {
    lines.push('===== START');
    for (const split of beforeTxn.splits) {
      lines.push(logSplitRow('D', beforeTxn, split, accountMap.get(split.accountId)?.name));
    }
    lines.push('===== END');
  } else if (action === 'create') {
    lines.push('===== START');
    for (const split of afterTxn.splits) {
      lines.push(logSplitRow('N', afterTxn, split, accountMap.get(split.accountId)?.name));
    }
    lines.push('===== END');
  } else {
    // update — write B (before) then C (after) for every split
    lines.push('===== START');
    for (const split of beforeTxn.splits) {
      lines.push(logSplitRow('B', beforeTxn, split, accountMap.get(split.accountId)?.name));
    }
    for (const split of afterTxn.splits) {
      lines.push(logSplitRow('C', afterTxn, split, accountMap.get(split.accountId)?.name));
    }
    lines.push('===== END');
  }

  writeFileSync(logPath, lines.join('\n') + '\n', 'utf-8');
  return logPath;
}

// ─────────────────────────────────────────────────────────────────────────────
// Account serialization
// ─────────────────────────────────────────────────────────────────────────────

function serializeAccount(account) {
  const descriptionXml = account.description
    ? `\n  <act:description>${escapeXml(account.description)}</act:description>`
    : '';

  const slots = [];
  if (account.placeholder) {
    slots.push(`    <slot>\n      <slot:key>placeholder</slot:key>\n      <slot:value type="string">true</slot:value>\n    </slot>`);
  }
  const slotsXml = slots.length
    ? `\n  <act:slots>\n${slots.join('\n')}\n  </act:slots>`
    : '';

  const parentXml = account.parentId
    ? `\n  <act:parent type="guid">${account.parentId}</act:parent>`
    : '';

  return `<gnc:account version="2.0.0">
  <act:name>${escapeXml(account.name)}</act:name>
  <act:id type="guid">${account.id}</act:id>
  <act:type>${account.type}</act:type>
  <act:commodity>
    <cmdty:space>CURRENCY</cmdty:space>
    <cmdty:id>USD</cmdty:id>
  </act:commodity>
  <act:commodity-scu>100</act:commodity-scu>${descriptionXml}${slotsXml}${parentXml}
</gnc:account>`;
}

/**
 * Delete an account from the GnuCash file.
 * Refuses if any transaction splits reference this account.
 */
export async function deleteAccount(id, transactions) {
  // Guard: don't delete if any split references this account
  const inUse = transactions.some((t) => t.splits.some((s) => s.accountId === id));
  if (inUse) throw new Error('Cannot delete an account that has transactions. Remove or reassign those transactions first.');

  let xml = await getRawXml();

  const timestamp = new Date().toISOString().replace(/[-T:]/g, '').slice(0, 14);
  copyFileSync(GNUCASH_FILE(), `${GNUCASH_FILE()}.${timestamp}.gnucash`);

  const before = xml;
  xml = xml.replace(/<gnc:account version="2\.0\.0">[\s\S]*?<\/gnc:account>/g, (block) => {
    if (!block.includes(`<act:id type="guid">${id}</act:id>`)) return block;
    return ''; // remove the block
  });

  if (xml === before) throw new Error(`Account ${id} not found in XML`);

  xml = updateCount(xml, 'account', -1);

  await pipeline(
    Readable.from([xml]),
    createGzip({ level: 9 }),
    createWriteStream(GNUCASH_FILE())
  );
  cachedRawXml = xml;
}

/**
 * Rename an existing account in the GnuCash file.
 */
export async function renameAccount(id, newName) {
  let xml = await getRawXml();

  const timestamp = new Date().toISOString().replace(/[-T:]/g, '').slice(0, 14);
  copyFileSync(GNUCASH_FILE(), `${GNUCASH_FILE()}.${timestamp}.gnucash`);

  let found = false;
  xml = xml.replace(/<gnc:account version="2\.0\.0">[\s\S]*?<\/gnc:account>/g, (block) => {
    // Match the specific account by its GUID in the act:id tag
    if (!block.includes(`<act:id type="guid">${id}</act:id>`)) return block;
    found = true;
    return block.replace(/<act:name>[^<]*<\/act:name>/, `<act:name>${escapeXml(newName)}</act:name>`);
  });

  if (!found) throw new Error(`Account ${id} not found in XML`);

  await pipeline(
    Readable.from([xml]),
    createGzip({ level: 9 }),
    createWriteStream(GNUCASH_FILE())
  );
  cachedRawXml = xml;
}

/**
 * Insert a new account into the GnuCash file.
 * Accounts are placed just before the first <gnc:transaction> (or before </gnc:book>).
 */
export async function saveAccount(account) {
  let xml = await getRawXml();

  // ── 1. Backup ──────────────────────────────────────────────────────────────
  const timestamp = new Date().toISOString().replace(/[-T:]/g, '').slice(0, 14);
  copyFileSync(GNUCASH_FILE(), `${GNUCASH_FILE()}.${timestamp}.gnucash`);

  // ── 2. Patch XML ──────────────────────────────────────────────────────────
  const accountXml = serializeAccount(account);

  // Insert right before the first transaction block (or before </gnc:book>)
  if (xml.includes('<gnc:transaction')) {
    xml = xml.replace('<gnc:transaction', accountXml + '\n<gnc:transaction');
  } else {
    xml = xml.replace('</gnc:book>', accountXml + '\n</gnc:book>');
  }
  xml = updateCount(xml, 'account', 1);

  // ── 3. Write compressed file ───────────────────────────────────────────────
  await pipeline(
    Readable.from([xml]),
    createGzip({ level: 9 }),
    createWriteStream(GNUCASH_FILE())
  );
  cachedRawXml = xml;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main save function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Save a transaction change to disk.
 *
 * Steps (matching real GnuCash behaviour):
 *   1. Copy the current .gnucash file to a timestamped backup (.gnucash)
 *   2. Patch the in-memory XML
 *   3. Re-gzip and overwrite the main .gnucash file
 *   4. Write a timestamped .log file recording the before/after state
 */
export async function saveTransaction(txnAfter, action = 'update', txnBefore = null, accountMap = null) {
  let xml = await getRawXml();

  // ── 1. Backup: copy current compressed file verbatim ──────────────────────
  const timestamp = new Date()
    .toISOString()
    .replace(/[-T:]/g, '')
    .slice(0, 14);
  const backupPath = `${GNUCASH_FILE()}.${timestamp}.gnucash`;
  copyFileSync(GNUCASH_FILE(), backupPath);

  // ── 2. Patch XML ──────────────────────────────────────────────────────────
  const txnPattern = new RegExp(
    `<gnc:transaction version="2\\.0\\.0">\\s*<trn:id[^>]*>${txnAfter.id}<\\/trn:id>[\\s\\S]*?<\\/gnc:transaction>`,
    'g'
  );

  if (action === 'delete') {
    xml = xml.replace(txnPattern, '');
    xml = updateCount(xml, 'transaction', -1);
  } else if (action === 'create') {
    xml = xml.replace('</gnc:book>', serializeTransaction(txnAfter) + '\n</gnc:book>');
    xml = updateCount(xml, 'transaction', 1);
  } else {
    xml = xml.replace(txnPattern, serializeTransaction(txnAfter));
  }

  // ── 3. Write compressed main file ─────────────────────────────────────────
  await pipeline(
    Readable.from([xml]),
    createGzip({ level: 9 }),
    createWriteStream(GNUCASH_FILE())
  );
  cachedRawXml = xml;

  // ── 4. Write .log file ────────────────────────────────────────────────────
  const before = txnBefore ?? txnAfter; // fallback: use after for before (no diff shown)
  const accMap = accountMap ?? new Map();
  writeGnuCashLog(before, txnAfter, accMap, action);
}
