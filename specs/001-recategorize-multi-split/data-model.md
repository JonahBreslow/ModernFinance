# Data Model: Recategorize into Multi-Split Transactions

**Feature**: 001-recategorize-multi-split  
**Date**: 2025-03-03

## Existing Entities (unchanged)

### Transaction
- `id`, `description`, `datePosted`, `dateEntered`, `notes`, `currency`, `splits`
- Validation: `splits` array; sum of `split.value` across all splits = 0 (double-entry balance)

### Split
- `id`, `accountId`, `value`, `quantity`, `reconciledState`, `reconcileDate`, `memo`, `action`, `onlineId`
- New splits: `id` from `generateGuid()`; `quantity` = `value`; `reconciledState` = 'n'; `memo` = ''; `onlineId` = null

### Account
- Used for categorizable accounts (expense/income); `SOURCE_ACCOUNT_TYPES` excludes BANK, CASH, CREDIT, EQUITY, ROOT

---

## New / Extended Entities

### StagedSplitChange (frontend-only, in-memory)

Represents a pending multi-split edit for a transaction.

| Field | Type | Description |
|-------|------|-------------|
| `txn` | Transaction | The transaction being edited |
| `originalCategorizableTotal` | number | Sum of categorizable split values before edit (for validation) |
| `edits` | SplitEdit[] | User-edited lines (category + amount) |

### SplitEdit (frontend-only)

A single line in the split editor.

| Field | Type | Description |
|-------|------|-------------|
| `splitId` | string \| null | Existing split ID, or null for new split |
| `accountId` | string | Target category account |
| `value` | number | Amount for this split (same sign as original categorizable total) |
| `memo` | string | Optional memo (default '' for new) |

**Validation rules**:
- Sum of `edits[].value` MUST equal `originalCategorizableTotal` (within floating-point tolerance, e.g. 0.01)
- At least one edit required
- `accountId` must be a valid categorizable account
- `value` must be non-zero for each edit

---

## State Transitions

### Single-split recategorization (existing)
- User selects new category in CategoryCell → `StagedChange` added (txnId|splitId → toAccountId)
- Save → `updateTransaction` with one split's accountId changed

### Multi-split workflow (new)
1. User clicks "Split" on a row → open SplitModal with `txn`, pre-populated with current categorizable splits
2. User adds/edits/removes lines → `SplitEdit[]` updated in modal state
3. User clicks "Save" in modal → validate sum; if valid, create `StagedSplitChange` (or apply immediately and add to pending bar)
4. On global "Save" → for each `StagedSplitChange`: build new splits (preserve source splits, replace categorizable with edits), call `updateTransaction`

### Build new splits from SplitEdit[]
- Source splits: keep as-is from `txn.splits` (where account is in SOURCE_ACCOUNT_TYPES)
- Categorizable splits: replace with edits. For each edit:
  - If `splitId` exists and is in original categorizable splits: update that split's `accountId` and `value`
  - Else: create new split with `generateGuid()`, `accountId`, `value`, `quantity=value`, `reconciledState='n'`, etc.
- Preserve `onlineId` on existing splits when only accountId/value change; new splits get `onlineId: null`
