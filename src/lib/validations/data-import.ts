import { z } from "zod";

export const batchImportClassSchema = z.object({
  classes: z
    .array(
      z.object({
        teacherName: z.string().min(1, "教师姓名不能为空"),
        classTime: z.string().min(1, "上课时间不能为空"),
        courseName: z.string().min(1, "课程名称不能为空"),
        students: z.array(z.string().min(1, "学生姓名不能为空")),
      })
    )
    .min(1, "至少提供一个班级"),
});

export const updateAdminTeacherSchema = z.object({
  students: z
    .array(
      z.object({
        name: z.string().min(1, "学生姓名不能为空"),
        adminType: z.string().min(1, "教务类型不能为空"),
      })
    )
    .min(1, "至少提供一个学生"),
});

export const initDataSchema = z.object({}).optional();

export const resetAdminSchema = z.object({}).optional();
