# Feature Specification: Improved Import Duplicate Detection

**Feature Branch**: `003-import-duplicate-detection`  
**Created**: 2025-03-03  
**Status**: Draft  
**Input**: User description: "When importing transactions, I need better duplicate detection logic. For example, the automatic payment transaction in this screenshot was already imported from the checking account transaction that paid for this credit card bill."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Detect Cross-Account Transfer Duplicates (Priority: P1)

When importing credit card transactions, the system should recognize that an "automatic payment" (or similar credit) on the credit card is the mirror of a payment transaction already imported from the checking account. Such transactions should be flagged as duplicates and deselected by default, preventing double-entry of the same real-world transfer.

**Why this priority**: This is the primary pain point—users repeatedly see payment transactions marked for import even though they already recorded the payment from the other account.

**Independent Test**: Import checking account first (payment out), then import credit card file. The credit card "automatic payment" row should be flagged as duplicate and not selected for import.

**Acceptance Scenarios**:

1. **Given** a payment transaction was imported from a checking account (e.g., "Payment to Chase -$166.84"), **When** the user imports the credit card file containing the corresponding credit ("AUTOMATIC PAYMENT - THANK +$166.84"), **Then** the credit card row is marked as duplicate and deselected.
2. **Given** the user selects a target account (credit card) and an offset/balance account (checking) for the import, **When** duplicate detection runs, **Then** the system considers transactions in the offset account when determining duplicates for the target account.
3. **Given** same amount (opposite sign) and same or nearby date between an imported checking payment and a credit card credit, **When** descriptions differ (e.g., "Payment to Chase" vs "AUTOMATIC PAYMENT - THANK"), **Then** the credit card row is still flagged as duplicate when the match criteria are met.

---

### User Story 2 - Preserve Existing Duplicate Detection (Priority: P1)

Existing duplicate detection (exact FITID match, fuzzy date/amount/description match within the same account) must continue to work. No regression in current behavior.

**Why this priority**: Users rely on current duplicate detection for same-account duplicates; this must not break.

**Independent Test**: Import the same file twice; all rows should be duplicates on the second import. Import a file with transactions already in the target account; those rows should be flagged.

**Acceptance Scenarios**:

1. **Given** a transaction already exists in the target account with the same date, amount, and description, **When** the user imports a file containing that transaction, **Then** it is marked as duplicate.
2. **Given** a QFX/OFX row has a FITID matching an existing split's onlineId, **When** duplicate detection runs, **Then** the row is marked as duplicate regardless of other criteria.

---

### User Story 3 - Configurable Transfer Matching (Priority: P2)

Users can influence which accounts are used for cross-account duplicate detection (e.g., the offset/balance account shown in the import UI). When the offset account is known, use it to improve transfer duplicate detection.

**Why this priority**: Reduces false positives by only considering relevant "other side" accounts.

**Independent Test**: Import credit card with offset = checking; payment duplicate is detected. Change offset to a different account; behavior adjusts accordingly.

**Acceptance Scenarios**:

1. **Given** the user has selected a target account and an offset/balance account in the import UI, **When** duplicate detection runs, **Then** the system uses the offset account as the primary source for cross-account transfer matching.
2. **Given** no offset account is selected (or "auto-detected" yields none), **When** duplicate detection runs, **Then** cross-account matching may use a fallback (e.g., common payment accounts) or be skipped to avoid false positives.

---

### Edge Cases

- What happens when the same amount appears on the same date in both accounts but for different reasons (e.g., two separate $100 payments)? Use description similarity or require additional signals to avoid false positives.
- How does the system handle date mismatches? Payment may post on checking on 02/28 and appear on credit card on 03/01. Extend date tolerance (e.g., ±2–3 days) for transfer matching.
- What if the offset account is a credit card and the target is checking (reverse flow)? Support both directions: payment from checking → credit on card, and payment from card → credit on checking.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST detect as duplicates transactions that are the mirror (opposite sign, same absolute amount) of an already-imported transaction in a related account (e.g., offset/balance account) when date and amount match within tolerance.
- **FR-002**: System MUST use the offset/balance account selected in the import UI (or auto-detected) when performing cross-account transfer duplicate detection.
- **FR-003**: System MUST preserve existing duplicate detection: exact FITID/onlineId match and fuzzy date/amount/description match within the target account.
- **FR-004**: System MUST allow configurable date tolerance for transfer matching (e.g., ±1 to ±3 days) to handle posting-date vs transaction-date differences between accounts.
- **FR-005**: System MUST NOT mark as duplicate when the same amount and date appear in both accounts but descriptions strongly suggest different transactions (e.g., two distinct payments); use description similarity or heuristics to reduce false positives where feasible.
- **FR-006**: System MUST support transfer matching in both directions: target account receives credit and offset has debit, or target receives debit and offset has credit.

### Key Entities

- **Import Row**: A parsed transaction from the import file (date, description, amount, fitId). The amount sign indicates debit (negative) or credit (positive) relative to the target account.
- **Existing Transaction**: A transaction already in the ledger, with splits that may reference the target account or the offset account.
- **Transfer Pair**: Two transactions (one in target, one in offset) that represent the same real-world transfer—same absolute amount, opposite signs, dates within tolerance.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: When importing a credit card file after the corresponding checking payment has been imported, at least 90% of payment/credit rows that mirror the checking payment are correctly flagged as duplicates.
- **SC-002**: No regression: existing same-account duplicate detection (FITID and fuzzy) continues to flag duplicates with 100% accuracy for previously working cases.
- **SC-003**: Users can complete an import without manually deselecting known transfer duplicates in typical payment scenarios (checking → credit card).
- **SC-004**: False positive rate for transfer duplicate detection remains below 5% (legitimate new transactions incorrectly marked as duplicate).

## Clarifications

### Session 2025-03-03

- User confirmed: all assumptions in the spec are valid.

## Assumptions

- The offset/balance account is either user-selected or auto-detected and is available at import preview time.
- Credit card "automatic payment" and checking "payment to [issuer]" are the same logical transfer; descriptions will differ but amount and date are reliable signals.
- Date tolerance of ±2 days is a reasonable default for transfer matching; this can be tuned.
- The current fuzzy key uses `date|abs(amount)|descriptionPrefix`; for transfer matching, we intentionally ignore description (or use it only to reduce false positives) because descriptions differ across accounts.
