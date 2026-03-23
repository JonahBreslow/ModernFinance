# Research: Show All Categories in Recategorize Dropdown

**Branch**: `001-all-categories-dropdown` | **Date**: 2026-03-23

## Findings

### Decision 1: What to exclude from category pickers

**Decision**: Only exclude `ROOT` account type and `placeholder` accounts from category pickers (all four surfaces: inline cell, filter bar, split modal, bulk action).

**Rationale**: The user needs to select ANY real account as a target, including Imbalance-USD (EQUITY), checking (BANK), savings (CASH), and credit cards (CREDIT). ROOT accounts are structural tree containers with no financial meaning; placeholders are non-posting summaries. All other account types are valid recategorization targets.

**Alternatives considered**:
- Keep BANK/CASH/CREDIT out of picker: Rejected — the spec (FR-001) explicitly requires "all accounts that are not structural ROOT accounts and not marked as placeholders, regardless of account type." Excluding bank accounts from the picker would prevent legitimate use cases (e.g., recording transfers).

---

### Decision 2: What to exclude from row generation (which splits appear as table rows)

**Decision**: Keep `BANK`, `CASH`, and `CREDIT` out of row generation. Remove `EQUITY` so that Imbalance-USD and similar equity-typed splits appear as actionable rows.

**Rationale**: `BANK`, `CASH`, and `CREDIT` represent the funding/source side of every transaction (your checking account debit, credit card charge). Surfacing those splits as rows would produce confusing duplicate entries for every transaction. `EQUITY` however can legitimately be the "interesting" side of a transaction — specifically Imbalance-USD, which GnuCash uses to flag unbalanced imports. The user explicitly wants to correct those rows.

**Alternatives considered**:
- Remove all type restrictions from row generation: Rejected — would expose every BANK/CASH/CREDIT split as a row, making the table noisy and doubling most entries.
- Keep EQUITY excluded: Rejected — this is the root cause of the bug; Imbalance-USD rows never surface.

---

### Decision 3: How to implement the split without breaking merge logic

**Decision**: Introduce two separate named sets in `Recategorize.tsx`:
- `ROW_SOURCE_TYPES = new Set(['BANK', 'CASH', 'CREDIT', 'ROOT'])` — governs which splits are treated as the "source/funding side" for row generation and `getSourceSplits` / `getCategorizableSplits`.
- Category pickers filter only by `type !== 'ROOT' && !placeholder` — no named constant needed, expressed inline.

**Rationale**: The current `SOURCE_ACCOUNT_TYPES` constant conflates two different concerns (what's a funding split vs. what's a valid picker target). Splitting them eliminates the coupling and makes the intent self-documenting. `mergeSplits` relies on `getSourceSplits` to preserve the funding side when saving split-modal changes — it must continue to use `ROW_SOURCE_TYPES` only.

**Alternatives considered**:
- Single constant with different subsets: More fragile, harder to reason about.
- Backend filtering change: Not appropriate — the backend already returns all accounts, the issue is purely in frontend filtering logic.

---

### Affected locations in `frontend/src/components/Recategorize/Recategorize.tsx`

| Location | Current filter | New filter |
|----------|---------------|------------|
| Line 379: `SOURCE_ACCOUNT_TYPES` constant | `BANK, CASH, CREDIT, EQUITY, ROOT` | Rename to `ROW_SOURCE_TYPES = new Set(['BANK', 'CASH', 'CREDIT', 'ROOT'])` |
| Line 382–385: `getCategorizableSplits` | `!SOURCE_ACCOUNT_TYPES.has(type) && !placeholder` | `!ROW_SOURCE_TYPES.has(type) && !placeholder` |
| Line 393–396: `getSourceSplits` | `SOURCE_ACCOUNT_TYPES.has(type)` | `ROW_SOURCE_TYPES.has(type)` |
| Line 454–457: `rows` useMemo (inline) | `!SOURCE_ACCOUNT_TYPES.has(type) && !placeholder` | `!ROW_SOURCE_TYPES.has(type) && !placeholder` |
| Line 469–474: `filterAccounts` useMemo | `!SOURCE_ACCOUNT_TYPES.has(type) && !placeholder` | `type !== 'ROOT' && !placeholder` |
| Line 524–526: `categorizableAccounts` useMemo | `!SOURCE_ACCOUNT_TYPES.has(type) && !placeholder` | `type !== 'ROOT' && !placeholder` |

No backend changes required. No new dependencies required.
