import { z } from "zod";
import { withDbError } from "@/lib/route-handlers/with-db-error";
import { withAuth } from "@/lib/route-handlers/with-auth";
import { withValidation } from "@/lib/route-handlers/with-validation";
import { successResponse } from "@/lib/api-response";
import { studentService } from "@/lib/services";

const studentItemSchema = z.object({
  name: z.string().min(1, "学员姓名不能为空"),
  grade: z.string().optional().default(""),
  className: z.string().optional().default(""),
  teacherName: z.string().optional(),
});

const batchStudentsSchema = z.object({
  students: z
    .array(studentItemSchema)
    .min(1, "请提供学员数据")
    .max(100, "单次最多导入100条记录"),
  classId: z.string().optional(),
});

export const POST = withDbError(
  withAuth(
    withValidation(
      { body: batchStudentsSchema },
      async (req, { authUser, body }) => {
        const result = await studentService.batchCreate(
          authUser!,
          body as studentService.BatchCreateInput
        );
        if (result instanceof Response) return result;
        return successResponse(result.data, `成功添加 ${result.count} 名学员`);
      }
    )
  )
);
