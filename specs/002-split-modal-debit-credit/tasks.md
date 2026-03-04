# Tasks: Split Modal Debit/Credit Differentiation

**Input**: Design documents from `/specs/002-split-modal-debit-credit/`  
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Not requested; manual validation per quickstart.md.

**Organization**: Tasks grouped by user story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel
- **[Story]**: User story (US1, US2)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verify environment and branch

- [x] T001 Verify branch `002-split-modal-debit-credit` is checked out and `npm install` has been run at repo root
- [x] T002 [P] Confirm SplitModal exists at `frontend/src/components/Recategorize/SplitModal.tsx` and Register uses `text-red-400`/`text-emerald-400` for debit/credit in `frontend/src/components/Register/Register.tsx`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: None required—extends existing SplitModal; no new infrastructure.

**Checkpoint**: Ready to implement US1

---

## Phase 3: User Story 1 - Visually Distinguish Debits from Credits (Priority: P1) 🎯 MVP

**Goal**: Split modal displays separate Debit and Credit columns (Register-style) with debits in red and credits in green.

**Independent Test**: Open Split modal on a transaction; verify Debit and Credit column headers; verify negative amounts in red (Debit column), positive amounts in green (Credit column).

### Implementation for User Story 1

- [x] T003 [US1] Replace single amount input with two columns (Debit | Credit) in the split line rows in `frontend/src/components/Recategorize/SplitModal.tsx`
- [x] T004 [US1] Add table header row with "Category" | "Debit" | "Credit" | (actions) in `frontend/src/components/Recategorize/SplitModal.tsx`
- [x] T005 [US1] For each edit line: when `value < 0`, render amount in Debit column with `text-red-400`; when `value > 0`, render in Credit column with `text-emerald-400`; when `value === 0`, show empty or default to Credit column per contracts/split-modal-debit-credit-ui.md in `frontend/src/components/Recategorize/SplitModal.tsx`
- [x] T006 [US1] Make amount input editable in the correct column (Debit or Credit) based on sign; ensure typing negative moves value to Debit column and updates styling in `frontend/src/components/Recategorize/SplitModal.tsx`
- [x] T007 [US1] Update Total/Expected display to use red/green for debit/credit consistency if applicable; ensure validation and Save flow unchanged in `frontend/src/components/Recategorize/SplitModal.tsx`

**Checkpoint**: User Story 1 complete—debit/credit columns with red/green styling

---

## Phase 4: User Story 2 - Consistent Presentation Across Transaction Types (Priority: P2)

**Goal**: Same debit/credit convention works for expense and income splits.

**Independent Test**: Open Split on a mortgage expense and an income split; verify both use Debit (red) and Credit (green) columns correctly.

### Implementation for User Story 2

- [x] T008 [US2] Verify expense and income flows: when `expectedTotal` is negative (income), debit/credit columns still display correctly (negative values in Debit/red, positive in Credit/green) in `frontend/src/components/Recategorize/SplitModal.tsx`
- [x] T009 [US2] Ensure `handleValueChange` sign logic correctly applies for both expense and income flows (e.g., `expectedTotal >= 0` vs `expectedTotal < 0`) in `frontend/src/components/Recategorize/SplitModal.tsx`

**Checkpoint**: User Story 2 complete—works for expense and income

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Validation and quickstart manual test

- [ ] T010 Run quickstart.md manual test: Recategorize → Split → verify Debit/Credit columns, red/green styling, edit and save flow in `frontend/src/components/Recategorize/SplitModal.tsx`
- [x] T011 [P] Verify existing Split modal validation (sum, at least one line, non-zero amounts) still works correctly in `frontend/src/components/Recategorize/SplitModal.tsx`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1**: No dependencies
- **Phase 2**: N/A (no foundational tasks)
- **Phase 3 (US1)**: Depends on Phase 1
- **Phase 4 (US2)**: Depends on Phase 3 (same layout; verification)
- **Phase 5**: Depends on Phase 4

### User Story Dependencies

- **US1**: Core implementation; can be delivered as MVP
- **US2**: Verification that US1 implementation handles both flows

### Parallel Opportunities

- T002 can run with T001
- T011 can run with T010

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 3: User Story 1 (T003–T007)
3. **STOP and VALIDATE**: Manual test per quickstart
4. Demo: Split modal with Debit/Credit columns, red/green

### Incremental Delivery

1. Setup → US1 → MVP
2. US2 → Verify income flow
3. Polish → Quickstart validation

### Format Validation

- [x] All tasks use `- [ ]` checkbox
- [x] All tasks have Task ID (T001–T011)
- [x] [P] marker on T002, T011
- [x] [US1], [US2] on story tasks
- [x] File paths included in descriptions
