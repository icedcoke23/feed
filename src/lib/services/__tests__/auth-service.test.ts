import { describe, expect, test, beforeEach, afterEach, vi } from "vitest";
import { createTestDb } from "@/test/db";
import {
  users,
  teachers,
  classes,
  students,
  studentClasses,
} from "@/storage/database/shared/schema";
import { hashPassword } from "@/lib/auth";
import * as authService from "@/lib/services/auth-service";
import type { AuthUserResult } from "@/lib/route-auth";

let testDb: Awaited<ReturnType<typeof createTestDb>>;
type DrizzleDb = typeof testDb.drizzleDb;

vi.mock("@/storage/database/drizzle-client", () => ({
  db: new Proxy({} as DrizzleDb, {
    get(_, prop) {
      if (!testDb) {
        throw new Error("testDb not initialized");
      }
      return testDb.drizzleDb[prop as keyof DrizzleDb];
    },
  }),
}));

describe("auth-service", () => {
  beforeEach(async () => {
    testDb = await createTestDb();
  });

  afterEach(async () => {
    await testDb.client.close();
  });

  describe("login", () => {
    test("成功登录返回用户信息", async () => {
      await testDb.drizzleDb.insert(users).values({
        id: "u1",
        username: "teacher1",
        name: "Teacher One",
        password: await hashPassword("pass123"),
        role: "teacher",
        isActive: true,
      });
      await testDb.drizzleDb.insert(teachers).values({
        id: "u1",
        name: "Teacher One",
        email: "teacher1@school.com",
        role: "teacher",
        isActive: true,
      });

      const result = await authService.login({
        username: "teacher1",
        password: "pass123",
      });

      expect(result).not.toBeInstanceOf(Response);
      expect((result as authService.LoginResult).user.username).toBe("teacher1");
      expect((result as authService.LoginResult).user.role).toBe("teacher");
      expect((result as authService.LoginResult).user.teacherRole).toBe("teacher");
    });

    test("用户不存在返回 401", async () => {
      const result = await authService.login({
        username: "nobody",
        password: "pass123",
      });

      expect(result).toBeInstanceOf(Response);
      expect((result as Response).status).toBe(401);
    });

    test("密码错误返回 401", async () => {
      await testDb.drizzleDb.insert(users).values({
        id: "u2",
        username: "teacher2",
        name: "Teacher Two",
        password: await hashPassword("correct"),
        role: "teacher",
        isActive: true,
      });

      const result = await authService.login({
        username: "teacher2",
        password: "wrong",
      });

      expect(result).toBeInstanceOf(Response);
      expect((result as Response).status).toBe(401);
    });

    test("非活跃用户返回 401", async () => {
      await testDb.drizzleDb.insert(users).values({
        id: "u3",
        username: "inactive",
        name: "Inactive",
        password: await hashPassword("pass123"),
        role: "teacher",
        isActive: false,
      });

      const result = await authService.login({
        username: "inactive",
        password: "pass123",
      });

      expect(result).toBeInstanceOf(Response);
      expect((result as Response).status).toBe(401);
    });
  });

  describe("canTeacherAccessStudent", () => {
    test("教师通过班级关联可访问学生返回 true", async () => {
      await testDb.drizzleDb.insert(teachers).values({
        id: "t1",
        name: "T1",
        email: "t1@school.com",
        role: "teacher",
        isActive: true,
      });
      await testDb.drizzleDb.insert(classes).values({
        id: "c1",
        name: "Class 1",
        teacherId: "t1",
        isActive: true,
      });
      await testDb.drizzleDb.insert(students).values({
        id: "s1",
        name: "Student 1",
        isActive: true,
      });
      await testDb.drizzleDb.insert(studentClasses).values({
        studentId: "s1",
        classId: "c1",
        isPrimary: true,
        isActive: true,
      });

      const canAccess = await authService.canTeacherAccessStudent("t1", "s1");
      expect(canAccess).toBe(true);
    });

    test("教师无班级关联返回 false", async () => {
      await testDb.drizzleDb.insert(teachers).values({
        id: "t2",
        name: "T2",
        email: "t2@school.com",
        role: "teacher",
        isActive: true,
      });
      await testDb.drizzleDb.insert(students).values({
        id: "s2",
        name: "Student 2",
        isActive: true,
      });

      const canAccess = await authService.canTeacherAccessStudent("t2", "s2");
      expect(canAccess).toBe(false);
    });

    test("教师无任何班级返回 false", async () => {
      const canAccess = await authService.canTeacherAccessStudent(
        "nonexistent",
        "any-student"
      );
      expect(canAccess).toBe(false);
    });
  });

  describe("getAccessibleStudentIds", () => {
    test("管理员返回 null（无限制）", async () => {
      const adminUser: AuthUserResult = {
        userId: "admin1",
        userRole: "admin",
      };

      const result = await authService.getAccessibleStudentIds(adminUser);
      expect(result).toBeNull();
    });

    test("教务老师按 admin_teacher_id 过滤", async () => {
      // 先创建教务老师记录以满足外键约束
      await testDb.drizzleDb.insert(teachers).values({
        id: "staff1",
        name: "Staff One",
        email: "staff1@school.com",
        role: "admin",
        isActive: true,
      });
      await testDb.drizzleDb.insert(teachers).values({
        id: "other",
        name: "Other Staff",
        email: "other@school.com",
        role: "admin",
        isActive: true,
      });
      await testDb.drizzleDb.insert(students).values({
        id: "s-admin-1",
        name: "Admin Student 1",
        adminTeacherId: "staff1",
        isActive: true,
      });
      await testDb.drizzleDb.insert(students).values({
        id: "s-admin-2",
        name: "Admin Student 2",
        adminTeacherId: "other",
        isActive: true,
      });

      const staffUser: AuthUserResult = {
        userId: "staff1",
        userRole: "teacher",
        teacherRole: "admin",
      };

      const result = await authService.getAccessibleStudentIds(staffUser);
      expect(result).toEqual(["s-admin-1"]);
    });

    test("授课老师按班级关联过滤", async () => {
      await testDb.drizzleDb.insert(teachers).values({
        id: "teacher-x",
        name: "Teacher X",
        email: "tx@school.com",
        role: "teacher",
        isActive: true,
      });
      await testDb.drizzleDb.insert(classes).values({
        id: "cx",
        name: "Class X",
        teacherId: "teacher-x",
        isActive: true,
      });
      await testDb.drizzleDb.insert(students).values({
        id: "sx1",
        name: "SX1",
        isActive: true,
      });
      await testDb.drizzleDb.insert(students).values({
        id: "sx2",
        name: "SX2",
        isActive: true,
      });
      await testDb.drizzleDb.insert(studentClasses).values({
        studentId: "sx1",
        classId: "cx",
        isPrimary: true,
        isActive: true,
      });
      await testDb.drizzleDb.insert(studentClasses).values({
        studentId: "sx2",
        classId: "cx",
        isPrimary: false,
        isActive: true,
      });

      const teacherUser: AuthUserResult = {
        userId: "teacher-x",
        userRole: "teacher",
      };

      const result = await authService.getAccessibleStudentIds(teacherUser);
      expect(result).toEqual(expect.arrayContaining(["sx1", "sx2"]));
      expect(result?.length).toBe(2);
    });

    test("授课老师无班级返回空数组", async () => {
      const teacherUser: AuthUserResult = {
        userId: "no-classes",
        userRole: "teacher",
      };

      const result = await authService.getAccessibleStudentIds(teacherUser);
      expect(result).toEqual([]);
    });
  });

  describe("getTeacherClassIds", () => {
    test("返回教师所带活跃班级 ID", async () => {
      await testDb.drizzleDb.insert(teachers).values({
        id: "tc1",
        name: "TC1",
        email: "tc1@school.com",
        role: "teacher",
        isActive: true,
      });
      await testDb.drizzleDb.insert(classes).values({
        id: "active-class",
        name: "Active",
        teacherId: "tc1",
        isActive: true,
      });
      await testDb.drizzleDb.insert(classes).values({
        id: "inactive-class",
        name: "Inactive",
        teacherId: "tc1",
        isActive: false,
      });

      const classIds = await authService.getTeacherClassIds("tc1");
      expect(classIds).toEqual(["active-class"]);
    });

    test("无班级返回空数组", async () => {
      const classIds = await authService.getTeacherClassIds("no-such-teacher");
      expect(classIds).toEqual([]);
    });
  });

  describe("getTeacherRole", () => {
    test("返回教师角色", async () => {
      await testDb.drizzleDb.insert(teachers).values({
        id: "tr1",
        name: "TR1",
        email: "tr1@school.com",
        role: "admin",
        isActive: true,
      });

      const role = await authService.getTeacherRole("tr1");
      expect(role).toBe("admin");
    });

    test("教师不存在返回默认 teacher", async () => {
      const role = await authService.getTeacherRole("nonexistent");
      expect(role).toBe("teacher");
    });
  });
});
