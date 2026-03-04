# Data Model: Import Duplicate Detection

**Feature**: 003-import-duplicate-detection  
**Date**: 2025-03-03

## Existing Entities (unchanged)

### ParsedRow (from import)
- `fitId`, `date`, `description`, `amount`, `memo`, `isDuplicate`
- `amount`: positive = credit (money in), negative = debit (money out) relative to target account

### Transaction / Split (from GnuCash store)
- Used for duplicate detection; no schema changes

---

## Extended API Contract

### POST /api/import/preview — New Request Field

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `offsetAccountId` | string | No | Account ID for the offset/balance account (e.g., checking when importing credit card). When provided, enables cross-account transfer duplicate detection. |

### Duplicate Detection Logic (in-memory, not persisted)

**Transfer match key** (built from offset-account splits):
- Format: `date|abs(amount)` (no description)
- For each offset split, add keys for dates in `[date - N, date + N]` where N = `TRANSFER_DATE_TOLERANCE_DAYS` (default 2)
- Amount uses `Math.abs(split.value)`; sign is implicit (offset debit ↔ import credit)

**Import row transfer check**:
- Build key: `rowDate ± tolerance | abs(row.amount)`
- Offset split must have opposite sign: if import row amount > 0 (credit), match offset splits with value < 0 (debit), and vice versa
- If any offset split key matches (within date range), mark `isDuplicate = true`

---

## Validation Rules

- Transfer matching runs only when `offsetAccountId` is non-empty and valid (exists in accounts).
- Date tolerance: configurable constant; default 2 days.
- Amount comparison: use `Math.abs()` and floating-point tolerance (e.g., 0.01) for equality.
