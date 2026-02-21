import { createReadStream, readFileSync } from 'fs';
import { createGunzip } from 'zlib';
import { XMLParser } from 'fast-xml-parser';
import { pipeline } from 'stream/promises';
import { Writable } from 'stream';

import { getGnuCashFile } from './config.js';

/** Convenience export so other modules can import GNUCASH_FILE for path work.
 *  Use getGnuCashFile() directly when you need the live value after setup. */
export const GNUCASH_FILE = null; // kept for import compatibility — see getGnuCashFile()

function parseFraction(str) {
  if (!str) return 0;
  const s = String(str);
  if (s.includes('/')) {
    const [num, den] = s.split('/').map(Number);
    return num / den;
  }
  return Number(s);
}

function parseDate(str) {
  if (!str) return null;
  // "2024-04-17 10:59:00 +0000" or "2024-04-17"
  return str.trim().slice(0, 10);
}

function ensureArray(val) {
  if (val == null) return [];
  return Array.isArray(val) ? val : [val];
}

function getSlotValue(slots) {
  const slotMap = {};
  if (!slots) return slotMap;
  const items = ensureArray(slots.slot);
  for (const s of items) {
    const key = s['slot:key'];
    const val = s['slot:value'];
    slotMap[key] = typeof val === 'object' ? (val['#text'] ?? val) : val;
  }
  return slotMap;
}

export async function parseGnuCash() {
  const file = getGnuCashFile();
  if (!file) throw new Error('No GnuCash file configured');
  const chunks = [];

  await pipeline(
    createReadStream(file),
    createGunzip(),
    new Writable({
      write(chunk, _enc, cb) {
        chunks.push(chunk);
        cb();
      },
    })
  );

  const xml = Buffer.concat(chunks).toString('utf-8');

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text',
    parseAttributeValue: true,
    parseTagValue: true,
    trimValues: true,
    isArray: (name) => {
      return [
        'gnc:account',
        'gnc:transaction',
        'trn:split',
        'slot',
        'price:price',
      ].includes(name);
    },
  });

  const doc = parser.parse(xml);
  const book = doc['gnc-v2']['gnc:book'];

  // --- Accounts ---
  const rawAccounts = book['gnc:account'] || [];
  const accounts = rawAccounts.map((a) => {
    const slots = getSlotValue(a['act:slots']);
    return {
      id: a['act:id']['#text'] ?? a['act:id'],
      name: a['act:name'],
      type: a['act:type'],
      parentId: a['act:parent']
        ? (a['act:parent']['#text'] ?? a['act:parent'])
        : null,
      description: a['act:description'] || '',
      placeholder: slots['placeholder'] === 'true' || slots['placeholder'] === true,
      hidden: slots['hidden'] === 'true' || slots['hidden'] === true,
    };
  });

  // --- Transactions ---
  const rawTxns = book['gnc:transaction'] || [];
  const transactions = rawTxns.map((t) => {
    const datePosted =
      parseDate(t['trn:date-posted']?.['ts:date']) || '';
    const dateEntered =
      parseDate(t['trn:date-entered']?.['ts:date']) || '';

    const slots = getSlotValue(t['trn:slots']);
    const notes = slots['notes'] || '';

    const rawSplits = ensureArray(t['trn:splits']?.['trn:split']);
    const splits = rawSplits.map((s) => {
      const splitSlots = getSlotValue(s['split:slots']);
      return {
        id: s['split:id']['#text'] ?? s['split:id'],
        accountId: s['split:account']['#text'] ?? s['split:account'],
        value: parseFraction(s['split:value']),
        quantity: parseFraction(s['split:quantity']),
        reconciledState: s['split:reconciled-state'] || 'n',
        reconcileDate: parseDate(s['split:reconcile-date']?.['ts:date']),
        memo: s['split:memo'] || '',
        action: s['split:action'] || '',
        onlineId: splitSlots['online_id'] != null ? String(splitSlots['online_id']).trim() : null,
      };
    });

    return {
      id: t['trn:id']['#text'] ?? t['trn:id'],
      description: t['trn:description'] || '',
      datePosted,
      dateEntered,
      notes,
      currency: t['trn:currency']?.['cmdty:id'] || 'USD',
      splits,
    };
  });

  return { accounts, transactions };
}

export { GNUCASH_FILE };
