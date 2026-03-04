# Research: Import Duplicate Detection

**Feature**: 003-import-duplicate-detection  
**Date**: 2025-03-03

## Transfer Matching Algorithm

**Decision**: Match import rows to offset-account splits by opposite sign, same absolute amount, and date within ±2 days. Ignore description for transfer matching (descriptions differ across accounts by design).

**Rationale**: Credit card "AUTOMATIC PAYMENT" and checking "Payment to Chase" are the same transfer; amount and date are reliable. Description cannot link them. Date tolerance handles posting-date vs transaction-date mismatches (common with credit cards).

**Alternatives considered**:
- Description similarity: Rejected—descriptions differ too much across accounts.
- Require exact date: Rejected—posting dates often differ by 1–2 days.
- Match by FITID only: Rejected—different accounts use different FITIDs for the same transfer.

---

## Date Tolerance

**Decision**: Use ±2 days as the default for transfer matching. Implement as a backend constant (e.g., `TRANSFER_DATE_TOLERANCE_DAYS = 2`), not user-configurable in the first iteration.

**Rationale**: Spec assumption; covers typical checking→credit-card posting delays. User-configurable tolerance adds UX complexity; can be added later if needed.

**Alternatives considered**:
- ±1 day: Too strict; many valid transfers would be missed.
- ±3 days: Slightly higher false positive risk; 2 days is a reasonable middle ground.
- User setting: Deferred—increases scope; constant is sufficient for MVP.

---

## When No Offset Account

**Decision**: Skip cross-account transfer duplicate detection when `offsetAccountId` is not provided or is empty. Do not fall back to "common payment accounts" or other heuristics.

**Rationale**: Reduces false positives. Without a known offset account, we cannot reliably determine which other-account transactions are the "other side" of a transfer. Spec allows "may use fallback or be skipped"; skipping is safer.

**Alternatives considered**:
- Fallback to BANK/CASH accounts: Rejected—too broad; high false positive risk.
- Infer from target account type: Rejected—complex; e.g., credit card could be paid from multiple checking accounts.

---

## Multiple Matches (Same Amount, Same Date)

**Decision**: If multiple offset splits match an import row (same abs amount, date within tolerance), mark the import row as duplicate on first match. Do not implement "one offset split matches at most one import row" in the first iteration.

**Rationale**: Simplifies implementation. The common case is 1:1 (one payment, one credit). Edge case (two $100 payments, one $100 credit) is rare; success criteria allow up to 5% false positives. Can refine with consumption logic later if needed.

**Alternatives considered**:
- Bijective matching: More accurate but complex; deferred.
- Require unique match: Would reduce recall (fewer duplicates detected); rejected.

---

## Existing Duplicate Detection Order

**Decision**: Run duplicate checks in order: (1) FITID exact match, (2) fuzzy same-account match, (3) transfer match (if offset account provided). First positive result sets `isDuplicate = true`.

**Rationale**: FITID and fuzzy are authoritative for same-account; transfer is additive for cross-account. No change to existing logic; transfer check is an additional fallback.
