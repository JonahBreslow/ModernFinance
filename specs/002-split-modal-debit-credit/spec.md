# Feature Specification: Split Modal Debit/Credit Differentiation

**Feature Branch**: `002-split-modal-debit-credit`  
**Created**: 2025-03-03  
**Status**: Draft  
**Input**: User description: "Add debit/credit differentiation to the Split Transaction modal in Recategorize. Users must be able to visually distinguish debits (money out) from credits (money in) for split transactions like mortgage payments (principal, interest, escrow)."

**Context**: Extends the Split Transaction modal from feature 001-recategorize-multi-split. The modal currently shows all split lines with a single amount column, making it difficult to understand the financial flow for complex transactions.

## Clarifications

### Session 2025-03-03

- Q: What visual convention should the Split modal use for debit/credit differentiation? → A: Separate columns for debits and credits (like a Register), with red for debits and green for credits.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Visually Distinguish Debits from Credits in Split Modal (Priority: P1)

A user splits a mortgage payment transaction (e.g., $6,000 from Checking going to principal, interest, and escrow). When they open the Split modal, they see multiple lines: the source (Checking) and the destinations (House Asset/principal, Interest, Escrow). The user must be able to tell at a glance which amounts represent money going out (debits) and which represent money going in (credits), without mental calculation. The modal presents debits and credits in separate columns (like a Register), with debits in red and credits in green, so the user can verify the split is correct before saving.

**Why this priority**: This is the core value—eliminating confusion when splitting complex transactions like mortgage payments.

**Independent Test**: Open Split modal on a mortgage-payment-style transaction; verify separate Debit and Credit columns (Register-style) with debits in red and credits in green; verify the user can correctly identify which line is the source outflow and which are destination inflows.

**Acceptance Scenarios**:

1. **Given** a split transaction with one source (e.g., Checking) and multiple destinations (principal, interest, escrow), **When** the user opens the Split modal, **Then** debits (money out) and credits (money in) are visually differentiated.
2. **Given** the Split modal is open, **When** the user views each split line, **Then** they can identify whether each amount is a debit or credit without ambiguity.
3. **Given** a transaction with mixed debits and credits, **When** the user edits amounts, **Then** the debit/credit indication updates correctly and remains consistent.

---

### User Story 2 - Consistent Presentation Across Transaction Types (Priority: P2)

Debit/credit differentiation works for both expense flows (e.g., mortgage payment: Checking → principal/interest/escrow) and income flows (e.g., deposit split: Income → Checking + Savings). The same visual convention applies regardless of transaction direction.

**Why this priority**: Ensures the enhancement works for all split scenarios, not just expenses.

**Independent Test**: Open Split modal on an expense split and an income split; verify both use the same debit/credit convention and are easy to interpret.

**Acceptance Scenarios**:

1. **Given** an expense split (money out of source, into categories), **When** the user opens the Split modal, **Then** debits and credits are clearly indicated.
2. **Given** an income split (money from income sources into accounts), **When** the user opens the Split modal, **Then** debits and credits are clearly indicated using the same convention.

---

### Edge Cases

- What happens when the transaction has only categorizable splits (no source shown in modal)? The convention still applies: amounts that reduce the source (outflow) vs. increase destinations (inflow) should be distinguishable.
- How does the system handle transactions where the modal shows both source and categorizable splits? Both sides use the same layout: separate Debit and Credit columns, with debits in red and credits in green.
- What if the user's locale or accounting background uses different conventions (e.g., red for credits in some regions)? The spec assumes a single, consistent convention (red=debit, green=credit); localization can be a future enhancement.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Split modal MUST display separate Debit and Credit columns (Register-style layout) for each split line.
- **FR-002**: Debit amounts MUST be displayed in red; credit amounts MUST be displayed in green.
- **FR-003**: The presentation MUST support complex splits (e.g., mortgage: source + principal + interest + escrow) with multiple debits and/or credits.
- **FR-004**: The debit/credit indication MUST remain consistent when the user edits amounts or adds/removes lines.
- **FR-005**: The implementation MUST be compatible with the existing Split modal (001-recategorize-multi-split); no breaking changes to the save/cancel flow or validation.

### Key Entities

- **Debit**: In the context of the Split modal, an amount representing money going out (e.g., from Checking, reducing a source account).
- **Credit**: In the context of the Split modal, an amount representing money coming in (e.g., to principal, interest, escrow—increasing or reducing destination accounts).
- **Split line**: A row in the Split modal showing: account/category, Debit column (red when populated), Credit column (green when populated), and Remove button.

## Assumptions

- The app uses double-entry bookkeeping; each transaction has debits and credits that sum to zero.
- Users understand basic debit/credit concepts (money out vs. money in) from a cash-flow perspective.
- The visual convention is fixed: separate Debit and Credit columns (Register-style), with red for debits and green for credits.
- The Split modal may show only categorizable splits (current 001 behavior) or both source and categorizable splits; the requirement applies to whatever is displayed.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can correctly identify which amounts are debits and which are credits in the Split modal without referring to external documentation.
- **SC-002**: Users completing a mortgage-payment-style split report reduced confusion compared to the previous single-amount-column design (qualitative feedback).
- **SC-003**: The debit/credit presentation does not increase the time to complete a split by more than 10% (e.g., no extra cognitive load from the new layout).
