# Exams Module

## Purpose
The exams module manages exam definitions, exam results, and student score recording for a school’s academic cycle.

## Responsibilities
- Create and maintain exam records
- Record and validate exam results
- Enforce school and academic-term boundaries for score entries
- Provide exam-level summaries and result retrieval

## Database models owned
- `Exam`
- `ExamResult`

## API endpoints
- Exam definition CRUD routes
- Result creation and retrieval routes
- Score validation and summary endpoints

## Authorization requirements
- Authenticated users only
- Academic or admin module rights required
- School-scoped rules must apply for all exam and result reads/writes

## Transactions
- Result submission should be atomic to prevent partial score writes
- Batch result updates should be committed as a single unit when possible

## Events
- Exam created
- Result entered or updated
- Subject performance summary published

## External integrations
- Report-card generation
- Parent/student result notifications
- Progress analytics or SIS export systems
