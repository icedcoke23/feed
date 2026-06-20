import { z } from "zod";
import { withDbError } from "@/lib/route-handlers/with-db-error";
import { withAuth } from "@/lib/route-handlers/with-auth";
import { withValidation } from "@/lib/route-handlers/with-validation";
import { successResponse } from "@/lib/api-response";
import { aiSettingService } from "@/lib/services";
import { isSafeUrlAsync } from "@/lib/ssrf-guard";
import { isMaskedKey } from "@/lib/ai-client";
import https from "https";
import http from "http";

const testSchema = z.object({
  api_key: z.string().min(1),
  base_url: z.string().url("无效的URL"),
  model_id: z.string().min(1),
  use_custom_ai: z.union([
    z.boolean(),
    z.enum(["true", "false"]).transform((v) => v === "true"),
  ]).optional().default(true),
});

export const POST = withDbError(
  withAuth(
    withValidation(
      { body: testSchema },
      async (req, { authUser, body }) => {
        const { api_key, base_url, model_id, use_custom_ai } = body as {
          api_key: string;
          base_url: string;
          model_id: string;
          use_custom_ai: boolean;
        };

        // 从数据库获取完整密钥（GET 接口返回的是掩码版本）
        const rawSettings = await aiSettingService.getRaw(authUser!);
        if (rawSettings instanceof Response) return rawSettings;

        const resolvedApiKey = api_key && !isMaskedKey(api_key)
          ? api_key
          : rawSettings?.apiKey || "";

        // 如果使用自定义 AI（第三方 AI）
        if (use_custom_ai === true && resolvedApiKey && base_url) {
          // SSRF 防护：校验 base_url
          const ssrfCheck = await isSafeUrlAsync(base_url);
          if (!ssrfCheck.safe) {
            return successResponse({
              success: false,
              message: `base_url 不安全: ${ssrfCheck.reason}`,
            });
          }

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
              const request = requestModule.request({
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
                res.on("data", (chunk) => { data += chunk; });
                res.on("end", () => {
                  clearTimeout(timeout);
                  resolve({ statusCode: res.statusCode || 500, body: data });
                });
              });
              request.on("error", (e) => { clearTimeout(timeout); reject(e); });
              request.write(aiRequestBody);
              request.end();
            });

            if (testResult.statusCode >= 200 && testResult.statusCode < 300) {
              return successResponse({
                success: true,
                message: "连接测试成功！第三方AI服务响应正常。",
              });
            }

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
          } catch (fetchError) {
            const errorMsg = fetchError instanceof Error ? fetchError.message : "网络错误";
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
        }

        return successResponse({
          success: false,
          message: "扣子AI服务暂不可用，请在系统设置中配置第三方AI参数",
        });
      }
    )
  )
);
