# UI Contract: Split Transaction Modal

**Feature**: 001-recategorize-multi-split  
**Component**: SplitModal (or equivalent split editor)

## Purpose

Modal/drawer opened from Recategorize when user initiates "Split" on a transaction row. Allows editing the set of categorizable splits (category + amount) with validation that the sum equals the original total.

## Inputs (Props)

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `transaction` | Transaction | Yes | The transaction being split |
| `accounts` | Account[] | Yes | All accounts (for category picker) |
| `categorizableAccounts` | Account[] | Yes | Accounts available as categories (excludes SOURCE_ACCOUNT_TYPES, placeholder) |
| `onSave` | (newSplits: Split[]) => void | Yes | Called with validated new categorizable splits when user confirms |
| `onCancel` | () => void | Yes | Called when user cancels or closes without saving |

## Outputs (Callbacks)

- `onSave(newSplits)`: Caller receives the new categorizable splits. Caller is responsible for merging with source splits and calling `updateTransaction`.
- `onCancel`: No side effects; caller closes modal.

## Validation Rules (enforced by modal)

1. **Sum validation**: Sum of all split `value` in the editor MUST equal the original categorizable total (|diff| < 0.01).
2. **Non-empty**: At least one split line required.
3. **Non-zero amounts**: Each line must have value !== 0.
4. **Valid account**: Each line must have a valid `accountId` from categorizable accounts.

## UI Elements (minimum)

- List of editable rows: [Category picker] [Amount input] [Remove button]
- "Add line" button
- Display of "Total" and "Expected" (original total) with validation state (ok / mismatch)
- "Save" button (disabled when validation fails)
- "Cancel" button

## Error States

- When sum !== expected: Show message "Amounts must sum to $X.XX" (or equivalent); disable Save.
- When zero splits: Disable Save; show "Add at least one category."
