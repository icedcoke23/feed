import { NextRequest } from "next/server";
import { z } from "zod";
import { getAISettings, sanitizeUserInput } from "@/lib/ai-client";
import { validateInput } from "@/lib/validations";
import https from "https";
import http from "http";
import { isSafeUrlAsync } from "@/lib/ssrf-guard";
import { getAuthUser } from "@/lib/route-auth";
import { successResponse, errorResponse } from "@/lib/api-response";

const parseSchema = z.object({
  content: z.string().min(1).max(10000),
  type: z.enum(["students", "themes", "tags"]).optional(),
});

const SYSTEM_PROMPT = `你是一个数据解析助手，专门用于解析用户输入的学员信息或教学主题信息，并返回结构化的JSON数据。

## 任务说明
用户会输入一段文本，可能包含多个学员信息或多个教学主题信息。你需要：
1. 判断输入类型（students 或 themes）
2. 提取每一项的具体信息
3. 返回标准的JSON格式

## 输出格式
必须严格返回以下JSON格式，不要添加任何其他文字：

对于学员信息：
{
  "type": "students",
  "data": [
    {"name": "姓名", "grade": "年级(数字)", "className": "班级", "teacherAlias": "老师缩写", "teacherName": "老师全名"}
  ]
}

对于教学主题：
{
  "type": "themes", 
  "data": [
    {"name": "主题名称", "category": "分类", "description": "描述"}
  ]
}

## 解析规则
1. 学员信息识别：
   - 姓名：通常是2-4个字的中文人名，前面可能有括号标注老师缩写
   - 年级：数字1-12或"一年级"等中文表述
   - 班级：数字或"X班"格式
   - 老师缩写：姓名前括号中的字，如（高）、（心）
   - 老师映射规则：
     * （高）代表教务老师：燕子
     * （心）代表教务老师：心心

2. 教学主题识别：
   - 主题名称：课程或教学内容名称
   - 分类：如"科技生活"、"自然科学"等
   - 描述：对主题的简要说明

## 示例
输入："（高）张三 3年级2班, （心）李四 四年级1班, 王五 5年级3班"
输出：
{
  "type": "students",
  "data": [
    {"name": "张三", "grade": "3", "className": "2", "teacherAlias": "高", "teacherName": "燕子"},
    {"name": "李四", "grade": "4", "className": "1", "teacherAlias": "心", "teacherName": "心心"},
    {"name": "王五", "grade": "5", "className": "3", "teacherAlias": "", "teacherName": ""}
  ]
}

输入："人工智能基础 - 科技生活 - 学习AI基础知识，编程思维训练 - 计算机科学 - 培养计算思维"
输出：
{
  "type": "themes",
  "data": [
    {"name": "人工智能基础", "category": "科技生活", "description": "学习AI基础知识"},
    {"name": "编程思维训练", "category": "计算机科学", "description": "培养计算思维"}
  ]
}`;

// POST /api/parse - AI智能解析数据
export async function POST(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return errorResponse("未授权访问", 401);
  }

  const body = await request.json();
  const result = validateInput(parseSchema, body);
  if ("error" in result) return result.error;
  const { content, type } = result.data;

  // 添加类型提示
  const safeContent = sanitizeUserInput(content);
  let userMessage = safeContent;
  if (type === "students") {
    userMessage = `请解析以下学员信息：\n${safeContent}`;
  } else if (type === "themes") {
    userMessage = `请解析以下教学主题信息：\n${safeContent}`;
  }

  try {
    // 获取AI设置
    const aiSettings = await getAISettings();

    let responseText: string;

    // 判断是否使用第三方AI
    if (aiSettings?.useCustomAI && aiSettings.apiKey && aiSettings.baseUrl) {
      // SSRF 防护：校验 baseUrl
      const ssrfCheck = await isSafeUrlAsync(aiSettings.baseUrl);
      if (!ssrfCheck.safe) {
        return errorResponse(`AI 服务地址不安全: ${ssrfCheck.reason}`, 400);
      }

      // 使用原生 http/https 模块调用第三方AI（非流式）
      const aiUrl = new URL(`${aiSettings.baseUrl}/chat/completions`);
      const isHttps = aiUrl.protocol === "https:";
      const requestModule = isHttps ? https : http;

      const aiRequestBody = JSON.stringify({
        model: aiSettings.modelId || "gpt-3.5-turbo",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        temperature: 0.1,
        stream: false,
      });

      responseText = await new Promise<string>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("AI连接超时")), 30000);
        const req = requestModule.request({
          hostname: aiUrl.hostname,
          port: aiUrl.port || (isHttps ? 443 : 80),
          path: aiUrl.pathname + aiUrl.search,
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${aiSettings.apiKey}`,
            "Content-Length": Buffer.byteLength(aiRequestBody),
          },
        }, (res) => {
          let data = "";
          res.on("data", c => data += c);
          res.on("end", () => {
            clearTimeout(timeout);
            try {
              const parsed = JSON.parse(data);
              resolve(parsed.choices?.[0]?.message?.content || "");
            } catch {
              reject(new Error("AI响应解析失败"));
            }
          });
        });
        req.on("error", (e) => { clearTimeout(timeout); reject(e); });
        req.write(aiRequestBody);
        req.end();
      });
    } else {
      // 扣子AI未配置，请使用第三方AI
      return errorResponse("扣子AI服务暂不可用，请在系统设置中配置第三方AI参数", 400);
    }

    // 尝试从响应中提取JSON
    let parsedData;
    try {
      // 尝试直接解析
      parsedData = JSON.parse(responseText);
    } catch {
      // 尝试从文本中提取JSON
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("无法解析AI响应");
      }
    }

    return successResponse(parsedData);
  } catch (error) {
    console.error("Parse error:", error);
    return errorResponse("解析失败，请检查输入格式", 500);
  }
}
