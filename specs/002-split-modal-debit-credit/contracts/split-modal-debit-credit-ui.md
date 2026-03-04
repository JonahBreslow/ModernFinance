# UI Contract: Split Modal Debit/Credit Layout

**Feature**: 002-split-modal-debit-credit  
**Component**: SplitModal (modified)

## Layout Change

Replace the single amount column with two columns: **Debit** and **Credit**.

## Column Specification

| Column | Header | Content | Color |
|--------|--------|---------|-------|
| Debit | "Debit" | Amount when `value < 0`; empty otherwise | Red (`text-red-400`) |
| Credit | "Credit" | Amount when `value > 0`; empty otherwise | Green (`text-emerald-400`) |

## Row Layout

Each split line row: `[Category picker] [Debit cell] [Credit cell] [Remove button]`

- Debit cell: Editable when value is negative; displays `Math.abs(value)` in red.
- Credit cell: Editable when value is positive; displays `Math.abs(value)` in green.
- For `value === 0`: Default to Credit column (user types positive) or allow either; implementation may default based on `expectedTotal` sign.

## Input Behavior

- User edits amount in the active column (Debit or Credit).
- Changing sign (e.g., typing negative in Credit) moves the amount to the Debit column and updates styling.
- Validation unchanged: sum of all `value` must equal `expectedTotal`.

## Compatibility

- Props, callbacks, and validation rules unchanged from 001-recategorize-multi-split.
- `onSave(newSplits: Split[])` receives same data shape; only presentation changes.
