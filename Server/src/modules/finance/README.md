# Finance Module

## Purpose
The finance module manages school fee collection, invoice lifecycle, refunds, credit notes, payment allocation, and financial reconciliation for a tenant school. It coordinates record keeping for fee structures, invoices, payments, refunds, and accounting ledger effects.

## Responsibilities
- Define tuition and fee structures for a school
- Create and maintain invoices and payment records
- Allocate incoming payments to open obligations
- Support refunds, credit notes, and reversals
- Record ledger movements for auditability and reconciliation
- Expose payment-related flows to school administrators and bursars

## Database models owned
- `FeeStructure`
- `Invoice`
- `Payment`
- `PaymentAllocation`
- `CreditNote`
- `CreditNoteApplication`
- `PaymentRefund`
- `IdempotencyKey`
- `LedgerEntry`

## API endpoints
Main routes are mounted by the finance router and are intended for authenticated school users with the `FINANCE` or `REPORTS` module access patterns defined by role checks.

Typical responsibilities include:
- invoice creation and retrieval
- payment intake / checkout flows
- refund and credit note processing
- ledger visibility and settlement queries

## Authorization requirements
- Authenticated users only
- Module access: `FINANCE` and/or related role-based access
- School-scoped operations must use the active tenant context
- Non-admin users should not access other schools’ ledger data

## Transactions
- Payment processing and allocation should be executed in transactional boundaries to ensure ledger/accounting consistency
- Refund and credit-note workflows must be atomic to avoid double-application or partial settlement
- Reconciliation logic should treat invoice state updates and ledger writes as a single unit of work

## Events
- Payment created / settled
- Refund issued
- Credit note created or applied
- Invoice status updated
- Ledger entry recorded
- Idempotency key consumption for retry-safe finance operations

## External integrations
- M-Pesa / payment gateway callbacks and checkout flows
- Email/SMS notification hooks for payment and refund status changes
- Ledger audit reporting or downstream financial sync integrations
