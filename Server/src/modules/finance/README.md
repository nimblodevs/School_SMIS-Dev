# Finance Module

## Purpose
The finance module manages fees, payments, allocation, ledger entries, refunds, and financial reconciliation within a school.

## Key models
- `FeeStructure`
- `Invoice`
- `Payment`
- `PaymentAllocation`
- `CreditNote`
- `CreditNoteApplication`
- `PaymentRefund`
- `LedgerEntry`
- `IdempotencyKey`

## Responsibilities
- Create school fee structures and invoices
- Record payments and allocate funds against invoices
- Support refunds, reversals, and credit note applications
- Maintain accounting ledger entries and reconciliation records

## Authorization
- Finance reads and mutations should use explicit permissions such as `fees:read`, `fees:refund`, and `fees:approve`
- Approval should be distinct from simple payment or invoicing actions
- Tenant scope and ownership checks must be enforced before any financial mutation

## Security
- Refund and settlement workflows must be atomic and auditable
- Retry-safe operations should rely on idempotency keys rather than duplicate processing
