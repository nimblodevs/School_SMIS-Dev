import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    prisma: {
        school: { findUnique: vi.fn() },
        parent: { findFirst: vi.fn() },
    },
    studentService: {
        assertCanManage: vi.fn(),
        assertInSchool: vi.fn(),
        getById: vi.fn(),
    },
}));

vi.mock('../src/config/prisma.js', () => ({ prisma: mocks.prisma }));
vi.mock('../src/shared/audit.js', () => ({ recordAudit: vi.fn() }));
vi.mock('../src/modules/students/students.service.js', () => ({
    StudentService: mocks.studentService,
}));

import { StorageService } from '../src/modules/storage/storage.service.js';

beforeEach(() => {
    for (const model of Object.values(mocks.prisma)) {
        for (const method of Object.values(model)) method.mockReset();
    }
    for (const method of Object.values(mocks.studentService)) method.mockReset();
});

describe('profile photo storage access', () => {
    it('rejects a school photo associated with a different tenant', async () => {
        mocks.prisma.school.findUnique.mockResolvedValue({ id: 'school-b' });

        await expect(
            StorageService.assertProfilePhotoAccess(
                { relatedType: 'SCHOOL_PROFILE_PHOTO', relatedId: 'school-b', mimeType: 'image/png' },
                { role: 'ADMIN', schoolId: 'school-a' },
                true,
            ),
        ).rejects.toThrow('School profile not found');
    });

    it('rejects non-image profile photo uploads before looking up the profile', async () => {
        await expect(
            StorageService.assertProfilePhotoAccess(
                { relatedType: 'STUDENT_PROFILE_PHOTO', relatedId: 'student-a', mimeType: 'application/pdf' },
                { role: 'TEACHER', schoolId: 'school-a' },
                true,
            ),
        ).rejects.toThrow('Profile photos must be image files');
        expect(mocks.studentService.assertInSchool).not.toHaveBeenCalled();
    });

    it('uses the student service ownership checks before accepting a student photo', async () => {
        await StorageService.assertProfilePhotoAccess(
            { relatedType: 'STUDENT_PROFILE_PHOTO', relatedId: 'student-a', mimeType: 'image/jpeg' },
            { id: 'teacher-a', role: 'TEACHER', schoolId: 'school-a' },
            true,
        );

        expect(mocks.studentService.assertCanManage).toHaveBeenCalledWith({
            id: 'teacher-a',
            role: 'TEACHER',
            schoolId: 'school-a',
        });
        expect(mocks.studentService.assertInSchool).toHaveBeenCalledWith('student-a', {
            id: 'teacher-a',
            role: 'TEACHER',
            schoolId: 'school-a',
        });
    });
});