# Recategorize Multi-Split Requirements Quality Checklist

**Purpose**: Validate requirement quality for the Recategorize multi-split feature—completeness, clarity, consistency, and coverage before implementation  
**Created**: 2025-03-03  
**Feature**: [spec.md](../spec.md)

**Note**: This checklist tests the quality of the requirements (spec, plan, contracts)—not implementation behavior.

## Requirement Completeness

- [ ] CHK001 Are requirements defined for how the "Split" action is initiated (row-level vs transaction-level)? [Completeness, Spec §Assumptions]
- [ ] CHK002 Are memo handling requirements specified when adding or editing splits (preserve, editable, optional)? [Completeness, Gap]
- [ ] CHK003 Is the floating-point tolerance for sum validation (e.g., 0.01) documented in the spec or only in data-model? [Completeness, Spec §FR-002, data-model]
- [ ] CHK004 Are requirements defined for the maximum number of splits (SC-004 says "up to 10")—what happens when user attempts 11+? [Completeness, Spec §SC-004]
- [ ] CHK005 Are requirements specified for preserving `onlineId` on existing splits when only accountId/value change? [Completeness, data-model]

## Requirement Clarity

- [ ] CHK006 Is "transaction total" vs "categorizable portion" disambiguated in FR-002 for validation? [Clarity, Spec §FR-002]
- [ ] CHK007 Is "reallocating" in FR-006 explicitly defined (user reduces one split's amount and adds another, or system auto-distributes)? [Clarity, Spec §FR-006]
- [ ] CHK008 Is "clear validation message" in FR-007 specified with example wording or format? [Clarity, Spec §FR-007]
- [ ] CHK009 Is "under 60 seconds" in SC-001 measurable (e.g., from Split click to Save confirm)? [Clarity, Spec §SC-001]
- [ ] CHK010 Are "source splits remain as-is" requirements stated in functional requirements, not only in Edge Cases? [Clarity, Spec §Edge Cases]

## Requirement Consistency

- [ ] CHK011 Do User Story 2 and FR-006 align on "add category" requiring reallocation from existing splits? [Consistency, Spec §US2, §FR-006]
- [ ] CHK012 Are validation rules in the UI contract (split-modal-ui.md) consistent with data-model validation rules? [Consistency, contracts/split-modal-ui.md, data-model]
- [ ] CHK013 Does the spec's "source side may need offsetting adjustment" (Edge Cases) conflict with research.md's "source splits remain unchanged"? [Consistency, Spec §Edge Cases, research.md]

## Acceptance Criteria Quality

- [ ] CHK014 Can "100% of saved multi-split transactions remain balanced" (SC-002) be objectively verified without implementation access? [Measurability, Spec §SC-002]
- [ ] CHK015 Are acceptance scenarios for User Story 2 sufficient when "reducing one existing split" is the mechanism—is that the only supported flow? [Acceptance Criteria, Spec §US2]
- [ ] CHK016 Is "no data corruption" in SC-002 defined (e.g., GnuCash file opens, balances reconcile)? [Measurability, Spec §SC-002]

## Scenario Coverage

- [ ] CHK017 Are exception flow requirements defined for save failure (network/backend error) during multi-split persist? [Coverage, Gap]
- [ ] CHK018 Are requirements specified for the "remove split" flow when it would leave zero categorizable splits (FR-006 says prevent—is UI behavior specified)? [Coverage, Spec §FR-006]
- [ ] CHK019 Are concurrent edit scenarios addressed (user has Split modal open while another tab modifies the same transaction)? [Coverage, Gap]
- [ ] CHK020 Are requirements defined for the transition from single-split to multi-split staging when both apply to the same transaction? [Coverage, Spec §FR-008]

## Edge Case Coverage

- [ ] CHK021 Is the "remove all categorizable splits" scenario resolved—prevent vs handle as deletion/void—with explicit requirement? [Edge Case, Spec §Edge Cases]
- [ ] CHK022 Are requirements specified for transactions with multiple source-side splits (e.g., split payment across cards)? [Edge Case, Spec §Edge Cases]
- [ ] CHK023 Is behavior defined when the original categorizable total is zero or negative (income vs expense)? [Edge Case, Gap]
- [ ] CHK024 Are duplicate category requirements addressed (user adds two lines with same accountId)? [Edge Case, Gap]

## Non-Functional Requirements

- [ ] CHK025 Is "under 2 seconds" (plan Performance Goals) traceable to a spec success criterion or NFR? [Traceability, plan.md, Spec]
- [ ] CHK026 Are accessibility requirements (keyboard navigation, screen reader) specified for the Split modal? [Coverage, Gap]
- [ ] CHK027 Is "no perceptible lag when editing 2–10 splits" (plan) quantified or left as subjective? [Clarity, plan.md]

## Dependencies & Assumptions

- [ ] CHK028 Is the assumption "users understand that splitting allocates total across categories" validated or documented as training/help need? [Assumption, Spec §Assumptions]
- [ ] CHK029 Are dependencies on existing `updateTransaction` API and serializer documented for implementers? [Dependency, plan.md]
- [ ] CHK030 Is the change-log behavior for multi-split edits (added/removed splits) explicitly scoped or deferred? [Assumption, research.md]

## Notes

- Check items off as completed: `[x]`
- Add comments or findings inline
- Items with `[Gap]` indicate potential missing requirements
- Traceability: `Spec §X` = spec section; `data-model`, `contracts/`, `plan.md`, `research.md` = design docs
