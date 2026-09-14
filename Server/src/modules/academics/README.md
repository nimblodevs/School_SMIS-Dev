# Academics Module

## Purpose
The academics module manages curriculum, academic years, terms, class structures, subjects, assessments, and report-card workflows for a school.

## Responsibilities
- Manage academic calendars and term definitions
- Maintain class structures and subject mappings
- Record assessments, competency tracking, and learning progress
- Generate report cards and academic summaries
- Support promotion and curriculum-based evaluation

## Database models owned
- `AcademicYear`
- `Term`
- `ClassLevel`
- `Stream`
- `Subject`
- `TeacherSubject`
- `ClassSubject`
- `LearningArea`
- `Strand`
- `SubStrand`
- `CompetencyAssessment`
- `Exam`
- `ExamResult`
- `Enrollment`

## API endpoints
- Academic year and term management
- Class and stream endpoints
- Subject and class subject routing
- Assessment and result endpoints
- Report card generation and retrieval
- Promotion workflows

## Authorization requirements
- Authenticated users only
- Module access is validated via role-based and module-based permissions
- School-scoped operations must use the active tenant context
- Teacher or staff access must be restricted to their assigned school and relevant academic scope

## Transactions
- Promotion and result updates should be transactional
- Grade and competency writes must be committed as a single unit
- Academic-structure updates should avoid partial state changes

## Events
- Academic year or term opened/closed
- Assessment created
- Exam result published
- Report card generated
- Promotion processed

## External integrations
- Parent/student report-card delivery
- Academic data exports
- Optional downstream learning analytics or SIS integrations
