import { NextRequest } from "next/server";
import { z } from "zod";
import { validateInput } from "@/lib/validations";
import { isSafeUrlAsync } from "@/lib/ssrf-guard";
import https from "https";
import http from "http";
import { getAuthUser } from "@/lib/route-auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import * as aiSettingService from "@/lib/services/ai-setting-service";
import { enforceRateLimit } from "@/lib/rate-limit";

const testSchema = z.object({
  api_key: z.string().min(1),
  base_url: z.string().url("无效的URL"),
  model_id: z.string().min(1),
  use_custom_ai: z.union([
    z.boolean(),
    z.enum(["true", "false"]).transform((v) => v === "true"),
  ]).optional().default(true),
});

// 判断是否为掩码格式的密钥
function isMaskedKey(key: string): boolean {
  return key.includes("****");
}

// POST /api/ai-settings/test - 测试AI连接
export async function POST(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return errorResponse("未授权访问", 401);
  }

  // AI 连接测试限流：每用户每分钟 3 次（外部请求，有 15s 超时）
  const limited = enforceRateLimit(`ai-test:${authUser.userId}`, 3, 60_000);
  if (limited) return limited;

  try {
    const body = await request.json();

    // 校验输入
    const result = validateInput(testSchema, body);
    if ("error" in result) {
      const errorBody = await result.error.clone().json();
      return successResponse({
        success: false,
        message: `请求参数错误: ${errorBody?.error || "输入数据格式错误"}`,
      });
    }
    const { api_key, base_url, model_id, use_custom_ai } = result.data;

    // 从数据库获取完整密钥（GET接口返回的是掩码版本）
    const rawSettings = await aiSettingService.getRaw(authUser);
    if (rawSettings instanceof Response) {
      return rawSettings;
    }

    const resolvedApiKey = api_key && !isMaskedKey(api_key)
      ? api_key  // 前端传入的新密钥
      : rawSettings?.apiKey || "";  // 使用数据库中的密钥

    // 如果使用自定义AI（第三方AI）
    if (use_custom_ai === true && resolvedApiKey && base_url) {
      // SSRF 防护：校验 base_url
      const ssrfCheck = await isSafeUrlAsync(base_url);
      if (!ssrfCheck.safe) {
        return successResponse({
          success: false,
          message: `base_url 不安全: ${ssrfCheck.reason}`,
        });
      }

      // 使用原生 http/https 模块测试第三方AI连接
      try {
        const normalizedBaseUrl = base_url.replace(/\/+$/, "");
        const aiUrl = new URL(`${normalizedBaseUrl}/chat/completions`);
        const isHttps = aiUrl.protocol === "https:";
        const requestModule = isHttps ? https : http;

        const aiRequestBody = JSON.stringify({
          model: model_id || "gpt-3.5-turbo",
          messages: [{ role: "user", content: "Hello, this is a test message." }],
          max_tokens: 10,
        });

        const testResult = await new Promise<{ statusCode: number; body: string }>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error("连接超时")), 15000);
          const req = requestModule.request({
            hostname: aiUrl.hostname,
            port: aiUrl.port || (isHttps ? 443 : 80),
            path: aiUrl.pathname + aiUrl.search,
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${resolvedApiKey}`,
              "Content-Length": Buffer.byteLength(aiRequestBody),
            },
          }, (res) => {
            let data = "";
            res.on("data", c => data += c);
            res.on("end", () => {
              clearTimeout(timeout);
              resolve({ statusCode: res.statusCode || 500, body: data });
            });
          });
          req.on("error", (e) => { clearTimeout(timeout); reject(e); });
          req.write(aiRequestBody);
          req.end();
        });

        if (testResult.statusCode >= 200 && testResult.statusCode < 300) {
          return successResponse({
            success: true,
            message: "连接测试成功！第三方AI服务响应正常。",
          });
        } else {
          let errorDetail = "";
          try {
            const errorData = JSON.parse(testResult.body);
            errorDetail = errorData.error?.message || errorData.message || testResult.body.substring(0, 200);
          } catch {
            errorDetail = testResult.body.substring(0, 200);
          }
          return successResponse({
            success: false,
            message: `连接失败: ${testResult.statusCode}`,
            error: errorDetail,
          });
        }
      } catch (fetchError) {
        const errorMsg = fetchError instanceof Error ? fetchError.message : "网络错误";
        // 脱敏：移除错误消息中可能包含的 URL
        const sanitizedMsg = errorMsg.replace(/https?:\/\/[^\s]+/gi, "[URL]");

        if (sanitizedMsg.includes("ENOTFOUND")) {
          return successResponse({
            success: false,
            message: "连接失败: 无法访问API地址，请检查网络或URL是否正确",
            error: errorMsg,
          });
        }

        return successResponse({
          success: false,
          message: `连接失败: ${errorMsg}`,
          error: errorMsg,
        });
      }
    } else {
      // 扣子AI未配置，请使用第三方AI
      return successResponse({
        success: false,
        message: "扣子AI服务暂不可用，请在系统设置中配置第三方AI参数",
      });
    }
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : "未知错误";
    const sanitizedMessage = rawMessage.replace(/https?:\/\/[^\s]+/gi, "[URL]");
    return successResponse({
      success: false,
      message: `测试失败: ${sanitizedMessage}`,
    });
  }
}
