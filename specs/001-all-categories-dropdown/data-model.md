# Data Model: Show All Categories in Recategorize Dropdown

**Branch**: `001-all-categories-dropdown` | **Date**: 2026-03-23

## No Data Model Changes

This feature does not change any data structures. The GnuCash file format, API payloads, and TypeScript types are all unchanged. The fix is purely in presentation-layer filtering logic.

## Existing Entities (for reference)

### Account

Defined in `frontend/src/types/index.ts`.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | GnuCash GUID |
| `name` | `string` | Display name (e.g. "Imbalance-USD") |
| `type` | `AccountType` | GnuCash account type string (EXPENSE, INCOME, BANK, CASH, CREDIT, EQUITY, ROOT, etc.) |
| `parentId` | `string \| null` | Parent account GUID for tree hierarchy |
| `description` | `string` | Optional account description |
| `placeholder` | `boolean` | If true, account is a non-posting folder |
| `hidden` | `boolean` | If true, account is hidden in GnuCash |

**Filter logic change**:
- **Row filtering** (which splits appear as table rows): exclude `ROW_SOURCE_TYPES = {BANK, CASH, CREDIT, ROOT}` and `placeholder`
- **Picker filtering** (which accounts appear in dropdowns): exclude `type === 'ROOT'` and `placeholder` only

### Split

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | GnuCash GUID |
| `accountId` | `string` | References an Account |
| `value` | `number` | Monetary value (positive = debit, negative = credit) |
| `memo` | `string` | Optional per-split note |

### Transaction

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | GnuCash GUID |
| `datePosted` | `string` | ISO date string |
| `description` | `string` | Payee / description |
| `splits` | `Split[]` | All splits (typically 2+) |
