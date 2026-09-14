# CBC Module

## Purpose
The CBC module supports competency-based curriculum assessment and performance tracking aligned with the school’s curriculum framework.

## Responsibilities
- Manage competency assessments for students and strands
- Track student progress against learning areas and standards
- Support term-based competency evaluation and reporting
- Link assessments to student, subject, and academic term context

## Database models owned
- `CompetencyAssessment`
- `LearningArea`
- `Strand`
- `SubStrand`

## API endpoints
- Competency assessment creation and updates
- Learning-area and strand relationship endpoints
- Student competency summaries and queries

## Authorization requirements
- Authenticated users only
- Module access requires relevant academic or teacher permissions
- Reads and writes must be school-scoped and restricted to the student’s school context

## Transactions
- Assessment updates should be transactional where multiple related records are changed in one flow
- Summary calculations should be deterministic and based on committed records only

## Events
- Competency assessment created
- Assessment updated or revised
- Student performance summary generated

## External integrations
- Report-card generation
- Curriculum analytics and dashboard reporting
- Learning progress export pipelines
