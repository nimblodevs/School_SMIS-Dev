# Students Module

## Purpose
The students module manages student records, enrollment, profile data, and bulk admission flows for a school.

## Responsibilities
- Maintain student profiles and enrollment status
- Support student lookup, updates, and relationships
- Handle parental linkage and guardianship data
- Process admission uploads and bulk student registration

## Database models owned
- `Student`
- `Enrollment`
- `StudentParent`

## API endpoints
- Student create, retrieve, and update routes
- Parent linkage and designation routes
- Bulk import and batch admission flows
- Enrollment and school-assignment operations

## Authorization requirements
- Authenticated users only
- Module access and role rules apply to mutations and reads
- School-scoped enforcement is required for all student interactions
- Parent-access flows should be constrained to the parent’s own linked student records

## Transactions
- Student creation and initial enrollment should be atomic
- Bulk imports should validate and commit rows as one logical admission batch
- Parent linking should be transactional to avoid broken relationships

## Events
- Student created
- Enrollment activated or updated
- Bulk admission processed
- Parent linkage changed

## External integrations
- CSV/XLSX admission import tooling
- Parent and guardian notification systems
- Academic and attendance data feeds
