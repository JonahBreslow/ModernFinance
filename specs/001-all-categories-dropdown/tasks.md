# Tasks: Show All Categories in Recategorize Dropdown

**Input**: Design documents from `/specs/001-all-categories-dropdown/`  
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to

## Path Conventions

Web app layout — all changes are in `frontend/src/components/Recategorize/Recategorize.tsx`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: No new files or project initialization required for this feature — the change is entirely within an existing component. This phase is a no-op.

*No setup tasks required.*

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Rename `SOURCE_ACCOUNT_TYPES` to `ROW_SOURCE_TYPES` and remove `EQUITY` from it. Update the two helper functions that use this constant (`getCategorizableSplits`, `getSourceSplits`). These changes define the new semantic split between "row source filtering" and "picker filtering" and are prerequisites for both user stories.

**⚠️ CRITICAL**: Both user story phases depend on this renaming being complete first.

- [ ] T001 In `frontend/src/components/Recategorize/Recategorize.tsx` line ~379, replace the constant declaration: rename `SOURCE_ACCOUNT_TYPES` to `ROW_SOURCE_TYPES` and remove `'EQUITY'` from the set, so it becomes `new Set(['BANK', 'CASH', 'CREDIT', 'ROOT'])`. Update the comment above it to reflect the new intent (EQUITY accounts like Imbalance-USD are now categorizable rows).
- [ ] T002 In `frontend/src/components/Recategorize/Recategorize.tsx`, update `getCategorizableSplits` (line ~382) and `getSourceSplits` (line ~392) to reference `ROW_SOURCE_TYPES` instead of `SOURCE_ACCOUNT_TYPES`. (Covers both entries 2 and 3 in the research.md edit table.)

**Checkpoint**: `ROW_SOURCE_TYPES` is defined and both helper functions compile. The old `SOURCE_ACCOUNT_TYPES` name no longer exists.

---

## Phase 3: User Story 1 — Recategorize to Any Account (Priority: P1) 🎯 MVP

**Goal**: EQUITY-typed splits (e.g. Imbalance-USD) appear as actionable rows in the Recategorize table, and all category pickers (inline cell, split modal, bulk action) offer every non-ROOT, non-placeholder account as a selectable target.

**Independent Test**: Navigate to the Recategorize tab with a GnuCash file containing Imbalance-USD transactions. Verify: (1) Imbalance-USD rows appear in the table, (2) clicking the category cell on any row shows Imbalance-USD in the dropdown, (3) existing EXPENSE/INCOME rows and pickers continue to work unchanged.

### Implementation for User Story 1

- [ ] T003 [US1] In `frontend/src/components/Recategorize/Recategorize.tsx`, update the `rows` useMemo (line ~454) — replace the inline filter `!SOURCE_ACCOUNT_TYPES.has(acc.type) && !acc.placeholder` with `!ROW_SOURCE_TYPES.has(acc.type) && !acc.placeholder` so EQUITY splits surface as table rows. **Preserve the existing `.sort()` call on the resulting array — do not remove or reorder it (FR-006).**
- [ ] T004 [US1] In `frontend/src/components/Recategorize/Recategorize.tsx`, update the `categorizableAccounts` useMemo (line ~524) — replace the filter `!SOURCE_ACCOUNT_TYPES.has(a.type) && !a.placeholder` with `a.type !== 'ROOT' && !a.placeholder`. This list feeds both the inline `AccountPicker` (category cell, FR-001) and the bulk "Recategorize all to…" action (FR-004), and is passed as `categorizableAccounts` into `SplitModal` (FR-003). **Preserve the existing `.sort()` call — do not remove or reorder it (FR-006).**

**Checkpoint**: User Story 1 is fully functional. Imbalance-USD rows appear in the table and in every category picker. EXPENSE/INCOME accounts remain unaffected.

---

## Phase 4: User Story 2 — Filter Bar Shows All Categories (Priority: P2)

**Goal**: The "All categories" filter bar at the top of the Recategorize tab lists all non-ROOT, non-placeholder accounts — including Imbalance-USD and any BANK/CASH/CREDIT/EQUITY accounts — so users can filter the table to transactions assigned to those account types.

**Independent Test**: Open the Recategorize tab filter dropdown, search for "Imbalance" — Imbalance-USD must appear as a selectable filter option. Selecting it must narrow the table to only Imbalance-USD rows.

### Implementation for User Story 2

- [ ] T005 [US2] In `frontend/src/components/Recategorize/Recategorize.tsx`, update the `filterAccounts` useMemo (line ~469) — replace the filter `!SOURCE_ACCOUNT_TYPES.has(a.type) && !a.placeholder` with `a.type !== 'ROOT' && !a.placeholder`.

**Checkpoint**: User Stories 1 AND 2 are both functional. The filter bar and all pickers show the full account list.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Verify no regressions, ensure lint passes, and confirm the old constant name is fully removed.

- [ ] T006 In `frontend/src/components/Recategorize/Recategorize.tsx`, do a final search for any remaining references to `SOURCE_ACCOUNT_TYPES` and confirm none exist (the rename must be complete across the whole file).
- [ ] T007 Run `npm run lint` from the repo root and resolve any TypeScript or ESLint errors introduced by the changes in `frontend/src/components/Recategorize/Recategorize.tsx`. Then perform a manual browser verification covering all three success criteria: (SC-002) confirm a user can recategorize an Imbalance-USD transaction in 3 clicks or fewer; (SC-003) confirm existing EXPENSE and INCOME account rows still appear and their category pickers still work correctly; (SC-004) confirm the category dropdown opens without any perceptible slowdown compared to before the change.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 2)**: No dependencies — start immediately
- **User Story 1 (Phase 3)**: Depends on Phase 2 (T001, T002 must be complete)
- **User Story 2 (Phase 4)**: Independent of Phase 2 — T005 replaces the filter expression entirely and does not reference `ROW_SOURCE_TYPES`; independent of Phase 3
- **Polish (Phase 5)**: Depends on Phases 3 and 4 being complete

### User Story Dependencies

- **User Story 1 (P1)**: Depends on Foundational (T001, T002) only — no dependency on US2
- **User Story 2 (P2)**: No dependency on T001 or T002 — T005 replaces the entire filter expression rather than referencing `ROW_SOURCE_TYPES`, so it is independent and can be applied at any point

### Within Each User Story

- T001 must precede T002 (T002 references the renamed constant)
- T001 must precede T003 (references `ROW_SOURCE_TYPES`); T005 is independent of T001
- T002 is independent of T003, T004, T005

### Parallel Opportunities

- T003 and T005 can be done in parallel (both depend only on T001 being done, and they edit different `useMemo` blocks in the same file — coordinate to avoid conflicts if working simultaneously)
- T004 is independent of T005

---

## Parallel Example: After Foundational (T001, T002 done)

```
Story 1 track:            Story 2 track:
T003 (rows useMemo)       T005 (filterAccounts useMemo)
T004 (pickers useMemo)
```

Both tracks modify the same file. If working solo, complete Story 1 track first, then Story 2. If pairing, coordinate edits carefully.

---

## Implementation Strategy

### MVP First (User Story 1 Only — 3 tasks)

1. Complete T001, T002 (rename constant, update helper functions)
2. Complete T003, T004 (rows + pickers now show EQUITY accounts)
3. **STOP and VALIDATE**: Confirm Imbalance-USD rows appear and pickers include all accounts
4. Ship — the core user complaint is resolved

### Incremental Delivery

1. T001 → T002 → T003 → T004 → validate US1 (MVP)
2. T005 → validate US2 (filter bar)
3. T006 → T007 (polish and lint)

### Total Tasks: 7

| Phase | Tasks | Count |
|-------|-------|-------|
| Foundational | T001, T002 | 2 |
| User Story 1 (P1) | T003, T004 | 2 |
| User Story 2 (P2) | T005 | 1 |
| Polish | T006, T007 | 2 |
| **Total** | | **7** |

---

## Notes

- All 7 tasks edit a single file: `frontend/src/components/Recategorize/Recategorize.tsx`
- No backend changes, no new files, no new dependencies
- [P] markers omitted since all edits are in the same file — serial execution is safer
- Each story checkpoint is independently verifiable in the browser
- Commit after each phase checkpoint for clean rollback points
