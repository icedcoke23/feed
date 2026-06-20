import { db } from "@/storage/database/drizzle-client";
import { tags, teachingThemes, courseStages, teachers } from "@/storage/database/shared/schema";
import { eq, asc } from "drizzle-orm";

export async function listTags() {
  return db.select().from(tags).orderBy(asc(tags.category), asc(tags.sortOrder), asc(tags.name));
}

export async function listThemes() {
  return db.select().from(teachingThemes).orderBy(asc(teachingThemes.sortOrder), asc(teachingThemes.name));
}

export async function listCourseStages() {
  return db
    .select()
    .from(courseStages)
    .orderBy(asc(courseStages.theme), asc(courseStages.level), asc(courseStages.sortOrder));
}

export async function listActiveTeachers() {
  return db
    .select({ id: teachers.id, name: teachers.name, role: teachers.role })
    .from(teachers)
    .where(eq(teachers.isActive, true))
    .orderBy(asc(teachers.name));
}
