# Storage Module

## Purpose
The storage module manages uploaded files, related-document access, and file lifecycle operations for school records such as student documents, report cards, and payslips.

## Responsibilities
- Store file metadata and object references
- Validate upload dimensions, formats, and related entity scoping
- Control file retrieval through signed URLs
- Link uploaded content to a school-owned entity

## Database models owned
- `FileUpload`

## API endpoints
- Upload and metadata creation flows
- Entity-based file listing and retrieval
- Signed URL generation for stored documents

## Authorization requirements
- Authenticated users only
- Access to files must be validated against the relevant related entity and school
- Payslip and report-card access should require ownership or admin-level authorization

## Transactions
- File metadata creation and related entity validation should be atomic
- Background processing for image or document transformations should be tracked without corrupting upload state

## Events
- File uploaded
- File processed
- File accessed or downloaded
- Related entity document generation produced

## External integrations
- Object storage providers such as R2/S3-compatible services
- PDF generation and document processing workers
- Notification or reporting pipelines tied to uploaded artifacts
