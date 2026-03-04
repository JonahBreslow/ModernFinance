# Implementation Plan: Recategorize into Multi-Split Transactions

**Branch**: `001-recategorize-multi-split` | **Date**: 2025-03-03 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/001-recategorize-multi-split/spec.md`

## Summary

Enable users to split a single-category transaction into multiple categories (or add/edit/remove splits) from the Recategorize menu. The existing single-split recategorization (change one split's account) remains unchanged. New workflow: user initiates "Split" on a row, edits a list of category+amount lines, validates sum equals original total, and saves. Backend already supports full transaction updates with arbitrary splits via PUT; frontend needs new UI and staged-change model for multi-split edits.

## Technical Context

**Language/Version**: TypeScript 5.x (frontend), Node.js (backend)  
**Primary Dependencies**: React, Vite, Express, GnuCash XML serializer  
**Storage**: GnuCash `.gnucash` XML file (gzipped), local filesystem  
**Testing**: Manual / in-browser (no formal test suite in project)  
**Target Platform**: Web (Chrome/Firefox/Safari), backend on port 3001, frontend on 5173  
**Project Type**: Web application (frontend + backend)  
**Performance Goals**: Split operation completes in under 2 seconds; no perceptible lag when editing 2–10 splits  
**Constraints**: Local-first; GnuCash-compatible output; double-entry balance (sum of split values = 0)  
**Scale/Scope**: Single user; typical transaction has 2–10 splits; Recategorize shows hundreds of rows

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| **I. Local-First** | ✅ Pass | No cloud; all data in GnuCash file on disk |
| **II. Technology Stack** | ✅ Pass | Express backend, Vite + React + TypeScript frontend |
| **III. Follow Existing Patterns** | ✅ Pass | Extend Recategorize component; use existing `updateTransaction` API, serializer, change-log |
| **IV. GnuCash Compatibility** | ✅ Pass | New splits use existing GUID format; serializer already writes arbitrary splits; balance enforced before save |

**No violations.** Complexity Tracking table not needed.

## Project Structure

### Documentation (this feature)

```text
specs/001-recategorize-multi-split/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
frontend/
├── src/
│   ├── components/
│   │   └── Recategorize/
│   │       ├── Recategorize.tsx       # Main component (extend)
│   │       └── SplitModal.tsx         # NEW: split editor modal
│   ├── lib/
│   │   ├── api.ts                     # updateTransaction (unchanged)
│   │   └── utils.ts                  # generateGuid (existing)
│   └── types/
│       └── index.ts                  # Split, Transaction (unchanged)

backend/
├── index.js                           # PUT /api/transactions/:id (unchanged)
├── serializer.js                      # serializeTransaction (unchanged)
└── config.js                         # getGnuCashFile (unchanged)
```

**Structure Decision**: Extend `Recategorize.tsx` with a "Split" action per row; add `SplitModal.tsx` for the split-editor UI. Backend requires no changes; `updateTransaction` already accepts full transaction with modified splits.
