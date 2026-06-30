import { NextRequest } from "next/server";
import { z } from "zod";
import { validateInput } from "@/lib/validations";
import { handleDbError } from "@/lib/api-error";
import { getAuthUser } from "@/lib/route-auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import { sanitizeError } from "@/lib/sensitive-mask";
import * as themeService from "@/lib/services/theme-service";
import type { TeachingTheme } from "@/storage/database/shared/schema";
import { enforceRateLimit } from "@/lib/rate-limit";

const themeItemSchema = z.object({
  name: z.string().min(1, "主题名称不能为空"),
  category: z.string().optional().default(""),
  description: z.string().optional().default(""),
});

const batchThemesSchema = z.object({
  themes: z.array(themeItemSchema).min(1, "请提供主题数据").max(100, "单次最多导入100条记录"),
});

function toThemeResponse(theme: TeachingTheme) {
  return {
    id: theme.id,
    name: theme.name,
    category: theme.category,
    description: theme.description,
    sort_order: theme.sortOrder,
    is_active: theme.isActive,
  };
}

// POST /api/themes/batch - 批量添加教学主题
export async function POST(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return errorResponse("未授权访问", 401);
  }

  // 批量添加主题限流：每用户每分钟 5 次
  const limited = enforceRateLimit(`batch-themes:${authUser.userId}`, 5, 60_000);
  if (limited) return limited;

  const body = await request.json();

  // 校验输入
  const result = validateInput(batchThemesSchema, body);
  if ("error" in result) return result.error;
  const validatedData = result.data;

  try {
    // 准备数据
    const themesData = validatedData.themes.map((t, index: number) => ({
      name: t.name,
      category: t.category || "",
      description: t.description || "",
      sortOrder: index + 1,
      isActive: true,
    }));

    // 批量插入
    const data = await themeService.batchCreate(authUser, themesData);
    if (data instanceof Response) {
      return data;
    }

    return successResponse(data.map(toThemeResponse), `成功添加 ${data.length} 个主题`);
  } catch (error) {
    console.error("Batch add themes error:", sanitizeError(error));
    return handleDbError(error, "批量添加主题");
  }
}
