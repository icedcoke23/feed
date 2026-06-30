import { db } from "@/storage/database/drizzle-client";
import { teachers, classes } from "@/storage/database/shared/schema";
import { inArray } from "drizzle-orm";
import * as repo from "@/lib/repositories/class-repository";
import { buildPaginationMeta } from "@/lib/pagination";
import { forbiddenError, notFoundError } from "@/lib/api-error";
import { maskPhone } from "@/lib/sensitive-mask";
import { isAdmin } from "@/lib/services/auth-utils";
import { toSnakeCaseClass } from "@/lib/services/snake-case-mappers";
import type { AuthUserResult } from "@/lib/route-auth";

type ClassRow = typeof classes.$inferSelect;
type ClassTeacherInfo = { id: string; name: string; phone: string | null };
type SnakeCaseClass = ReturnType<typeof toSnakeCaseClass>;

async function attachTeachers(
  rows: ClassRow[]
): Promise<Array<SnakeCaseClass & { teacher: ClassTeacherInfo | null }>> {
  const teacherIds = rows.map((r) => r.teacherId).filter(Boolean) as string[];
  if (teacherIds.length === 0) {
    return rows.map((r) => ({ ...toSnakeCaseClass(r), teacher: null }));
  }
  const teacherRows = await db
    .select({ id: teachers.id, name: teachers.name, phone: teachers.phone })
    .from(teachers)
    .where(inArray(teachers.id, teacherIds));
  const teacherMap = new Map(
    teacherRows.map((t) => [t.id, { id: t.id, name: t.name, phone: maskPhone(t.phone) }])
  );
  return rows.map((r) => ({
    ...toSnakeCaseClass(r),
    teacher: r.teacherId ? teacherMap.get(r.teacherId) ?? null : null,
  }));
}

export async function list(user: AuthUserResult, options: repo.ListClassesOptions) {
  if (!isAdmin(user)) {
    options.teacherId = user.userId;
  }
  if (options.isActive === undefined) {
    options.isActive = true;
  }
  const result = await repo.list(options);
  const data = await attachTeachers(result.data);
  return {
    data,
    pagination: buildPaginationMeta(options.page, options.limit, result.count),
  };
}

export async function create(
  user: AuthUserResult,
  payload: Parameters<typeof repo.create>[0]
) {
  if (!isAdmin(user)) {
    payload.teacherId = payload.teacherId ?? user.userId;
  }
  const cls = await repo.create(payload);
  const [withTeacher] = await attachTeachers([cls]);
  return withTeacher;
}

export async function findById(user: AuthUserResult, id: string) {
  const cls = await repo.findById(id);
  if (!cls) return notFoundError("班级不存在");
  if (!isAdmin(user) && cls.teacherId !== user.userId) {
    return forbiddenError("权限不足");
  }
  const [withTeacher] = await attachTeachers([cls]);
  return withTeacher;
}

export async function update(
  user: AuthUserResult,
  id: string,
  payload: Parameters<typeof repo.update>[1]
) {
  const existing = await findById(user, id);
  if (existing instanceof Response) return existing;

  // 普通教师不能将班级转给其他老师
  if (
    !isAdmin(user) &&
    payload.teacherId !== undefined &&
    payload.teacherId !== user.userId
  ) {
    return forbiddenError("不能将班级转给其他老师");
  }

  const cls = await repo.update(id, payload);
  if (!cls) return notFoundError("班级不存在");
  const [withTeacher] = await attachTeachers([cls]);
  return withTeacher;
}

export async function remove(user: AuthUserResult, id: string) {
  const existing = await findById(user, id);
  if (existing instanceof Response) return existing;
  const cls = await repo.update(id, { isActive: false });
  if (!cls) return notFoundError("班级不存在");
  const [withTeacher] = await attachTeachers([cls]);
  return withTeacher;
}
