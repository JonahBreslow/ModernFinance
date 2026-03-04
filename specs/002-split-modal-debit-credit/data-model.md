# Data Model: Split Modal Debit/Credit Differentiation

**Feature**: 002-split-modal-debit-credit  
**Date**: 2025-03-03

## Existing Entities (unchanged)

### SplitEdit
- `splitId`, `accountId`, `value`, `memo`
- `value` sign: negative = debit, positive = credit

### Split
- Unchanged from 001-recategorize-multi-split

---

## Display Model (UI-only)

### Split Line Row (Register-style)

| Column | Content | Styling |
|--------|---------|---------|
| Category | Account picker (unchanged) | — |
| Debit | Amount when `value < 0` | `text-red-400` |
| Credit | Amount when `value > 0` | `text-emerald-400` |
| Remove | Remove button | — |

**Rules**:
- Each row displays amount in exactly one of Debit or Credit (never both).
- Empty column shows empty cell (or placeholder).
- Table header: "Category" | "Debit" | "Credit" | (actions)

### Validation (unchanged)
- Sum of all `value` = expected total (tolerance 0.01)
- At least one line; non-zero amounts; valid accountId
