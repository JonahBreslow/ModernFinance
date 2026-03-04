# Quickstart: Import Duplicate Detection

**Feature**: 003-import-duplicate-detection  
**Branch**: `003-import-duplicate-detection`

## Prerequisites

- Node.js 18+
- GnuCash file configured (via Setup)
- `npm install` in repo root
- Two account files: checking (with payment transaction) and credit card (with automatic payment)

## Run Locally

```bash
# Terminal 1: Backend
npm run server

# Terminal 2: Frontend
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3001

## Key Files to Modify

| File | Purpose |
|------|---------|
| `backend/index.js` | Add `offsetAccountId` to import preview; implement transfer duplicate detection |
| `frontend/src/lib/api.ts` | Add `offsetAccountId` param to `previewImport` |
| `frontend/src/components/Import/Import.tsx` | Pass `imbalanceAccId` (or `autoOffsetAccId`) as `offsetAccountId` to `previewImport` |

## Implementation Order

1. Backend: Add `offsetAccountId` to request body; build transfer-match key set from offset-account splits
2. Backend: For each import row, if not already duplicate, check transfer match (opposite sign, same abs amount, date ±2 days)
3. Frontend: Add `offsetAccountId` to `previewImport` and FormData
4. Frontend: Pass offset account when calling `previewImport` (use `imbalanceAccId || autoOffsetAccId` when available)

## Testing Manually

### Transfer duplicate detection

1. Import checking account file first (include a payment to credit card, e.g., "Payment to Chase -$166.84")
2. Complete import; verify transaction appears in Register
3. Import credit card file (target = credit card, offset = checking)
4. Verify the "AUTOMATIC PAYMENT - THANK" (+$166.84) row is marked as **duplicate** and deselected
5. Import; verify no duplicate transaction is created

### No regression

1. Import same file twice; all rows should be duplicates on second import
2. Import file with target account only (no offset); same-account duplicates should still work
3. Import with offset = different account; transfer match should use that account

## Data Model Reference

- [data-model.md](./data-model.md) — Transfer match key format, validation rules
- [research.md](./research.md) — Algorithm decisions, date tolerance
