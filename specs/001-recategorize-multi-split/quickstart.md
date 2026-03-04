# Quickstart: Recategorize Multi-Split Feature

**Feature**: 001-recategorize-multi-split  
**Branch**: `001-recategorize-multi-split`

## Prerequisites

- Node.js 18+
- GnuCash file configured (via Setup)
- `npm install` in repo root

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
| `frontend/src/components/Recategorize/Recategorize.tsx` | Add "Split" action per row; integrate SplitModal; extend staged state for StagedSplitChange |
| `frontend/src/components/Recategorize/SplitModal.tsx` | **NEW** — Split editor UI (category + amount lines, validation, Save/Cancel) |
| `frontend/src/lib/utils.ts` | `generateGuid()` — used for new split IDs (no change) |
| `frontend/src/lib/api.ts` | `updateTransaction` — no change |

## Implementation Order

1. Create `SplitModal.tsx` with props from [contracts/split-modal-ui.md](./contracts/split-modal-ui.md)
2. Add "Split" button/link to each row in Recategorize (when transaction has exactly one categorizable split, or when editing multi-split)
3. Add `StagedSplitChange` state and merge with existing `StagedChange` for pending bar
4. Implement save logic: for StagedSplitChange, build new splits (source + categorizable from edits), call `updateTransaction`
5. Extend PendingBar to show split edits (e.g., "Split: $100 → 2 categories")
6. Add validation error display in SplitModal

## Testing Manually

1. Open Recategorize view
2. Find a transaction with one expense split (e.g., $100 to Groceries)
3. Click "Split" → modal opens with one line (Groceries $100)
4. Add a second line: Household $40; change first line to $60
5. Save → transaction should show 2 splits in Register
6. Verify in GnuCash desktop app that the file opens and balances are correct

## Data Model Reference

- [data-model.md](./data-model.md) — StagedSplitChange, SplitEdit, validation rules
- [research.md](./research.md) — Double-entry balance, GUID generation
