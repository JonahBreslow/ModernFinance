# Tasks: Improved Import Duplicate Detection

**Input**: Design documents from `/specs/003-import-duplicate-detection/`  
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Not requested; manual validation per quickstart.md.

**Organization**: Tasks grouped by user story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel
- **[Story]**: User story (US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verify environment and branch

- [x] T001 Verify branch `003-import-duplicate-detection` is checked out and `npm install` has been run at repo root
- [x] T002 [P] Confirm import preview endpoint and duplicate detection logic location in `backend/index.js` (POST /api/import/preview, lines ~427–521)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: None required—extends existing import preview; no new infrastructure.

**Checkpoint**: Ready to implement US1

---

## Phase 3: User Story 1 - Detect Cross-Account Transfer Duplicates (Priority: P1) 🎯 MVP

**Goal**: When importing credit card transactions with offset account set, "automatic payment" credits are flagged as duplicates when a matching payment (opposite sign, same amount, date ±2 days) exists in the offset account.

**Independent Test**: Import checking payment first, then credit card file with target=credit card, offset=checking; verify "AUTOMATIC PAYMENT" row is marked duplicate and deselected.

### Implementation for User Story 1

- [x] T003 [US1] Add `offsetAccountId` to request body parsing (`req.body.offsetAccountId || null`) in `backend/index.js` POST /api/import/preview
- [x] T004 [US1] Add `TRANSFER_DATE_TOLERANCE_DAYS = 2` constant and build transfer match key set from offset-account splits (format `date|abs(amount)`, dates ±2 days, only splits where `split.accountId === offsetAccountId`) in `backend/index.js`
- [x] T005 [US1] For each import row not already duplicate: if `offsetAccountId` valid, check transfer match (opposite sign, same abs amount, date within tolerance) and set `isDuplicate = true` in `backend/index.js`
- [x] T006 [US1] Add `offsetAccountId` parameter to `previewImport` and append to FormData when provided in `frontend/src/lib/api.ts`
- [x] T007 [US1] Pass `offsetAccountId: imbalanceAccId || autoOffsetAccId || undefined` to `previewImport` in both `handleFile` and `handleMappingConfirm` in `frontend/src/components/Import/Import.tsx`

**Checkpoint**: User Story 1 complete—transfer duplicates detected when offset account provided

---

## Phase 4: User Story 2 - Preserve Existing Duplicate Detection (Priority: P1)

**Goal**: FITID and fuzzy same-account duplicate detection continue to work; no regression.

**Independent Test**: Import same file twice; all rows duplicates on second import. Import with target only (no offset); same-account duplicates still flagged.

### Implementation for User Story 2

- [x] T008 [US2] Verify duplicate detection order in `backend/index.js`: (1) FITID match, (2) fuzzy same-account match, (3) transfer match; ensure transfer check runs only when row not already duplicate and `offsetAccountId` provided

**Checkpoint**: User Story 2 complete—no regression

---

## Phase 5: User Story 3 - Configurable Transfer Matching (Priority: P2)

**Goal**: Offset account from UI (user-selected or auto-detected) is used for transfer matching.

**Independent Test**: Import credit card with offset=checking; duplicate detected. Change offset to different account; behavior adjusts.

### Implementation for User Story 3

- [x] T009 [US3] Ensure offset account is passed from `imbalanceAccId` (user-selected) or `autoOffsetAccId` (auto-detected) in `frontend/src/components/Import/Import.tsx`; verify both upload and re-parse-after-mapping flows pass offset

**Checkpoint**: User Story 3 complete—offset configurable via UI

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validation and quickstart manual test

- [ ] T010 Run quickstart.md manual test: Import checking payment → import credit card with offset=checking → verify transfer duplicate flagged; verify no regression (same file twice, target-only import)
- [x] T011 [P] Verify amount comparison uses floating-point tolerance (0.01) for transfer match in `backend/index.js`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1**: No dependencies
- **Phase 2**: N/A (no foundational tasks)
- **Phase 3 (US1)**: Depends on Phase 1
- **Phase 4 (US2)**: Depends on Phase 3 (verification of order)
- **Phase 5 (US3)**: Depends on Phase 3 (T009 may overlap with T007; ensure both flows covered)
- **Phase 6**: Depends on Phase 4, 5

### User Story Dependencies

- **US1**: Core implementation; can be delivered as MVP
- **US2**: Verification that US1 preserves existing logic
- **US3**: Ensures offset flows through UI; may be satisfied by T007

### Parallel Opportunities

- T002 can run with T001
- T011 can run with T010

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 3: User Story 1 (T003–T007)
3. **STOP and VALIDATE**: Manual test per quickstart
4. Demo: Import credit card after checking payment; automatic payment flagged as duplicate

### Incremental Delivery

1. Setup → US1 → MVP
2. US2 → Verify no regression
3. US3 → Verify offset from UI
4. Polish → Quickstart validation

### Format Validation

- [x] All tasks use `- [ ]` checkbox
- [x] All tasks have Task ID (T001–T011)
- [x] [P] marker on T002, T011
- [x] [US1], [US2], [US3] on story tasks
- [x] File paths included in descriptions
