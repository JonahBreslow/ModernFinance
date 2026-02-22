/**
 * Centralised configuration module.
 *
 * Reads / writes the .env file in the app root so that settings persist
 * across restarts without requiring Node to be relaunched.
 *
 * All other backend modules call getGnuCashFile() instead of using a
 * hardcoded path, so the file location can be changed at runtime via the
 * setup wizard.
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ENV_FILE = path.resolve(__dirname, '../.env');

// ─── .env parser ─────────────────────────────────────────────────────────────

function parseEnvFile() {
  if (!existsSync(ENV_FILE)) return {};
  const out = {};
  for (const raw of readFileSync(ENV_FILE, 'utf-8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const val = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    out[key] = val;
  }
  return out;
}

function writeEnvKey(key, value) {
  const current = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, 'utf-8') : '';
  const lines = current.split('\n').filter((l) => !l.trimStart().startsWith(key + '='));
  lines.push(`${key}=${value}`);
  writeFileSync(ENV_FILE, lines.filter(Boolean).join('\n') + '\n', 'utf-8');
}

// ─── In-memory config (updated by setup wizard without restart) ───────────────

let _gnuCashFile = null;

function resolveGnuCashFile() {
  // process.env takes precedence (e.g. set on command line), then .env file
  return process.env.GNUCASH_FILE || parseEnvFile().GNUCASH_FILE || null;
}

export function getGnuCashFile() {
  if (!_gnuCashFile) _gnuCashFile = resolveGnuCashFile();
  return _gnuCashFile;
}

/** Called by the setup wizard to change the path at runtime. */
export function setGnuCashFile(filePath) {
  _gnuCashFile = filePath;
  writeEnvKey('GNUCASH_FILE', filePath);
}

/** true when a path is configured AND the file exists on disk. */
export function isConfigured() {
  const f = getGnuCashFile();
  return !!f && existsSync(f);
}

/**
 * Projections are stored next to the gnucash file so they stay with the data,
 * e.g. /home/user/finances/mydata.gnucash.projections.json
 * Falls back to the old app/projections.json location for backwards compat.
 */
export function getProjectionsFile() {
  const gf = getGnuCashFile();
  if (gf) return gf + '.projections.json';
  // legacy fallback
  return path.resolve(__dirname, '../projections.json');
}

export function getBudgetFile() {
  const gf = getGnuCashFile();
  if (gf) return gf + '.budget.json';
  return path.resolve(__dirname, '../budget.json');
}
