# Research: Split Modal Debit/Credit Differentiation

**Feature**: 002-split-modal-debit-credit  
**Date**: 2025-03-03

## 1. Register-Style Layout for Split Modal

**Decision**: Use two separate columns—Debit and Credit—per split line. Each line displays its amount in exactly one column (the other is empty). Debit column shows amounts where `value < 0`; Credit column shows amounts where `value > 0`.

**Rationale**: Matches the Register component's layout and user expectation. In double-entry, each split has a sign: negative = debit (money out), positive = credit (money in). The Register uses `getColumnLabels` with left/right columns; we apply the same pattern.

**Alternatives considered**:
- Single column with +/− prefix: Rejected; spec requires separate columns.
- Inline sign in one column: Rejected; spec requires Register-style layout.

---

## 2. Color Convention: Red for Debits, Green for Credits

**Decision**: Debit amounts use `text-red-400` (or equivalent red); Credit amounts use `text-emerald-400` (or equivalent green). Align with Register's `leftColor`/`rightColor` from `getColumnLabels` (e.g., default: `text-red-400` for Withdrawal, `text-emerald-400` for Deposit).

**Rationale**: Spec explicitly requires red for debits, green for credits. The Register already uses red/green for debit/credit; consistency across the app.

**Alternatives considered**:
- Orange for debits (current SplitModal): Rejected; spec requires red.
- Custom palette: Rejected; use Tailwind classes for consistency.

---

## 3. Amount Input Placement in Debit vs Credit Column

**Decision**: When the user edits an amount, the input appears in the Debit or Credit column based on the sign of the value. For new lines (value 0), default to Credit column for expense flows (positive categorizable total). User can type a negative to move to Debit column, or we keep a single editable cell that updates the column based on sign.

**Rationale**: The current modal has one amount input per line. To support two columns, we either: (a) two inputs per line (user fills one), or (b) one input that renders in the correct column. Option (b) is simpler and matches "each line has either debit or credit." The input's position and color reflect the sign.

**Alternatives considered**:
- Two inputs per line (Debit input | Credit input): Possible but redundant; user would only use one. Single input in the active column is cleaner.
- Toggle to switch debit/credit: Adds complexity; sign of value is sufficient.
