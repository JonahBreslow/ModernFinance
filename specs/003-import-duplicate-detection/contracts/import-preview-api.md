# Contract: Import Preview API

**Feature**: 003-import-duplicate-detection  
**Endpoint**: `POST /api/import/preview`

## Request

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | File | Yes | Multipart file (QFX, OFX, CSV, XLSX) |
| `targetAccountId` | string | No | Target account for import; used for same-account duplicate detection |
| `offsetAccountId` | string | No | **NEW** — Offset/balance account (e.g., checking when importing credit card). Enables cross-account transfer duplicate detection. |
| `mapping` | JSON string | No | CSV column mapping (when re-parsing after mapping step) |
| `headerRowIdx` | string | No | Header row index for CSV |

## Response (success, no mapping needed)

```json
{
  "needsMapping": false,
  "format": "qfx" | "csv" | "xlsx",
  "suggestedAccountHint": string | null,
  "headers": string[],
  "headerRowIdx": number,
  "rows": Array<{
    "fitId": string | null,
    "date": string,
    "description": string,
    "amount": number,
    "memo": string | null,
    "isDuplicate": boolean
  }>
}
```

## Duplicate Detection Behavior

1. **FITID match** (unchanged): If `row.fitId` normalised matches any split's `onlineId` in the store → `isDuplicate = true`
2. **Fuzzy same-account match** (unchanged): If `targetAccountId` provided and `date|abs(amount)|descriptionPrefix` matches a split on target account (with ±1 day) → `isDuplicate = true`
3. **Transfer match** (new): If `offsetAccountId` provided and `date|abs(amount)` (with ±2 day tolerance) matches a split on offset account with **opposite sign** → `isDuplicate = true`

Order: checks run in sequence; first positive result sets duplicate. Transfer match is skipped when `offsetAccountId` is missing or invalid.
