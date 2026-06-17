import { SupabaseClient } from "@supabase/supabase-js";

/**
 * 清空所有业务数据，保留管理员用户
 *
 * 按照外键依赖顺序删除：
 * 1. 依赖学员的记录（class_transfers, feedbacks）
 * 2. 学员
 * 3. 班级
 * 4. 配置数据（teaching_themes, tags, course_stages）
 * 5. 教师记录（teachers 表中 role='teacher'）
 * 6. 教师用户（users 表中 role='teacher'，保留 admin）
 */
export async function clearAllData(client: SupabaseClient) {
  const errors: string[] = [];

  // 1. 先删除依赖学员的记录
  const transfersResult = await client
    .from("class_transfers")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");
  if (transfersResult.error) {
    errors.push(`转班记录删除失败: ${transfersResult.error.message}`);
  }

  const feedbacksResult = await client
    .from("feedbacks")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");
  if (feedbacksResult.error) {
    errors.push(`反馈记录删除失败: ${feedbacksResult.error.message}`);
  }

  // 2. 删除学员（学员依赖班级，所以先删除学员）
  const studentsResult = await client
    .from("students")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");
  if (studentsResult.error) {
    errors.push(`学员数据删除失败: ${studentsResult.error.message}`);
  }

  // 3. 删除班级
  const classesResult = await client
    .from("classes")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");
  if (classesResult.error) {
    errors.push(`班级数据删除失败: ${classesResult.error.message}`);
  }

  // 4. 删除配置数据
  const themesResult = await client
    .from("teaching_themes")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");
  if (themesResult.error) {
    errors.push(`教学主题删除失败: ${themesResult.error.message}`);
  }

  const tagsResult = await client
    .from("tags")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");
  if (tagsResult.error) {
    errors.push(`标签数据删除失败: ${tagsResult.error.message}`);
  }

  const courseStagesResult = await client
    .from("course_stages")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");
  if (courseStagesResult.error) {
    errors.push(`课程阶段删除失败: ${courseStagesResult.error.message}`);
  }

  // 5. 删除teachers表中的教师（必须在删除users之前）
  const teachersTableResult = await client
    .from("teachers")
    .delete()
    .eq("role", "teacher");
  if (teachersTableResult.error) {
    errors.push(`教师记录删除失败: ${teachersTableResult.error.message}`);
  }

  // 6. 删除教师用户（保留管理员）
  const teachersResult = await client
    .from("users")
    .delete()
    .eq("role", "teacher");
  if (teachersResult.error) {
    errors.push(`教师用户删除失败: ${teachersResult.error.message}`);
  }

  return {
    errors,
    details: {
      feedbacksDeleted: feedbacksResult.count || 0,
      transfersDeleted: transfersResult.count || 0,
      studentsDeleted: studentsResult.count || 0,
      classesDeleted: classesResult.count || 0,
      themesDeleted: themesResult.count || 0,
      tagsDeleted: tagsResult.count || 0,
      courseStagesDeleted: courseStagesResult.count || 0,
      teachersDeleted: teachersResult.count || 0,
    },
  };
}
