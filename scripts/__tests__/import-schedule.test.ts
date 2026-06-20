import { describe, it, expect, vi } from 'vitest';
import {
  parseScheduleData,
  importSchedule,
  runDryRun,
  deriveGrade,
  deriveTeacherUsername,
  deriveTeacherEmail,
  ADMIN_TEACHERS,
  type ScheduleInput,
  type ParsedSchedule,
} from '../import-schedule';
import { createTestDb } from '@/test/db';
import { users, teachers, classes, students, studentClasses } from '@/storage/database/shared/schema';
import { eq } from 'drizzle-orm';

const sampleInput: ScheduleInput = {
  teachers: [{ name: '晓雪' }, { name: '小何' }],
  classes: [
    {
      name: '雪-周三15点小小乐高',
      teacher: '晓雪',
      day: '周三',
      time: '15:30-17:00',
      course: '小小乐高',
      students: ['王沐晓'],
    },
    {
      name: '何-周三17点百变',
      teacher: '小何',
      day: '周三',
      time: '17:00-18:30',
      course: '百变',
      students: ['李筠亭'],
    },
  ],
  students: [
    {
      name: '王沐晓',
      teachers: ['晓雪'],
      classNames: ['雪-周三15点小小乐高'],
      adminTeacher: '睿睿',
    },
    {
      name: '李筠亭',
      teachers: ['小何'],
      classNames: ['何-周三17点百变'],
      adminTeacher: null,
    },
  ],
};

describe('parseScheduleData', () => {
  it('正确提取教师、班级和学生', () => {
    const parsed = parseScheduleData(sampleInput);

    expect(parsed.adminTeachers).toEqual(ADMIN_TEACHERS);
    expect(parsed.teachingTeachers).toHaveLength(2);
    expect(parsed.teachingTeachers[0]).toEqual({
      name: '晓雪',
      username: '晓雪',
      email: '晓雪@school.com',
    });
    expect(parsed.teachingTeachers[1]).toEqual({
      name: '小何',
      username: '小何',
      email: '小何@school.com',
    });

    expect(parsed.classes).toHaveLength(2);
    expect(parsed.classes[0].name).toBe('雪-周三15点小小乐高');
    expect(parsed.classes[0].students).toEqual(['王沐晓']);

    expect(parsed.students).toHaveLength(2);
    expect(parsed.students[0].name).toBe('王沐晓');
    expect(parsed.students[0].adminTeacher).toBe('睿睿');
    expect(parsed.students[1].adminTeacher).toBeNull();
  });

  it('根据课程名推断年级', () => {
    expect(deriveGrade('小小乐高')).toBe('幼儿');
    expect(deriveGrade('生活与科技')).toBe('幼儿');
    expect(deriveGrade('百变工程')).toBe('幼儿');
    expect(deriveGrade('Wedo')).toBe('小学低年级');
    expect(deriveGrade('spike')).toBe('小学中高年级');
    expect(deriveGrade('scratch')).toBe('小学');
    expect(deriveGrade('python')).toBe('小学高年级');
    expect(deriveGrade('C++')).toBe('小学高年级');
    expect(deriveGrade('wrc集训')).toBe('小学高年级');
    expect(deriveGrade('未知课程')).toBe('小学');
  });

  it('生成教师用户名和邮箱', () => {
    expect(deriveTeacherUsername('小鱼')).toBe('小鱼');
    expect(deriveTeacherEmail('小鱼')).toBe('小鱼@school.com');
    expect(deriveTeacherUsername('Teacher Name')).toBe('teachername');
  });

  it('对非法输入抛出校验错误', () => {
    expect(() => parseScheduleData({})).toThrow();
    expect(() =>
      parseScheduleData({
        teachers: [{ name: '晓雪' }],
        classes: [{ name: '班级' }],
        students: [],
      })
    ).toThrow();
  });
});

describe('runDryRun', () => {
  const parsed: ParsedSchedule = parseScheduleData({
    teachers: [{ name: '晓雪' }],
    classes: [
      {
        name: '雪-周三15点小小乐高',
        teacher: '晓雪',
        day: '周三',
        time: '15:30-17:00',
        course: '小小乐高',
        students: ['王沐晓'],
      },
    ],
    students: [
      {
        name: '王沐晓',
        teachers: ['晓雪'],
        classNames: ['雪-周三15点小小乐高'],
        adminTeacher: '睿睿',
      },
    ],
  });

  it('dry-run 模式不会调用数据库写入', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const result = runDryRun(parsed, false);

    expect(result.adminTeachersCreated).toBe(3);
    expect(result.teachersCreated).toBe(1);
    expect(result.classesCreated).toBe(1);
    expect(result.studentsCreated).toBe(1);
    expect(result.studentClassesCreated).toBe(1);
    expect(result.errors).toEqual([]);

    consoleSpy.mockRestore();
  });
});

describe('importSchedule integration', () => {
  it('首次导入创建教师、班级和学生', async () => {
    const { drizzleDb } = await createTestDb();

    const result = await importSchedule(drizzleDb, parseScheduleData(sampleInput));

    expect(result.errors).toEqual([]);
    expect(result.adminTeachersCreated).toBe(3);
    expect(result.teachersCreated).toBe(2);
    expect(result.classesCreated).toBe(2);
    expect(result.studentsCreated).toBe(2);
    expect(result.studentClassesCreated).toBe(2);
    expect(result.adminTeacherUpdates).toBe(0);

    const allUsers = await drizzleDb.select().from(users);
    expect(allUsers).toHaveLength(5);

    const allTeachers = await drizzleDb.select().from(teachers);
    expect(allTeachers).toHaveLength(5);

    const allClasses = await drizzleDb.select().from(classes);
    expect(allClasses).toHaveLength(2);

    const allStudents = await drizzleDb.select().from(students);
    expect(allStudents).toHaveLength(2);

    const allStudentClasses = await drizzleDb.select().from(studentClasses);
    expect(allStudentClasses).toHaveLength(2);
  });

  it('重复导入跳过已存在的教师并复用班级', async () => {
    const { drizzleDb } = await createTestDb();

    await importSchedule(drizzleDb, parseScheduleData(sampleInput));
    const secondResult = await importSchedule(drizzleDb, parseScheduleData(sampleInput));

    expect(secondResult.errors).toEqual([]);
    expect(secondResult.adminTeachersCreated).toBe(0);
    expect(secondResult.teachersCreated).toBe(0);
    expect(secondResult.classesCreated).toBe(0);
    expect(secondResult.studentsCreated).toBe(0);
    expect(secondResult.studentClassesCreated).toBe(0);

    const allTeachers = await drizzleDb.select().from(teachers);
    expect(allTeachers).toHaveLength(5);

    const allClasses = await drizzleDb.select().from(classes);
    expect(allClasses).toHaveLength(2);

    const allStudentClasses = await drizzleDb.select().from(studentClasses);
    expect(allStudentClasses).toHaveLength(2);
  });

  it('username 冲突时生成唯一用户名', async () => {
    const { drizzleDb } = await createTestDb();

    // 预先占用目标用户名
    await drizzleDb.insert(users).values({
      username: '晓雪',
      password: 'hashed',
      name: '占位用户',
      role: 'teacher',
    });

    const result = await importSchedule(
      drizzleDb,
      parseScheduleData({
        teachers: [{ name: '晓雪' }],
        classes: [
          {
            name: '雪-周三15点小小乐高',
            teacher: '晓雪',
            day: '周三',
            time: '15:30-17:00',
            course: '小小乐高',
            students: ['王沐晓'],
          },
        ],
        students: [
          {
            name: '王沐晓',
            teachers: ['晓雪'],
            classNames: ['雪-周三15点小小乐高'],
            adminTeacher: null,
          },
        ],
      })
    );

    expect(result.errors).toEqual([]);
    expect(result.teachersCreated).toBe(1);

    const createdUser = await drizzleDb
      .select()
      .from(users)
      .where(eq(users.name, '晓雪'))
      .limit(1);
    expect(createdUser[0]?.username).not.toBe('晓雪');
    expect(createdUser[0]?.username).toMatch(/^晓雪\d+$/);
  });

  it('不同教师可拥有同名班级', async () => {
    const { drizzleDb } = await createTestDb();

    const result = await importSchedule(
      drizzleDb,
      parseScheduleData({
        teachers: [{ name: '晓雪' }, { name: '小何' }],
        classes: [
          {
            name: '同名班级',
            teacher: '晓雪',
            day: '周三',
            time: '15:30-17:00',
            course: '小小乐高',
            students: ['学生甲'],
          },
          {
            name: '同名班级',
            teacher: '小何',
            day: '周三',
            time: '17:00-18:30',
            course: '百变',
            students: ['学生乙'],
          },
        ],
        students: [
          {
            name: '学生甲',
            teachers: ['晓雪'],
            classNames: ['同名班级'],
            adminTeacher: null,
          },
          {
            name: '学生乙',
            teachers: ['小何'],
            classNames: ['同名班级'],
            adminTeacher: null,
          },
        ],
      })
    );

    expect(result.errors).toEqual([]);
    expect(result.classesCreated).toBe(2);
    expect(result.studentsCreated).toBe(2);

    const allClasses = await drizzleDb.select().from(classes);
    expect(allClasses).toHaveLength(2);
  });

  it('真实事务导入路径不会因重复数据导致事务中止', async () => {
    const { drizzleDb } = await createTestDb();

    // 先完成一次导入
    await importSchedule(drizzleDb, parseScheduleData(sampleInput));

    // 再次导入应正常完成且不报错
    const result = await importSchedule(drizzleDb, parseScheduleData(sampleInput));
    expect(result.errors).toEqual([]);
  });
});
