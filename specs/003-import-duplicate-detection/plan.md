# Implementation Plan: Improved Import Duplicate Detection

**Branch**: `003-import-duplicate-detection` | **Date**: 2025-03-03 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/003-import-duplicate-detection/spec.md`

## Summary

Add cross-account transfer duplicate detection to the import preview flow. When importing credit card transactions, the system will flag "automatic payment" credits as duplicates when a matching payment (opposite sign, same amount, date within tolerance) already exists in the offset/balance account (e.g., checking). The backend `/api/import/preview` endpoint will accept an optional `offsetAccountId` and extend duplicate detection to consider splits in that account. The frontend will pass the offset account (imbalanceAccId) to the preview API. Existing FITID and fuzzy same-account duplicate detection remains unchanged.

## Technical Context

**Language/Version**: TypeScript 5.x (frontend), Node.js (backend)  
**Primary Dependencies**: React, Vite, Express, GnuCash XML store  
**Storage**: GnuCash `.gnucash` XML file (gzipped), local filesystem  
**Testing**: Manual / in-browser (no formal test suite in project)  
**Target Platform**: Web (Chrome/Firefox/Safari), backend on port 3001, frontend on 5173  
**Project Type**: Web application (frontend + backend)  
**Performance Goals**: Import preview completes in under 3 seconds for typical files (hundreds of rows)  
**Constraints**: Local-first; GnuCash-compatible; no cloud  
**Scale/Scope**: Single user; typical import 10–500 rows; ledger may have thousands of transactions

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| **I. Local-First** | ✅ Pass | No cloud; all data in GnuCash file on disk |
| **II. Technology Stack** | ✅ Pass | Express backend, Vite + React + TypeScript frontend |
| **III. Follow Existing Patterns** | ✅ Pass | Extend existing import preview logic in backend; follow addFuzzyKeys/fuzzyKey pattern |
| **IV. GnuCash Compatibility** | ✅ Pass | No schema changes; duplicate detection is read-only analysis |

**No violations.** Complexity Tracking table not needed.

## Project Structure

### Documentation (this feature)

```text
specs/003-import-duplicate-detection/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
backend/
├── index.js             # POST /api/import/preview — add offsetAccountId param, transfer duplicate logic

frontend/
├── src/
│   ├── components/
│   │   └── Import/
│   │       └── Import.tsx    # Pass offsetAccountId to previewImport
│   └── lib/
│       └── api.ts            # previewImport — add offsetAccountId param
```

**Structure Decision**: All changes are in existing files. Backend extends duplicate detection in `index.js`; frontend passes offset account to the API. No new modules or components.
