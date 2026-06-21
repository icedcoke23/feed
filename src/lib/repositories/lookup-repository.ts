import { db as database } from "@/storage/database/drizzle-client";
import { tags, teachingThemes, courseStages, teachers } from "@/storage/database/shared/schema";
import { eq, asc } from "drizzle-orm";
import type { Database } from "@/storage/database/types";

export async function listTags(db: Database = database) {
  return db.select().from(tags).orderBy(asc(tags.category), asc(tags.sortOrder), asc(tags.name));
}

export async function listThemes(db: Database = database) {
  return db.select().from(teachingThemes).orderBy(asc(teachingThemes.sortOrder), asc(teachingThemes.name));
}

export async function listCourseStages(db: Database = database) {
  return db
    .select()
    .from(courseStages)
    .orderBy(asc(courseStages.theme), asc(courseStages.level), asc(courseStages.sortOrder));
}

export async function listActiveTeachers(db: Database = database) {
  return db
    .select({ id: teachers.id, name: teachers.name, role: teachers.role })
    .from(teachers)
    .where(eq(teachers.isActive, true))
    .orderBy(asc(teachers.name));
}
