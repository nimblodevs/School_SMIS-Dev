import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { prisma } from '../src/config/prisma.js';

const IDS = {
    school: '11111111-1111-4111-8111-111111111111',
    secondSchool: '11111111-1111-4111-8111-111111111112',
    superAdmin: '22222222-2222-4222-8222-222222222222',
    admin: '33333333-3333-4333-8333-333333333333',
    secondAdmin: '33333333-3333-4333-8333-333333333334',
    teacherUser: '44444444-4444-4444-8444-444444444444',
    teacher: '55555555-5555-4555-8555-555555555555',
    staffUser: '66666666-6666-4666-8666-666666666666',
    staff: '77777777-7777-4777-8777-777777777777',
    parentUser: '88888888-8888-4888-8888-888888888888',
    parent: '99999999-9999-4999-8999-999999999999',
    studentUser: 'aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    student: 'bbbbbbb2-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
    secondParent: '99999999-9999-4999-8999-999999999998',
    secondStudent: 'bbbbbbb2-bbbb-4bbb-8bbb-bbbbbbbbbbb3',
};

const PASSWORDS = {
    superAdmin: 'SuperAdmin123!',
    admin: 'AdminDemo123!',
    teacher: 'TeacherDemo123!',
    staff: 'StaffDemo123!',
    parent: 'ParentDemo123!',
    student: 'StudentDemo123!',
};

async function seedAllocatedPayment({ schoolId, invoice, student, recordedById, amount, receipt, phone, paidAt }) {
    const paymentAmount = new Prisma.Decimal(amount);
    return prisma.$transaction(async (tx) => {
        const payment = await tx.payment.upsert({
            where: { mpesaReceipt: receipt },
            update: {
                schoolId,
                invoiceId: invoice.id,
                studentId: student.id,
                amount: paymentAmount,
                method: 'MPESA',
                status: 'COMPLETED',
                mpesaPhone: phone,
                reference: `PAY-${student.admissionNo}`,
                recordedById,
                requiresAllocation: false,
                allocatedAt: paidAt,
                paidAt,
            },
            create: {
                schoolId,
                invoiceId: invoice.id,
                studentId: student.id,
                amount: paymentAmount,
                method: 'MPESA',
                status: 'COMPLETED',
                mpesaReceipt: receipt,
                mpesaPhone: phone,
                reference: `PAY-${student.admissionNo}`,
                recordedById,
                requiresAllocation: false,
                allocatedAt: paidAt,
                paidAt,
            },
        });

        await tx.paymentAllocation.deleteMany({
            where: { paymentId: payment.id, invoiceId: { not: invoice.id } },
        });

        await tx.paymentAllocation.upsert({
            where: {
                paymentId_invoiceId: { paymentId: payment.id, invoiceId: invoice.id },
            },
            update: {
                schoolId,
                amount: paymentAmount,
                invoiceBalanceBefore: invoice.amountDue,
                invoiceBalanceAfter: invoice.amountDue.minus(paymentAmount),
                status: 'ACTIVE',
                reversedAt: null,
                reversedBy: null,
                reversalReason: null,
                createdById: recordedById,
            },
            create: {
                schoolId,
                paymentId: payment.id,
                invoiceId: invoice.id,
                amount: paymentAmount,
                invoiceBalanceBefore: invoice.amountDue,
                invoiceBalanceAfter: invoice.amountDue.minus(paymentAmount),
                createdById: recordedById,
            },
        });

        await tx.invoice.update({
            where: { id: invoice.id },
            data: {
                amountPaid: paymentAmount,
                status: paymentAmount.gte(invoice.amountDue) ? 'PAID' : 'PARTIALLY_PAID',
            },
        });

        const ledgerReference = `Payment:${payment.id}`;
        await tx.ledgerEntry.deleteMany({
            where: { schoolId, reference: ledgerReference },
        });
        await tx.ledgerEntry.createMany({
            data: [
                {
                    schoolId,
                    accountCode: '1010-MPESA',
                    direction: 'DEBIT',
                    amount: paymentAmount,
                    reference: ledgerReference,
                    narration: 'Seeded fee payment (MPESA)',
                    entryDate: paidAt,
                },
                {
                    schoolId,
                    accountCode: '4000-FEE-REVENUE',
                    direction: 'CREDIT',
                    amount: paymentAmount,
                    reference: ledgerReference,
                    narration: 'Seeded fee payment (MPESA)',
                    entryDate: paidAt,
                },
            ],
        });

        return payment;
    });
}

async function main() {
    const passwordHashes = Object.fromEntries(await Promise.all(Object.entries(PASSWORDS).map(async ([key, value]) => [key, await bcrypt.hash(value, 12)])));

    const school = await prisma.school.upsert({
        where: { slug: 'demo-school' },
        update: {
            name: 'DEMO SCHOOL',
            schoolCode: '12345',
            nextTeacherSequence: 1,
            nextStaffSequence: 1,
            isActive: true,
            motto: 'Learning for Life',
            vision: 'A leading school for lifelong learning',
            mission: 'To develop capable and responsible citizens',
            address: '1 Education Lane',
            city: 'Nairobi',
            county: 'Nairobi',
            postalCode: '00100',
            phone: '+254700000000',
            email: 'info@demo.school',
            website: 'https://demo.school',
        },
        create: {
            id: IDS.school,
            name: 'DEMO SCHOOL',
            slug: 'demo-school',
            schoolCode: '12345',
            nextTeacherSequence: 1,
            nextStaffSequence: 1,
            isActive: true,
            motto: 'Learning for Life',
            vision: 'A leading school for lifelong learning',
            mission: 'To develop capable and responsible citizens',
            address: '1 Education Lane',
            city: 'Nairobi',
            county: 'Nairobi',
            postalCode: '00100',
            phone: '+254700000000',
            email: 'info@demo.school',
            website: 'https://demo.school',
        },
    });
    await prisma.schoolSettings.upsert({
        where: { schoolId: school.id },
        update: { mpesaShortcode: '412345', mpesaEnabled: false },
        create: {
            schoolId: school.id,
            mpesaShortcode: '412345',
            mpesaEnabled: false,
        },
    });
    const jobGroup = await prisma.jobGroup.upsert({
        where: { schoolId_code: { schoolId: school.id, code: 'DEMO-JG' } },
        update: {
            name: 'Demo Staff',
            description: 'Default demo-school job group',
            isActive: true,
        },
        create: {
            schoolId: school.id,
            name: 'Demo Staff',
            code: 'DEMO-JG',
            description: 'Default demo-school job group',
        },
    });

    await prisma.user.upsert({
        where: { username: 'superadmin' },
        update: {
            email: 'superadmin@demo.school',
            phone: '+254700000000',
            passwordHash: passwordHashes.superAdmin,
            role: 'SUPER_ADMIN',
            isActive: true,
            mustChangePassword: false,
            schoolId: null,
        },
        create: {
            id: IDS.superAdmin,
            username: 'superadmin',
            email: 'superadmin@demo.school',
            phone: '+254700000000',
            passwordHash: passwordHashes.superAdmin,
            role: 'SUPER_ADMIN',
            mustChangePassword: false,
        },
    });

    const admin = await prisma.user.upsert({
        where: { username: 'admin' },
        update: {
            email: 'admin@demo.school',
            phone: '+254700000004',
            passwordHash: passwordHashes.admin,
            role: 'ADMIN',
            schoolId: school.id,
            isActive: true,
            mustChangePassword: false,
        },
        create: {
            id: IDS.admin,
            username: 'admin',
            email: 'admin@demo.school',
            phone: '+254700000004',
            passwordHash: passwordHashes.admin,
            role: 'ADMIN',
            schoolId: school.id,
            mustChangePassword: false,
        },
    });

    const teacherOwnerKey = `T:${IDS.teacher}`;
    const teacherEmployeeNo = 'T123450001';
    await prisma.employeeNumber.upsert({
        where: { ownerKey: teacherOwnerKey },
        update: { schoolId: school.id, employeeNo: teacherEmployeeNo },
        create: {
            schoolId: school.id,
            employeeNo: teacherEmployeeNo,
            ownerKey: teacherOwnerKey,
        },
    });
    const teacherUser = await prisma.user.upsert({
        where: { username: 'jane.teacher' },
        update: {
            email: 'jane.teacher@demo.school',
            phone: '+254700000002',
            passwordHash: passwordHashes.teacher,
            role: 'TEACHER',
            schoolId: school.id,
            isActive: true,
            mustChangePassword: false,
        },
        create: {
            id: IDS.teacherUser,
            username: 'jane.teacher',
            email: 'jane.teacher@demo.school',
            phone: '+254700000002',
            passwordHash: passwordHashes.teacher,
            role: 'TEACHER',
            schoolId: school.id,
            mustChangePassword: false,
        },
    });
    await prisma.teacher.upsert({
        where: { id: IDS.teacher },
        update: {
            userId: teacherUser.id,
            schoolId: school.id,
            employeeKey: teacherOwnerKey,
            jobGroupId: jobGroup.id,
            firstName: 'Jane',
            middleName: 'Wanjiku',
            lastName: 'Teacher',
            nationalIdNumber: 'ID-DEMO-TEACHER-001',
            passportNumber: 'P-DEMO-TEACHER-001',
            nssfNumber: 'NSSF-DEMO-TEACHER-001',
            kraPin: 'KRA-DEMO-TEACHER-001',
            shaNumber: 'SHA-DEMO-TEACHER-001',
            hireDate: new Date('2024-01-08'),
        },
        create: {
            id: IDS.teacher,
            userId: teacherUser.id,
            schoolId: school.id,
            employeeKey: teacherOwnerKey,
            jobGroupId: jobGroup.id,
            firstName: 'Jane',
            middleName: 'Wanjiku',
            lastName: 'Teacher',
            nationalIdNumber: 'ID-DEMO-TEACHER-001',
            passportNumber: 'P-DEMO-TEACHER-001',
            nssfNumber: 'NSSF-DEMO-TEACHER-001',
            kraPin: 'KRA-DEMO-TEACHER-001',
            shaNumber: 'SHA-DEMO-TEACHER-001',
            hireDate: new Date('2024-01-08'),
        },
    });

    const staffOwnerKey = `S:${IDS.staff}`;
    const staffEmployeeNo = 'S123450001';
    await prisma.employeeNumber.upsert({
        where: { ownerKey: staffOwnerKey },
        update: { schoolId: school.id, employeeNo: staffEmployeeNo },
        create: {
            schoolId: school.id,
            employeeNo: staffEmployeeNo,
            ownerKey: staffOwnerKey,
        },
    });
    const staffUser = await prisma.user.upsert({
        where: { username: 'sam.staff' },
        update: {
            email: 'sam.staff@demo.school',
            phone: '+254700000003',
            passwordHash: passwordHashes.staff,
            role: 'STAFF',
            schoolId: school.id,
            isActive: true,
            mustChangePassword: false,
        },
        create: {
            id: IDS.staffUser,
            username: 'sam.staff',
            email: 'sam.staff@demo.school',
            phone: '+254700000003',
            passwordHash: passwordHashes.staff,
            role: 'STAFF',
            schoolId: school.id,
            mustChangePassword: false,
        },
    });
    await prisma.staff.upsert({
        where: { id: IDS.staff },
        update: {
            userId: staffUser.id,
            schoolId: school.id,
            employeeKey: staffOwnerKey,
            jobGroupId: jobGroup.id,
            firstName: 'Sam',
            middleName: 'Kamau',
            lastName: 'Staff',
            nationalIdNumber: 'ID-DEMO-STAFF-001',
            passportNumber: 'P-DEMO-STAFF-001',
            nssfNumber: 'NSSF-DEMO-STAFF-001',
            kraPin: 'KRA-DEMO-STAFF-001',
            shaNumber: 'SHA-DEMO-STAFF-001',
            department: 'Admissions',
            jobTitle: 'Admissions Officer',
            hireDate: new Date('2024-01-08'),
        },
        create: {
            id: IDS.staff,
            userId: staffUser.id,
            schoolId: school.id,
            employeeKey: staffOwnerKey,
            jobGroupId: jobGroup.id,
            firstName: 'Sam',
            middleName: 'Kamau',
            lastName: 'Staff',
            nationalIdNumber: 'ID-DEMO-STAFF-001',
            passportNumber: 'P-DEMO-STAFF-001',
            nssfNumber: 'NSSF-DEMO-STAFF-001',
            kraPin: 'KRA-DEMO-STAFF-001',
            shaNumber: 'SHA-DEMO-STAFF-001',
            department: 'Admissions',
            jobTitle: 'Admissions Officer',
            hireDate: new Date('2024-01-08'),
        },
    });

    for (const module of ['STUDENTS', 'ATTENDANCE', 'TIMETABLE', 'EXAMS', 'CBC', 'FEES', 'REPORTS']) {
        await prisma.staffModuleAccess.upsert({
            where: { userId_module: { userId: staffUser.id, module } },
            update: { schoolId: school.id, grantedById: admin.id },
            create: {
                schoolId: school.id,
                userId: staffUser.id,
                module,
                grantedById: admin.id,
            },
        });
    }

    const parentUser = await prisma.user.upsert({
        where: { username: 'mary.parent' },
        update: {
            email: 'mary.parent@demo.school',
            passwordHash: passwordHashes.parent,
            role: 'PARENT',
            schoolId: school.id,
            isActive: true,
            mustChangePassword: false,
        },
        create: {
            id: IDS.parentUser,
            username: 'mary.parent',
            email: 'mary.parent@demo.school',
            phone: '+254700000001',
            passwordHash: passwordHashes.parent,
            role: 'PARENT',
            schoolId: school.id,
            mustChangePassword: false,
        },
    });
    const parent = await prisma.parent.upsert({
        where: { id: IDS.parent },
        update: {
            userId: parentUser.id,
            schoolId: school.id,
            firstName: 'Mary',
            middleName: 'Achieng',
            lastName: 'Parent',
            phone: '+254700000001',
            relation: 'GUARDIAN',
            nationalIdNumber: 'ID-DEMO-PARENT-001',
            passportNumber: 'P-DEMO-PARENT-001',
        },
        create: {
            id: IDS.parent,
            userId: parentUser.id,
            schoolId: school.id,
            firstName: 'Mary',
            middleName: 'Achieng',
            lastName: 'Parent',
            phone: '+254700000001',
            relation: 'GUARDIAN',
            nationalIdNumber: 'ID-DEMO-PARENT-001',
            passportNumber: 'P-DEMO-PARENT-001',
        },
    });

    const studentUser = await prisma.user.upsert({
        where: { username: 'alex.student' },
        update: {
            email: 'alex.student@demo.school',
            phone: '+254700000005',
            passwordHash: passwordHashes.student,
            role: 'STUDENT',
            schoolId: school.id,
            isActive: true,
            mustChangePassword: false,
        },
        create: {
            id: IDS.studentUser,
            username: 'alex.student',
            email: 'alex.student@demo.school',
            phone: '+254700000005',
            passwordHash: passwordHashes.student,
            role: 'STUDENT',
            schoolId: school.id,
            mustChangePassword: false,
        },
    });
    const student = await prisma.student.upsert({
        where: { id: IDS.student },
        update: {
            userId: studentUser.id,
            schoolId: school.id,
            admissionNo: 'ADM-2026-001',
            firstName: 'Alex',
            middleName: 'Otieno',
            lastName: 'Student',
            nationalIdNumber: 'ID-DEMO-STUDENT-001',
            birthCertificateNumber: 'BC-DEMO-STUDENT-001',
            passportNumber: 'P-DEMO-STUDENT-001',
            dateOfBirth: new Date('2014-05-12'),
            gender: 'MALE',
            isActive: true,
        },
        create: {
            id: IDS.student,
            userId: studentUser.id,
            schoolId: school.id,
            admissionNo: 'ADM-2026-001',
            firstName: 'Alex',
            middleName: 'Otieno',
            lastName: 'Student',
            nationalIdNumber: 'ID-DEMO-STUDENT-001',
            birthCertificateNumber: 'BC-DEMO-STUDENT-001',
            passportNumber: 'P-DEMO-STUDENT-001',
            dateOfBirth: new Date('2014-05-12'),
            gender: 'MALE',
            isActive: true,
        },
    });
    await prisma.studentParent.upsert({
        where: {
            studentId_parentId: { studentId: student.id, parentId: parent.id },
        },
        update: {},
        create: {
            studentId: student.id,
            parentId: parent.id,
            isPrimaryContact: true,
            isFinanciallyResponsible: true,
        },
    });

    const academicYear = await prisma.academicYear.upsert({
        where: { schoolId_name: { schoolId: school.id, name: '2026' } },
        update: {
            startDate: new Date('2026-01-06'),
            endDate: new Date('2026-11-27'),
            isCurrent: true,
        },
        create: {
            schoolId: school.id,
            name: '2026',
            startDate: new Date('2026-01-06'),
            endDate: new Date('2026-11-27'),
            isCurrent: true,
        },
    });
    const term = await prisma.term.upsert({
        where: {
            academicYearId_name: { academicYearId: academicYear.id, name: 'Term 1' },
        },
        update: {
            schoolId: school.id,
            startDate: new Date('2026-01-06'),
            endDate: new Date('2026-04-02'),
        },
        create: {
            schoolId: school.id,
            academicYearId: academicYear.id,
            name: 'Term 1',
            startDate: new Date('2026-01-06'),
            endDate: new Date('2026-04-02'),
        },
    });
    const classLevel = await prisma.classLevel.upsert({
        where: { schoolId_name: { schoolId: school.id, name: 'Grade 6' } },
        update: { curriculum: 'CBC' },
        create: { schoolId: school.id, name: 'Grade 6', curriculum: 'CBC' },
    });
    const stream = await prisma.stream.upsert({
        where: { classLevelId_name: { classLevelId: classLevel.id, name: 'Blue' } },
        update: { schoolId: school.id },
        create: { schoolId: school.id, classLevelId: classLevel.id, name: 'Blue' },
    });
    const subjects = [];
    for (const [index, name] of ['Mathematics', 'English', 'Science', 'Kiswahili'].entries()) {
        const subject = await prisma.subject.upsert({
            where: {
                schoolId_code: { schoolId: school.id, code: `G6-${index + 1}` },
            },
            update: { name, curriculum: 'CBC' },
            create: {
                schoolId: school.id,
                name,
                code: `G6-${index + 1}`,
                curriculum: 'CBC',
            },
        });
        subjects.push(subject);
        await prisma.teacherSubject.upsert({
            where: {
                teacherId_subjectId: { teacherId: IDS.teacher, subjectId: subject.id },
            },
            update: {},
            create: { teacherId: IDS.teacher, subjectId: subject.id },
        });
        await prisma.classSubject.upsert({
            where: {
                streamId_subjectId: { streamId: stream.id, subjectId: subject.id },
            },
            update: { schoolId: school.id, teacherId: IDS.teacher },
            create: {
                schoolId: school.id,
                streamId: stream.id,
                subjectId: subject.id,
                teacherId: IDS.teacher,
            },
        });
    }

    const extraStudents = [
        ['Brian', 'Mwangi', 'MALE'],
        ['Chloe', 'Njeri', 'FEMALE'],
        ['David', 'Kiptoo', 'MALE'],
        ['Esther', 'Wambui', 'FEMALE'],
        ['Faith', 'Akinyi', 'FEMALE'],
        ['George', 'Otieno', 'MALE'],
        ['Hannah', 'Chebet', 'FEMALE'],
        ['Ian', 'Kamau', 'MALE'],
        ['Joy', 'Atieno', 'FEMALE'],
    ];
    const seededStudents = [student];

    for (const [index, [firstName, lastName, gender]] of extraStudents.entries()) {
        const number = String(index + 2).padStart(3, '0');
        const username = `${firstName.toLowerCase()}.student`;
        const phone = `+254711000${number}`;
        const studentUser = await prisma.user.upsert({
            where: { username },
            update: {
                email: `${username}@demo.school`,
                phone,
                passwordHash: passwordHashes.student,
                role: 'STUDENT',
                schoolId: school.id,
                isActive: true,
                mustChangePassword: false,
            },
            create: {
                username,
                email: `${username}@demo.school`,
                phone,
                passwordHash: passwordHashes.student,
                role: 'STUDENT',
                schoolId: school.id,
                mustChangePassword: false,
            },
        });
        const seededStudent = await prisma.student.upsert({
            where: {
                schoolId_admissionNo: {
                    schoolId: school.id,
                    admissionNo: `ADM-2026-${number}`,
                },
            },
            update: {
                userId: studentUser.id,
                firstName,
                lastName,
                middleName: 'Demo',
                nationalIdNumber: `ID-DEMO-STUDENT-${number}`,
                birthCertificateNumber: `BC-DEMO-STUDENT-${number}`,
                dateOfBirth: new Date(`2014-${String((index % 9) + 1).padStart(2, '0')}-12`),
                gender,
                isActive: true,
            },
            create: {
                userId: studentUser.id,
                schoolId: school.id,
                admissionNo: `ADM-2026-${number}`,
                firstName,
                middleName: 'Demo',
                lastName,
                nationalIdNumber: `ID-DEMO-STUDENT-${number}`,
                birthCertificateNumber: `BC-DEMO-STUDENT-${number}`,
                dateOfBirth: new Date(`2014-${String((index % 9) + 1).padStart(2, '0')}-12`),
                gender,
                isActive: true,
            },
        });
        seededStudents.push(seededStudent);

        const parentUsername = `${firstName.toLowerCase()}.parent`;
        const parentPhone = `+254722000${number}`;
        const parentUser = await prisma.user.upsert({
            where: { username: parentUsername },
            update: {
                email: `${parentUsername}@demo.school`,
                phone: parentPhone,
                passwordHash: passwordHashes.parent,
                role: 'PARENT',
                schoolId: school.id,
                isActive: true,
                mustChangePassword: false,
            },
            create: {
                username: parentUsername,
                email: `${parentUsername}@demo.school`,
                phone: parentPhone,
                passwordHash: passwordHashes.parent,
                role: 'PARENT',
                schoolId: school.id,
                mustChangePassword: false,
            },
        });
        const seededParent = await prisma.parent.upsert({
            where: { phone: parentPhone },
            update: {
                userId: parentUser.id,
                schoolId: school.id,
                firstName: `${firstName}'s`,
                middleName: 'Demo',
                lastName: 'Parent',
                relation: index % 2 === 0 ? 'MOTHER' : 'FATHER',
                nationalIdNumber: `ID-DEMO-PARENT-${number}`,
            },
            create: {
                userId: parentUser.id,
                schoolId: school.id,
                firstName: `${firstName}'s`,
                middleName: 'Demo',
                lastName: 'Parent',
                phone: parentPhone,
                relation: index % 2 === 0 ? 'MOTHER' : 'FATHER',
                nationalIdNumber: `ID-DEMO-PARENT-${number}`,
            },
        });
        await prisma.studentParent.upsert({
            where: {
                studentId_parentId: {
                    studentId: seededStudent.id,
                    parentId: seededParent.id,
                },
            },
            update: {
                isPrimaryContact: true,
                isFinanciallyResponsible: true,
                canPickUp: true,
            },
            create: {
                studentId: seededStudent.id,
                parentId: seededParent.id,
                isPrimaryContact: true,
                isFinanciallyResponsible: true,
                canPickUp: true,
            },
        });
    }

    for (const seededStudent of seededStudents) {
        const enrollment = await prisma.enrollment.upsert({
            where: {
                studentId_academicYearId: {
                    studentId: seededStudent.id,
                    academicYearId: academicYear.id,
                },
            },
            update: { schoolId: school.id, streamId: stream.id, status: 'ACTIVE' },
            create: {
                schoolId: school.id,
                studentId: seededStudent.id,
                streamId: stream.id,
                academicYearId: academicYear.id,
                status: 'ACTIVE',
            },
        });
        await prisma.feeStructure.upsert({
            where: {
                termId_classLevelId: { termId: term.id, classLevelId: classLevel.id },
            },
            update: {
                schoolId: school.id,
                amount: 45000,
                description: 'Grade 6 Term 1 tuition',
            },
            create: {
                schoolId: school.id,
                termId: term.id,
                classLevelId: classLevel.id,
                amount: 45000,
                description: 'Grade 6 Term 1 tuition',
            },
        });
        const invoice = await prisma.invoice.upsert({
            where: {
                studentId_termId: { studentId: seededStudent.id, termId: term.id },
            },
            update: {
                schoolId: school.id,
                enrollmentId: enrollment.id,
                amountDue: 45000,
                amountPaid: 0,
                status: 'UNPAID',
                dueDate: new Date('2026-02-06'),
            },
            create: {
                schoolId: school.id,
                studentId: seededStudent.id,
                enrollmentId: enrollment.id,
                termId: term.id,
                amountDue: 45000,
                dueDate: new Date('2026-02-06'),
                status: 'UNPAID',
            },
        });
        await seedAllocatedPayment({
            schoolId: school.id,
            invoice,
            student: seededStudent,
            recordedById: admin.id,
            amount: 5000,
            receipt: `DEMO${seededStudent.admissionNo.replaceAll('-', '')}`,
            phone: '+254700000001',
            paidAt: new Date('2026-01-15'),
        });
    }

    // A smaller second tenant makes isolation behavior visible during local testing.
    // None of its relationships reuse IDs from the primary demo school.
    const secondSchool = await prisma.school.upsert({
        where: { slug: 'northstar-demo' },
        update: {
            name: 'NORTHSTAR DEMO ACADEMY',
            schoolCode: '54321',
            isActive: true,
            motto: 'Every Learner Shines',
            vision: 'Confident learners serving their communities',
            mission: 'To provide inclusive, practical education',
            address: '2 Learning Avenue',
            city: 'Nakuru',
            county: 'Nakuru',
            postalCode: '20100',
            phone: '+254733000000',
            email: 'info@northstar.demo',
            website: 'https://northstar.demo',
        },
        create: {
            id: IDS.secondSchool,
            name: 'NORTHSTAR DEMO ACADEMY',
            slug: 'northstar-demo',
            schoolCode: '54321',
            isActive: true,
            motto: 'Every Learner Shines',
            vision: 'Confident learners serving their communities',
            mission: 'To provide inclusive, practical education',
            address: '2 Learning Avenue',
            city: 'Nakuru',
            county: 'Nakuru',
            postalCode: '20100',
            phone: '+254733000000',
            email: 'info@northstar.demo',
            website: 'https://northstar.demo',
        },
    });
    await prisma.schoolSettings.upsert({
        where: { schoolId: secondSchool.id },
        update: { mpesaShortcode: '454321', mpesaEnabled: false },
        create: {
            schoolId: secondSchool.id,
            mpesaShortcode: '454321',
            mpesaEnabled: false,
        },
    });
    await prisma.jobGroup.upsert({
        where: { schoolId_code: { schoolId: secondSchool.id, code: 'DEMO-JG' } },
        update: {
            name: 'Northstar Staff',
            description: 'Northstar-only demo job group',
            isActive: true,
        },
        create: {
            schoolId: secondSchool.id,
            name: 'Northstar Staff',
            code: 'DEMO-JG',
            description: 'Northstar-only demo job group',
        },
    });

    const secondAdmin = await prisma.user.upsert({
        where: { username: 'northstar.admin' },
        update: {
            email: 'admin@northstar.demo',
            phone: '+254733000001',
            passwordHash: passwordHashes.admin,
            role: 'ADMIN',
            schoolId: secondSchool.id,
            isActive: true,
            mustChangePassword: false,
        },
        create: {
            id: IDS.secondAdmin,
            username: 'northstar.admin',
            email: 'admin@northstar.demo',
            phone: '+254733000001',
            passwordHash: passwordHashes.admin,
            role: 'ADMIN',
            schoolId: secondSchool.id,
            mustChangePassword: false,
        },
    });

    // Parents may exist as school contacts without receiving a portal account.
    const secondParent = await prisma.parent.upsert({
        where: { id: IDS.secondParent },
        update: {
            userId: null,
            schoolId: secondSchool.id,
            firstName: 'Grace',
            lastName: 'Guardian',
            phone: '+254733000002',
            email: 'grace.guardian@northstar.demo',
            relation: 'GUARDIAN',
            nationalIdNumber: 'ID-NORTHSTAR-PARENT-001',
        },
        create: {
            id: IDS.secondParent,
            schoolId: secondSchool.id,
            firstName: 'Grace',
            lastName: 'Guardian',
            phone: '+254733000002',
            email: 'grace.guardian@northstar.demo',
            relation: 'GUARDIAN',
            nationalIdNumber: 'ID-NORTHSTAR-PARENT-001',
        },
    });
    const secondStudent = await prisma.student.upsert({
        where: { id: IDS.secondStudent },
        update: {
            userId: null,
            schoolId: secondSchool.id,
            admissionNo: 'NS-2026-001',
            firstName: 'Noah',
            lastName: 'Learner',
            nationalIdNumber: 'ID-NORTHSTAR-STUDENT-001',
            birthCertificateNumber: 'BC-NORTHSTAR-STUDENT-001',
            dateOfBirth: new Date('2014-08-21'),
            gender: 'MALE',
            isActive: true,
        },
        create: {
            id: IDS.secondStudent,
            schoolId: secondSchool.id,
            admissionNo: 'NS-2026-001',
            firstName: 'Noah',
            lastName: 'Learner',
            nationalIdNumber: 'ID-NORTHSTAR-STUDENT-001',
            birthCertificateNumber: 'BC-NORTHSTAR-STUDENT-001',
            dateOfBirth: new Date('2014-08-21'),
            gender: 'MALE',
            isActive: true,
        },
    });
    await prisma.studentParent.upsert({
        where: {
            studentId_parentId: {
                studentId: secondStudent.id,
                parentId: secondParent.id,
            },
        },
        update: {
            isPrimaryContact: true,
            isFinanciallyResponsible: true,
            canPickUp: true,
        },
        create: {
            studentId: secondStudent.id,
            parentId: secondParent.id,
            isPrimaryContact: true,
            isFinanciallyResponsible: true,
            canPickUp: true,
        },
    });

    const secondAcademicYear = await prisma.academicYear.upsert({
        where: { schoolId_name: { schoolId: secondSchool.id, name: '2026' } },
        update: {
            startDate: new Date('2026-01-06'),
            endDate: new Date('2026-11-27'),
            isCurrent: true,
        },
        create: {
            schoolId: secondSchool.id,
            name: '2026',
            startDate: new Date('2026-01-06'),
            endDate: new Date('2026-11-27'),
            isCurrent: true,
        },
    });
    const secondTerm = await prisma.term.upsert({
        where: {
            academicYearId_name: {
                academicYearId: secondAcademicYear.id,
                name: 'Term 1',
            },
        },
        update: {
            schoolId: secondSchool.id,
            startDate: new Date('2026-01-06'),
            endDate: new Date('2026-04-02'),
        },
        create: {
            schoolId: secondSchool.id,
            academicYearId: secondAcademicYear.id,
            name: 'Term 1',
            startDate: new Date('2026-01-06'),
            endDate: new Date('2026-04-02'),
        },
    });
    const secondClassLevel = await prisma.classLevel.upsert({
        where: { schoolId_name: { schoolId: secondSchool.id, name: 'Grade 6' } },
        update: { curriculum: 'CBC' },
        create: { schoolId: secondSchool.id, name: 'Grade 6', curriculum: 'CBC' },
    });
    const secondStream = await prisma.stream.upsert({
        where: {
            classLevelId_name: { classLevelId: secondClassLevel.id, name: 'Gold' },
        },
        update: { schoolId: secondSchool.id },
        create: {
            schoolId: secondSchool.id,
            classLevelId: secondClassLevel.id,
            name: 'Gold',
        },
    });
    const secondEnrollment = await prisma.enrollment.upsert({
        where: {
            studentId_academicYearId: {
                studentId: secondStudent.id,
                academicYearId: secondAcademicYear.id,
            },
        },
        update: {
            schoolId: secondSchool.id,
            streamId: secondStream.id,
            status: 'ACTIVE',
        },
        create: {
            schoolId: secondSchool.id,
            studentId: secondStudent.id,
            streamId: secondStream.id,
            academicYearId: secondAcademicYear.id,
            status: 'ACTIVE',
        },
    });
    await prisma.feeStructure.upsert({
        where: {
            termId_classLevelId: {
                termId: secondTerm.id,
                classLevelId: secondClassLevel.id,
            },
        },
        update: {
            schoolId: secondSchool.id,
            amount: 32000,
            description: 'Northstar Grade 6 Term 1 tuition',
        },
        create: {
            schoolId: secondSchool.id,
            termId: secondTerm.id,
            classLevelId: secondClassLevel.id,
            amount: 32000,
            description: 'Northstar Grade 6 Term 1 tuition',
        },
    });
    const secondInvoice = await prisma.invoice.upsert({
        where: {
            studentId_termId: { studentId: secondStudent.id, termId: secondTerm.id },
        },
        update: {
            schoolId: secondSchool.id,
            enrollmentId: secondEnrollment.id,
            amountDue: 32000,
            dueDate: new Date('2026-02-06'),
        },
        create: {
            schoolId: secondSchool.id,
            studentId: secondStudent.id,
            enrollmentId: secondEnrollment.id,
            termId: secondTerm.id,
            amountDue: 32000,
            dueDate: new Date('2026-02-06'),
            status: 'UNPAID',
        },
    });
    await seedAllocatedPayment({
        schoolId: secondSchool.id,
        invoice: secondInvoice,
        student: secondStudent,
        recordedById: secondAdmin.id,
        amount: 7500,
        receipt: 'NORTHSTARNS2026001',
        phone: secondParent.phone,
        paidAt: new Date('2026-01-16'),
    });

    console.log('Seed completed. Demo login credentials:');
    console.log('admin / admin@demo.school / AdminDemo123!');
    console.log('jane.teacher / jane.teacher@demo.school / TeacherDemo123!');
    console.log('sam.staff / sam.staff@demo.school / StaffDemo123!');
    console.log('mary.parent / mary.parent@demo.school / ParentDemo123!');
    console.log('alex.student / alex.student@demo.school / StudentDemo123!');
    console.log('superadmin / superadmin@demo.school / SuperAdmin123!');
    console.log('northstar.admin / admin@northstar.demo / AdminDemo123!');
    console.log(`SUPER_ADMIN tenant headers: x-school-id=${school.id} or ${secondSchool.id}`);
}

main()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
