import * as coursePromptRepo from "@/lib/repositories/course-prompt-repository";
import { sanitizeError } from "@/lib/sensitive-mask";
import type { CoursePrompt } from "@/storage/database/shared/schema";

/**
 * 根据阶段编码查询启用的课程提示词
 * @param stageCode - 阶段编码
 * @returns 课程提示词或 null
 */
export async function getCoursePromptByStageCode(
  stageCode: string
): Promise<CoursePrompt | null> {
  try {
    return await coursePromptRepo.findByStageCode(stageCode);
  } catch (error) {
    console.error("[getCoursePromptByStageCode] 查询失败:", sanitizeError(error));
    return null;
  }
}
