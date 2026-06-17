/**
 * 判断 ai_report 是否为旧格式 JSON 元数据
 * 旧格式：以 '{' 开头的 JSON 字符串，包含 metadata 字段
 * 新格式：纯文本 Markdown
 */
export function isLegacyAiReport(aiReport: string | null): boolean {
  if (!aiReport) return false;
  if (!aiReport.startsWith("{")) return false;
  try {
    const parsed = JSON.parse(aiReport);
    return typeof parsed === "object" && parsed !== null;
  } catch {
    return false;
  }
}

/**
 * 解析 ai_report，如果是旧格式则返回 null（旧格式是元数据不应展示），否则直接返回纯文本
 */
export function parseAiReport(aiReport: string | null): string | null {
  if (!aiReport) return null;
  if (isLegacyAiReport(aiReport)) return null;
  return aiReport;
}

/**
 * 从旧格式 ai_report 中提取元数据对象
 * 如果是旧格式 JSON，返回解析后的对象；否则返回 null
 */
export function extractLegacyMetadata(aiReport: string | null): Record<string, unknown> | null {
  if (!aiReport) return null;
  try {
    const parsed = typeof aiReport === "string" ? JSON.parse(aiReport) : aiReport;
    if (typeof parsed === "object" && parsed !== null) return parsed as Record<string, unknown>;
  } catch {
    // 纯文本，不是 JSON
  }
  return null;
}
