# Feature Specification: Show All Categories in Recategorize Dropdown

**Feature Branch**: `001-all-categories-dropdown`  
**Created**: 2026-03-23  
**Status**: Draft  
**Input**: User description: "When I navigate to the 'Recategorize' tab in my Modern Finance app, I need to be able to see ALL categories in the categories drop down. For example, right now I cannot recategorize transactions in 'Imbalance-USD' from this tool."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Recategorize to Any Account (Priority: P1)

A user has transactions incorrectly assigned to a special account such as "Imbalance-USD". When they open the Recategorize tab and click to change the category of one of those transactions, they expect the dropdown to include every account in their financial data — including accounts currently excluded because of their account type (e.g. EQUITY accounts like Imbalance-USD). The user should be able to select any account as the new category, not just a subset.

**Why this priority**: This is the core reported problem. Without this, the user has no way to correct transactions assigned to excluded account types using the Recategorize tool.

**Independent Test**: Navigate to the Recategorize tab, find a transaction assigned to "Imbalance-USD" (or any EQUITY/BANK/CASH/CREDIT account), click the category cell — the dropdown must include all non-root, non-placeholder accounts.

**Acceptance Scenarios**:

1. **Given** the Recategorize tab is open with transactions that have splits assigned to an EQUITY account (e.g. Imbalance-USD), **When** the user clicks the category dropdown for any transaction row, **Then** the dropdown includes all accounts that are not the structural ROOT or explicit placeholders.
2. **Given** a user selects "Imbalance-USD" from the category dropdown, **When** they confirm the recategorization, **Then** the transaction split is saved with the Imbalance-USD account, and the change persists.
3. **Given** a transaction row is assigned to a currently-excluded account type (BANK, CASH, CREDIT, EQUITY), **When** the user views that row in the Recategorize tab, **Then** the row is visible and the category cell reflects the actual assigned account.

---

### User Story 2 - Filter Bar Shows All Categories (Priority: P2)

When using the "All categories" filter bar at the top of the Recategorize tab to narrow displayed transactions, the user wants all account categories to appear as filter options — not just INCOME/EXPENSE types.

**Why this priority**: Consistency with Story 1; the filter dropdown should reflect the same expanded account list so users can find and work with transactions from any account type.

**Independent Test**: Open the Recategorize tab filter, expand the category picker — it should list all non-root, non-placeholder accounts including Imbalance-USD and any BANK/CASH/CREDIT/EQUITY accounts.

**Acceptance Scenarios**:

1. **Given** the Recategorize tab filter dropdown is opened, **When** the user searches for "Imbalance", **Then** Imbalance-USD appears as a selectable filter option.
2. **Given** a filter is applied for a previously-excluded account type, **When** the transaction list renders, **Then** only transactions with splits assigned to that account are shown.

---

### Edge Cases

- What happens when a file has no EQUITY/BANK/CASH/CREDIT accounts — the dropdown should still render correctly with only the accounts that exist.
- What happens when an account is both non-placeholder and of a type that was previously excluded — it should appear in the dropdown with no errors.
- How does the system handle selecting a ROOT account as a target category — ROOT accounts should remain excluded as they are structural containers, not real categories.
- What happens to the bulk "Recategorize all to…" action when the expanded list includes the current source account — the tool should allow the operation and handle it gracefully.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Recategorize tab category dropdown MUST include all accounts that are not structural ROOT accounts and not marked as placeholders, regardless of account type.
- **FR-002**: The category filter bar on the Recategorize tab MUST offer all non-ROOT, non-placeholder accounts as filter options, including accounts of type EQUITY, BANK, CASH, and CREDIT.
- **FR-003**: The Split Modal category picker MUST include all non-ROOT, non-placeholder accounts as selectable targets.
- **FR-004**: The bulk "Recategorize all to…" action MUST allow any non-ROOT, non-placeholder account as the target.
- **FR-005**: Transaction rows in the Recategorize tab MUST remain visible when the assigned account type was previously excluded (e.g. a split pointing to an EQUITY account should appear as a row the user can act on).
- **FR-006**: The expanded category list MUST continue to display accounts in alphabetical/hierarchical path order for usability.

### Key Entities

- **Account**: Represents a financial account or category in GnuCash data. Has a type (e.g. EXPENSE, INCOME, EQUITY, BANK, CASH, CREDIT, ROOT), a placeholder flag, and a name. The ROOT type is a structural container with no financial meaning.
- **Split**: A line item within a transaction, linking an amount to an account. Changing the category of a split means pointing it to a different account.
- **Transaction**: A financial event made up of two or more splits. Displayed as a row in the Recategorize tab.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of non-ROOT, non-placeholder accounts in the loaded financial file appear as options in the Recategorize category dropdown.
- **SC-002**: Users can successfully recategorize a transaction currently assigned to "Imbalance-USD" (or any previously-excluded account type) in 3 clicks or fewer.
- **SC-003**: No regressions — existing recategorization flows for EXPENSE and INCOME accounts continue to work correctly after the change.
- **SC-004**: The category dropdown loads and renders all accounts within the same response time as before the change (no perceptible slowdown).
