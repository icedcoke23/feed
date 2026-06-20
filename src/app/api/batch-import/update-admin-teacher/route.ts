import { z } from "zod";
import { eq, inArray } from "drizzle-orm";
import { withDbError } from "@/lib/route-handlers/with-db-error";
import { withAuth } from "@/lib/route-handlers/with-auth";
import { withValidation } from "@/lib/route-handlers/with-validation";
import { successResponse, errorResponse } from "@/lib/api-response";
import { db } from "@/storage/database/drizzle-client";
import { students, users } from "@/storage/database/shared/schema";
import { getAdminTeacherMappings } from "@/lib/config/default-admins";

const updateAdminTeacherSchema = z.object({
  students: z.array(
    z.object({
      name: z.string().min(1, "学员姓名不能为空"),
      adminType: z.string().min(1, "教务老师类型不能为空"),
    })
  ).min(1, "请提供学员数据").max(500, "单次最多处理500条记录"),
});

export const POST = withDbError(
  withAuth(
    withValidation(
      { body: updateAdminTeacherSchema },
      async (req, { authUser, body }) => {
        if (authUser!.userRole !== "admin") {
          return errorResponse("仅管理员可访问", 403, "FORBIDDEN");
        }

        const mappings = getAdminTeacherMappings();
        if (Object.keys(mappings).length === 0) {
          return errorResponse("未配置 ADMIN_TEACHER_MAPPINGS 环境变量", 400);
        }

        const input = body as { students: Array<{ name: string; adminType: string }> };

        const usernames = [...new Set(Object.values(mappings))];
        const teacherRows = await db
          .select({ id: users.id, username: users.username })
          .from(users)
          .where(inArray(users.username, usernames));

        const teacherIdByUsername = new Map(teacherRows.map((t) => [t.username, t.id]));
        const teacherIdByType = new Map<string, string | null>();
        for (const [type, username] of Object.entries(mappings)) {
          teacherIdByType.set(type, teacherIdByUsername.get(username) || null);
        }

        const results = {
          updated: 0,
          notFound: [] as string[],
          errors: [] as string[],
        };

        for (const student of input.students) {
          const adminTeacherId = teacherIdByType.get(student.adminType);

          if (!adminTeacherId) {
            results.errors.push(`未找到教务老师: ${student.adminType}`);
            continue;
          }

          const updatedRows = await db
            .update(students)
            .set({ adminTeacherId })
            .where(eq(students.name, student.name))
            .returning({ id: students.id });

          if (updatedRows.length === 0) {
            results.notFound.push(student.name);
          } else {
            results.updated += updatedRows.length;
          }
        }

        return successResponse(results, `成功更新 ${results.updated} 条记录`);
      }
    )
  )
);
