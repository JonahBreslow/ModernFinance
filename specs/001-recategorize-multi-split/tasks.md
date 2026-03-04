# Tasks: Recategorize into Multi-Split Transactions

**Input**: Design documents from `/specs/001-recategorize-multi-split/`  
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Not requested in spec; manual validation per quickstart.md.

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: User story (US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Frontend**: `frontend/src/components/Recategorize/`, `frontend/src/lib/`
- **Backend**: No changes (per plan.md)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verify environment and branch

- [x] T001 Verify branch `001-recategorize-multi-split` is checked out and `npm install` has been run at repo root
- [x] T002 [P] Confirm `generateGuid` exists in `frontend/src/lib/utils.ts` and `updateTransaction` in `frontend/src/lib/api.ts` (no changes needed)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared types and logic required by all user stories

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T003 Define `StagedSplitChange` and `SplitEdit` types (or interfaces) in `frontend/src/components/Recategorize/Recategorize.tsx` or a shared types file per data-model.md
- [x] T004 Implement `buildNewSplitsFromEdits(txn, edits, accountMap)` helper: preserve source splits, replace categorizable splits with edits, use `generateGuid()` for new splits, preserve `onlineId` on updated existing splits in `frontend/src/components/Recategorize/Recategorize.tsx`
- [x] T005 Implement `getCategorizableSplits(txn, accountMap)` and `getOriginalCategorizableTotal(txn, accountMap)` helpers using `SOURCE_ACCOUNT_TYPES` in `frontend/src/components/Recategorize/Recategorize.tsx`

**Checkpoint**: Foundation ready—SplitModal and Recategorize integration can begin

---

## Phase 3: User Story 1 - Split Single-Category into Multiple (Priority: P1) 🎯 MVP

**Goal**: User can split a transaction with one categorizable split into multiple categories (e.g., $100 Groceries → $60 Groceries + $40 Household) from Recategorize.

**Independent Test**: Select a single-split transaction in Recategorize, click Split, add a second line with amount, adjust amounts so sum = original, Save; verify transaction has 2 expense splits in Register.

### Implementation for User Story 1

- [x] T006 [P] [US1] Create `SplitModal.tsx` in `frontend/src/components/Recategorize/SplitModal.tsx` with props per contracts/split-modal-ui.md: `transaction`, `accounts`, `categorizableAccounts`, `onSave`, `onCancel`
- [x] T007 [US1] Implement SplitModal UI: list of rows with [Category picker] [Amount input] [Remove button], "Add line" button, Total/Expected display, Save (disabled when invalid), Cancel in `frontend/src/components/Recategorize/SplitModal.tsx`
- [x] T008 [US1] Implement SplitModal validation: sum of amounts equals original categorizable total (tolerance 0.01), at least one line, non-zero amounts, valid accountId per contracts/split-modal-ui.md in `frontend/src/components/Recategorize/SplitModal.tsx`
- [x] T009 [US1] Implement SplitModal error states: "Amounts must sum to $X.XX" when mismatch, "Add at least one category" when empty in `frontend/src/components/Recategorize/SplitModal.tsx`
- [x] T010 [US1] Add "Split" button/link to each Recategorize row when the transaction has exactly one categorizable split in `frontend/src/components/Recategorize/Recategorize.tsx`
- [x] T011 [US1] Add `StagedSplitChange` state (Map by txnId) and `splitModalTxn` state in `frontend/src/components/Recategorize/Recategorize.tsx`; ensure single-split and multi-split staging are mutually exclusive per transaction per research.md
- [x] T012 [US1] Wire Split button: open SplitModal with transaction, pre-populate edits from current categorizable splits; on Save, create StagedSplitChange and close modal in `frontend/src/components/Recategorize/Recategorize.tsx`
- [x] T013 [US1] Extend `saveChanges()` to apply StagedSplitChange: for each, call `buildNewSplitsFromEdits`, merge with source splits, call `updateTransaction`, invalidate queries in `frontend/src/components/Recategorize/Recategorize.tsx`
- [x] T014 [US1] Extend PendingBar to display StagedSplitChange entries (e.g., "Split: $100 → 2 categories") and support Undo in `frontend/src/components/Recategorize/Recategorize.tsx`

**Checkpoint**: User Story 1 complete—single-split transactions can be split into multiple categories

---

## Phase 4: User Story 2 - Add Category to Existing Multi-Split (Priority: P2)

**Goal**: User can add a new category line to a transaction that already has multiple expense splits (e.g., add $20 Pharmacy by reallocating from existing splits).

**Independent Test**: Select a multi-split transaction in Recategorize, click Split, add a new line with category and amount, reduce an existing line to reallocate, Save; verify transaction has the new split and remains balanced.

### Implementation for User Story 2

- [x] T015 [US2] Add "Split" button to Recategorize rows when the transaction has multiple categorizable splits (not just single) in `frontend/src/components/Recategorize/Recategorize.tsx`
- [x] T016 [US2] Ensure SplitModal "Add line" creates a new SplitEdit with `splitId: null`, `accountId` from picker, `value` from user input; validate at least one split remains after any Remove in `frontend/src/components/Recategorize/SplitModal.tsx`
- [x] T017 [US2] Implement Remove button: remove line from edits, enforce "at least one categorizable split remains" (disable Remove when only one line), update validation in `frontend/src/components/Recategorize/SplitModal.tsx`

**Checkpoint**: User Story 2 complete—multi-split transactions can have categories added

---

## Phase 5: User Story 3 - Reallocate Amounts Between Splits (Priority: P3)

**Goal**: User can edit amounts on existing splits to reallocate (e.g., $60/$40 → $50/$50); validation prevents save when sum != total.

**Independent Test**: Open Split on a multi-split transaction, change amounts so sum still equals total, Save; verify new amounts persist. Then change amounts so sum != total; verify Save is disabled and error is shown.

### Implementation for User Story 3

- [x] T018 [US3] Ensure amount inputs in SplitModal are fully editable (not read-only); revalidation runs on each change in `frontend/src/components/Recategorize/SplitModal.tsx`
- [x] T019 [US3] Verify FR-007: when user edits amounts such that sum does not match expected total, Save stays disabled and "Amounts must sum to $X.XX" (or equivalent) is displayed in `frontend/src/components/Recategorize/SplitModal.tsx`
- [x] T020 [US3] Ensure Cancel/close without saving leaves transaction unchanged; Escape key closes modal in `frontend/src/components/Recategorize/SplitModal.tsx`

**Checkpoint**: User Story 3 complete—amount reallocation with validation works

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Coexistence with single-split recategorization, edge cases, quickstart validation

- [x] T021 Ensure FR-008: when a transaction has StagedSplitChange, do not show or apply StagedChange for that transaction; when user uses CategoryCell (single-split recategorization), clear any StagedSplitChange for that txn in `frontend/src/components/Recategorize/Recategorize.tsx`
- [x] T022 Prevent opening Split modal when transaction has zero categorizable splits (edge case); ensure Split button visibility logic excludes such rows in `frontend/src/components/Recategorize/Recategorize.tsx`
- [ ] T023 Run quickstart.md manual test: Recategorize → find single-split txn → Split → add line → adjust amounts → Save → verify in Register and GnuCash desktop app
- [x] T024 [P] Verify existing single-split recategorization (CategoryCell picker, bulk recategorize) still works unchanged in `frontend/src/components/Recategorize/Recategorize.tsx`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies—start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1—BLOCKS all user stories
- **Phase 3 (US1)**: Depends on Phase 2—MVP
- **Phase 4 (US2)**: Depends on Phase 3 (SplitModal and Recategorize integration exist)
- **Phase 5 (US3)**: Depends on Phase 4 (Add/Remove already in modal)
- **Phase 6 (Polish)**: Depends on Phase 5

### User Story Dependencies

- **US1 (P1)**: After Foundational—no other story dependencies
- **US2 (P2)**: Builds on US1 (SplitModal + Split button); adds multi-split row support and Add/Remove
- **US3 (P3)**: Builds on US2; amount editing and validation refinement

### Within Each User Story

- US1: SplitModal creation → validation → Recategorize integration → save flow → PendingBar
- US2: Split for multi-split rows → Add line → Remove with validation
- US3: Amount edit behavior → validation error display → Cancel/Escape

### Parallel Opportunities

- T002 can run in parallel with T001
- T006 (SplitModal creation) can start as soon as T003–T005 are done
- T024 can run in parallel with T021–T023

---

## Parallel Example: User Story 1

```bash
# After T003–T005 complete:
# T006 creates SplitModal.tsx (new file)
# T007–T009 implement modal UI and validation (same file, sequential)
# T010–T014 extend Recategorize.tsx (sequential due to state/save flow)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (T003–T005)
3. Complete Phase 3: User Story 1 (T006–T014)
4. **STOP and VALIDATE**: Manual test per quickstart.md
5. Demo: Split a $100 Groceries transaction into $60 Groceries + $40 Household

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add US1 → Test independently → MVP
3. Add US2 → Add/Remove categories on multi-split
4. Add US3 → Reallocate amounts with validation
5. Polish → FR-008 coexistence, edge cases

### Format Validation

- [x] All tasks use `- [ ]` checkbox
- [x] All tasks have Task ID (T001–T024)
- [x] [P] marker on parallelizable tasks (T002, T006, T024)
- [x] [US1], [US2], [US3] on user story phase tasks
- [x] File paths included in descriptions
