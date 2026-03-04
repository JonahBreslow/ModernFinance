# Research: Recategorize into Multi-Split Transactions

**Feature**: 001-recategorize-multi-split  
**Date**: 2025-03-03

## 1. Double-Entry Balance When Splitting

**Decision**: When splitting one categorizable split into N splits, replace the original split with N new splits whose `value` sum equals the original. Source-side splits (BANK, CASH, CREDIT, EQUITY) remain unchanged. The transaction stays balanced because the categorizable side sum is unchanged.

**Rationale**: In GnuCash double-entry, sum of all split `value` in a transaction = 0. A typical expense transaction: Bank -100, Groceries +100. Splitting to Groceries +60, Household +40 keeps Bank -100; categorizable sum stays +100. No source-side adjustment needed.

**Alternatives considered**:
- Adjust source split: Rejected; the total outflow is unchanged, so source split should not change.
- Use imbalance account: Only needed when importing unmatched rows; not for recategorization.

---

## 2. Split GUID Generation for New Splits

**Decision**: Use existing `generateGuid()` from `frontend/src/lib/utils.ts` for new split IDs. Format: 32-char hex (no hyphens), matching GnuCash convention.

**Rationale**: Project already uses this for new transactions/splits (Register, Import). Backend serializer accepts any string ID; GnuCash XML uses `type="guid"` with hex format.

**Alternatives considered**:
- Backend-generated GUIDs: Would require new API or round-trip; frontend generation is sufficient and matches existing patterns.
- UUID v4 with hyphens removed: Backend uses this; frontend `generateGuid` produces equivalent format.

---

## 3. Staged Change Model for Multi-Split vs Single-Split

**Decision**: Introduce a second staged-change type: `StagedSplitChange` (multi-split) vs existing `StagedChange` (single-split recategorization). Keyed by `txnId` (not `txnId|splitId`) for split edits, since the whole transaction is being rewritten. When user saves, apply `StagedSplitChange` by building new splits and calling `updateTransaction`; apply `StagedChange` as today (map one split's accountId).

**Rationale**: Single-split and multi-split are mutually exclusive for a given transaction. Staging by txnId for split edits avoids key collisions and keeps logic clear.

**Alternatives considered**:
- Unify into one model: Possible but more complex; two clear modes (reassign vs split) map well to two types.
- In-place edit without staging: Would require modal state only; staging allows "undo" and consistent pending bar UX.

---

## 4. Change Log for Multi-Split Edits

**Decision**: Log each added/removed/modified split in the GnuCash `.log` file via existing `writeGnuCashLog`. The serializer already writes B (before) and C (after) for every split on update. For new splits: B row omitted (split didn't exist), C row written. For removed splits: B row written, C row omitted. Existing change-log API reads these; multi-split changes will appear as multiple from/to pairs or new split entries.

**Rationale**: Backend `saveTransaction` calls `writeGnuCashLog(beforeTxn, afterTxn, ...)`. When we replace splits, `afterTxn` has different splits than `beforeTxn`. The current log format compares before/after per split; we may need to extend change-log parsing to handle added/deleted splits. For MVP, focus on correct GnuCash write; change-log display can be enhanced later if needed.

**Alternatives considered**:
- Single log entry per transaction: Would lose per-split audit; GnuCash log format is per-split.
- No change log for splits: Rejected; audit trail is valuable.
