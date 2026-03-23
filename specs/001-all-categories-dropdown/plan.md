# Implementation Plan: Show All Categories in Recategorize Dropdown

**Branch**: `001-all-categories-dropdown` | **Date**: 2026-03-23 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/001-all-categories-dropdown/spec.md`

## Summary

The Recategorize tab uses a single `SOURCE_ACCOUNT_TYPES` constant for two distinct purposes: determining which splits appear as table rows and determining which accounts appear in category pickers. Removing EQUITY from this set exposes Imbalance-USD rows; replacing picker filtering with a ROOT-only exclusion makes all real accounts selectable as targets. The fix is entirely in `frontend/src/components/Recategorize/Recategorize.tsx` — no backend, no new dependencies.

## Technical Context

**Language/Version**: TypeScript 5.x (frontend), Node.js (backend)  
**Primary Dependencies**: React 19, Vite 7, Express 4 — no new dependencies for this change  
**Storage**: GnuCash XML files (`.gnucash`) read/written via existing parser and serializer  
**Testing**: No automated test suite; verification is manual via browser  
**Target Platform**: Local web app — backend on port 3001, frontend on port 5173  
**Project Type**: Web application (local-first)  
**Performance Goals**: No measurable regression in dropdown render time (list is bounded by account count, typically <200 accounts)  
**Constraints**: Must not break GnuCash file compatibility; all writes go through existing serializer  
**Scale/Scope**: Single file change, 6 targeted edits within `Recategorize.tsx`

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Local-First | PASS | No network calls added; data stays on-disk |
| II. Technology Stack | PASS | Pure TypeScript/React change; no new libraries |
| III. Follow Existing Patterns | PASS | Stays within existing `useMemo` + filter pattern; renames one constant and adds one new constant |
| IV. GnuCash Compatibility | PASS | No writes to the file format change; serializer is unchanged |

No gate violations. Complexity Tracking section not required.

## Project Structure

### Documentation (this feature)

```text
specs/001-all-categories-dropdown/
├── plan.md              ← this file
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1 output
└── tasks.md             ← Phase 2 output (created by /speckit.tasks)
```

### Source Code (impacted paths only)

```text
frontend/
└── src/
    └── components/
        └── Recategorize/
            └── Recategorize.tsx   ← only file changed
```

No new files. No contract changes (internal UI concern). No backend changes.

---

## Phase 0: Research

See [research.md](./research.md) — all unknowns resolved, no NEEDS CLARIFICATION markers.

**Key findings summary**:
- The problem is the conflation of "row source filtering" and "picker account filtering" in one constant.
- Fix: rename `SOURCE_ACCOUNT_TYPES` → `ROW_SOURCE_TYPES` (remove EQUITY); change picker `useMemo`s to filter on `type !== 'ROOT'` only.
- Six targeted edits in one file; zero backend or dependency changes.

---

## Phase 1: Design & Contracts

### Data Model

See [data-model.md](./data-model.md).

### Contracts

No external interface changes. This feature only affects internal UI state (which accounts are presented in pickers and which splits appear as rows). The existing `GET /api/data` and `PUT /api/transactions/:id` contracts are unchanged.

---

## Implementation Design

### Core Change: Two Filtering Concerns, Two Constants

**Before** — one constant, two meanings:
```ts
const SOURCE_ACCOUNT_TYPES = new Set(['BANK', 'CASH', 'CREDIT', 'EQUITY', 'ROOT']);
// Used for BOTH: which splits are "source side" (rows), AND which accounts are blocked from pickers
```

**After** — two constants, one meaning each:
```ts
// Splits assigned to these account types are the "funding side" of a transaction.
// They are not surfaced as actionable rows (e.g. your checking account debit).
const ROW_SOURCE_TYPES = new Set(['BANK', 'CASH', 'CREDIT', 'ROOT']);

// Category pickers exclude only ROOT (structural) and placeholder (non-posting) accounts.
// All real accounts — including EQUITY, BANK, CASH, CREDIT — are valid recategorization targets.
// Applied inline: (a) => a.type !== 'ROOT' && !a.placeholder
```

### Edit Map (all in `frontend/src/components/Recategorize/Recategorize.tsx`)

| # | Line(s) | Change |
|---|---------|--------|
| 1 | 377–379 | Replace `SOURCE_ACCOUNT_TYPES` constant with `ROW_SOURCE_TYPES` (remove EQUITY) |
| 2 | 382–385 | `getCategorizableSplits`: replace `SOURCE_ACCOUNT_TYPES` → `ROW_SOURCE_TYPES` |
| 3 | 393–396 | `getSourceSplits`: replace `SOURCE_ACCOUNT_TYPES` → `ROW_SOURCE_TYPES` |
| 4 | 454–457 | `rows` useMemo inline filter: replace `SOURCE_ACCOUNT_TYPES` → `ROW_SOURCE_TYPES` |
| 5 | 469–474 | `filterAccounts` useMemo: replace `SOURCE_ACCOUNT_TYPES` filter → `a.type !== 'ROOT'` |
| 6 | 524–526 | `categorizableAccounts` useMemo: replace `SOURCE_ACCOUNT_TYPES` filter → `a.type !== 'ROOT'` |

### Verification Steps

1. Start dev server (`npm run dev`)
2. Load a GnuCash file with Imbalance-USD transactions
3. Navigate to Recategorize tab — confirm Imbalance-USD rows are visible in the table
4. Click the category cell on any row — confirm Imbalance-USD appears in the dropdown
5. Confirm INCOME and EXPENSE accounts still appear (no regression)
6. Confirm ROOT-level accounts do NOT appear in the dropdown
7. Open the category filter bar — confirm Imbalance-USD appears as a filter option
8. Open the split modal on a split transaction — confirm expanded picker includes Imbalance-USD
9. Run `npm run lint` — confirm no lint errors
