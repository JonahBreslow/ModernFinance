# API Contract: Transactions (existing, no change)

**Feature**: 001-recategorize-multi-split  
**Note**: Backend API is unchanged. This document records the contract for implementation reference.

## PUT /api/transactions/:id

**Request**: `Partial<Transaction>` in JSON body. Commonly sent fields:
- `splits`: Split[] — full replacement of transaction splits

**Response**: Updated Transaction object.

**Behavior**: Merges request body with existing transaction; replaces `splits` entirely if provided. Persists to GnuCash file via serializer; writes change log.

**Preconditions** (enforced by caller):
- Sum of `split.value` across all splits = 0 (double-entry balance)
- All `split.accountId` reference existing accounts
- Split `id` values are valid GUIDs (32-char hex)

**Used by**: Recategorize `saveChanges()`; will be used by multi-split save with rebuilt splits.
