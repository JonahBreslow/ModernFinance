# Feature Specification: Recategorize into Multi-Split Transactions

**Feature Branch**: `001-recategorize-multi-split`  
**Created**: 2025-03-03  
**Status**: Draft  
**Input**: User description: "I need to be able to recategorize transactions into multi-split transactions in the Recategorize menu"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Split a Single-Category Transaction into Multiple Categories (Priority: P1)

A user has a transaction that is fully categorized under one expense account (e.g., $100 to "Groceries"). They want to split it so that part goes to one category and part to another (e.g., $60 Groceries, $40 Household Supplies), reflecting a mixed receipt or purchase. From the Recategorize menu, they initiate a "split" action on that transaction, add one or more new category lines with amounts, and save. The original transaction becomes a multi-split transaction with the amounts correctly allocated.

**Why this priority**: This is the core value of the feature—enabling users to accurately reflect real-world mixed purchases without leaving Recategorize.

**Independent Test**: Can be fully tested by selecting a single-split transaction in Recategorize, splitting it into two categories with specified amounts, saving, and verifying the transaction now has multiple expense splits that sum to the original total.

**Acceptance Scenarios**:

1. **Given** a transaction with one categorizable split of $100 to "Groceries", **When** the user splits it into $60 Groceries and $40 Household Supplies and saves, **Then** the transaction has two expense splits totaling $100 and the Register shows it as a split transaction.
2. **Given** a transaction with one categorizable split, **When** the user initiates a split and adds two new category lines with amounts that sum to the original amount, **Then** the system accepts and persists the multi-split transaction.
3. **Given** a transaction with one categorizable split, **When** the user initiates a split but cancels without saving, **Then** the transaction remains unchanged.

---

### User Story 2 - Add a Category to an Existing Multi-Split Transaction (Priority: P2)

A user has a transaction that already has multiple expense splits (e.g., $60 Groceries, $40 Household). They want to add a third category (e.g., $20 Pharmacy) by reallocating from one of the existing splits or adding a new split. From Recategorize, they can add a new split line, specify amount and category, and save. The transaction is updated with the new split, and the counterpart (source) side is adjusted so the transaction remains balanced.

**Why this priority**: Extends the feature to transactions that are already split; common when users realize they missed a category.

**Independent Test**: Can be tested by selecting a multi-split transaction in Recategorize, adding a new category line with amount and category, saving, and verifying the transaction has the new split and remains balanced.

**Acceptance Scenarios**:

1. **Given** a multi-split transaction with $60 Groceries and $40 Household, **When** the user adds a new split of $20 Pharmacy (reducing one existing split by $20), **Then** the transaction has three expense splits and remains balanced.
2. **Given** a multi-split transaction, **When** the user adds a new category line and saves, **Then** the transaction reflects the new split and all splits sum correctly with the source account.

---

### User Story 3 - Reallocate Amounts Between Splits in a Multi-Split Transaction (Priority: P3)

A user has a multi-split transaction and wants to change how the amount is distributed (e.g., move $10 from Groceries to Household). From Recategorize, they can edit the amount on one or more split lines and save. The transaction is updated with the new allocation.

**Why this priority**: Refinement workflow; users often need to correct allocations after initial split.

**Independent Test**: Can be tested by editing the amount of one split in a multi-split transaction in Recategorize, saving, and verifying the new amounts persist and the transaction remains balanced.

**Acceptance Scenarios**:

1. **Given** a multi-split transaction with $60 Groceries and $40 Household, **When** the user changes Groceries to $50 and Household to $50, **Then** the transaction reflects the new amounts and remains balanced.
2. **Given** a multi-split transaction, **When** the user edits amounts such that the total does not match the source side, **Then** the system prevents save and surfaces a clear error (e.g., "Amounts must sum to [total]").

---

### Edge Cases

- What happens when the user enters amounts that do not sum to the transaction total? The system must prevent save and show a clear validation message.
- What happens when the user removes all categorizable splits (leaving only the source account)? The system must prevent this or handle it as a deletion/void scenario.
- How does the system handle transactions with a single source split (e.g., bank) and one expense split? Splitting creates additional expense splits; the source side may need an offsetting adjustment (e.g., imbalance account or single source split) to keep the transaction balanced.
- What happens when the user splits a transaction that has multiple source-side splits (e.g., payment split across two credit cards)? The feature assumes standard double-entry: one or more source splits and one or more expense/income splits. Reallocation applies to the categorizable (expense/income) side; source splits remain as-is unless the feature explicitly supports reallocating source-side amounts.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow users to split a single categorizable split into multiple splits, each with a category and amount, from the Recategorize menu.
- **FR-002**: System MUST validate that the sum of all categorizable split amounts equals the transaction total (or the categorizable portion) before allowing save.
- **FR-003**: Users MUST be able to add new category lines (splits) when splitting a transaction, specifying both category and amount for each line.
- **FR-004**: System MUST persist multi-split transactions such that the transaction remains balanced (debits equal credits) after save.
- **FR-005**: System MUST allow users to edit amounts on existing splits within a multi-split transaction from Recategorize, with validation that the total remains correct.
- **FR-006**: System MUST allow users to remove a split from a multi-split transaction (reallocating its amount to other splits) from Recategorize, with validation that at least one categorizable split remains.
- **FR-007**: System MUST surface clear validation errors when amounts do not sum correctly (e.g., "Amounts must sum to $X.XX").
- **FR-008**: System MUST support the existing Recategorize workflow (single-split recategorization) alongside the new multi-split workflow; both must coexist.

### Key Entities

- **Transaction**: A double-entry transaction with one or more splits. Has a total amount implied by the source-side splits.
- **Split**: A line in a transaction with an account, amount (value), and optional memo. Categorizable splits are those on expense/income accounts.
- **Categorizable split**: A split whose account is an expense or income account (not a source account such as Bank, Cash, Credit, Equity).
- **Multi-split transaction**: A transaction with two or more categorizable splits (expense/income side).

## Assumptions

- The app uses double-entry bookkeeping; transactions have source-side splits (e.g., Bank) and categorizable splits (e.g., Expense). Splitting a categorizable split requires adding new expense/income splits and adjusting the source side (or using an imbalance account) to keep the transaction balanced.
- Users understand that splitting a transaction allocates the total across categories; the sum of new splits must equal the original categorizable total.
- The Recategorize menu continues to show one row per categorizable split; the split workflow may be initiated from a row (e.g., "Split" action) or from a transaction-level control.
- The existing single-split recategorization (change category of one split) remains unchanged and is the default behavior when the user selects a new category without splitting.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can split a single-category transaction into multiple categories in under 60 seconds from the Recategorize menu.
- **SC-002**: 100% of saved multi-split transactions remain balanced (debits equal credits) with no data corruption.
- **SC-003**: Users receive clear, actionable feedback when amount validation fails (e.g., sum mismatch), with no silent failures.
- **SC-004**: The feature supports splitting into at least 2 and up to 10 categories per transaction without performance degradation.
