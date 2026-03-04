# Quickstart: Split Modal Debit/Credit Differentiation

**Feature**: 002-split-modal-debit-credit  
**Branch**: `002-split-modal-debit-credit`

## Prerequisites

- Node.js 18+
- Feature 001-recategorize-multi-split merged or available
- GnuCash file configured

## Run Locally

```bash
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3001

## Key File to Modify

| File | Purpose |
|------|---------|
| `frontend/src/components/Recategorize/SplitModal.tsx` | Add Debit/Credit columns; apply red/green styling |

## Implementation Summary

1. Replace single amount input with two columns: Debit | Credit
2. For each edit line: if `value < 0`, show in Debit column (red); if `value > 0`, show in Credit column (green)
3. Add table header: Category | Debit | Credit | (actions)
4. Ensure amount input appears in the correct column and uses correct color

## Manual Test

1. Open Recategorize
2. Click Split on a transaction
3. Verify: Debit column header, Credit column header
4. Verify: Negative amounts in red (Debit column), positive amounts in green (Credit column)
5. Edit an amount; verify color and column update correctly
6. Save; verify transaction persists correctly
