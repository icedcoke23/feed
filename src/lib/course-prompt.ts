import { SupabaseClient } from "@supabase/supabase-js";
import { CoursePrompt } from "@/types/course-prompt";

/**
 * 根据阶段编码查询启用的课程提示词
 * @param client - Supabase 客户端
 * @param stageCode - 阶段编码
 * @returns 课程提示词或 null
 */
export async function getCoursePromptByStageCode(
  client: SupabaseClient,
  stageCode: string
): Promise<CoursePrompt | null> {
  const { data, error } = await client
    .from("course_prompts")
    .select("*")
    .eq("stage_code", stageCode)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    console.error("[getCoursePromptByStageCode] 查询失败:", error.message);
    return null;
  }

  return data as CoursePrompt | null;
}
