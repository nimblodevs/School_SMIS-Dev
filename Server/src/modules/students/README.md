# Students Module

## Purpose
The students module manages student profiles, enrollment records, guardianship relationships, and academic progression for a school.

## Key models
- `Student`
- `Parent`
- `StudentParent`
- `Enrollment`

## Responsibilities
- Maintain student identity and active status
- Track academic enrollment by stream and year
- Link parents and determine financial or pickup responsibilities
- Support student lookup, updates, and bulk admission flows

## Authorization
- Use explicit permissions such as `students:read`, `students:create`, and `students:update`
- Parent access should be restricted to their own linked students
- School scope and ownership must be verified before any read or mutation

## Operational notes
- Student creation and the initial enrollment should be atomic
- Bulk import and parent-linking flows should be transactional and auditable
