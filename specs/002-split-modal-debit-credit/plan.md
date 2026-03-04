# Implementation Plan: Split Modal Debit/Credit Differentiation

**Branch**: `002-split-modal-debit-credit` | **Date**: 2025-03-03 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/002-split-modal-debit-credit/spec.md`

## Summary

Add Register-style Debit and Credit columns to the Split Transaction modal, with red for debits and green for credits. Each split line displays its amount in either the Debit column (value < 0, money out) or Credit column (value > 0, money in). Extends the existing SplitModal from 001-recategorize-multi-split; no backend changes.

## Technical Context

**Language/Version**: TypeScript 5.x (frontend), Node.js (backend)  
**Primary Dependencies**: React, Vite, Express  
**Storage**: GnuCash `.gnucash` XML (unchanged)  
**Testing**: Manual / in-browser  
**Target Platform**: Web (Chrome/Firefox/Safari)  
**Project Type**: Web application (frontend + backend)  
**Performance Goals**: No perceptible lag when editing split lines  
**Constraints**: Local-first; compatible with existing Split modal save/cancel flow  
**Scale/Scope**: Single user; 2–10 splits per transaction

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| **I. Local-First** | ✅ Pass | No cloud; all data local |
| **II. Technology Stack** | ✅ Pass | Vite + React + TypeScript |
| **III. Follow Existing Patterns** | ✅ Pass | Extend SplitModal; align with Register's debit/credit styling |
| **IV. GnuCash Compatibility** | ✅ Pass | No data model changes; UI only |

**No violations.**

## Project Structure

### Documentation (this feature)

```text
specs/002-split-modal-debit-credit/
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
│   └── components/
│       └── Recategorize/
│           └── SplitModal.tsx    # Modify: add Debit/Credit columns, red/green styling
```

**Structure Decision**: Single-file change to SplitModal.tsx. No new components; follow Register's `getColumnLabels` pattern for debit/credit colors (red=debit, green=credit).
