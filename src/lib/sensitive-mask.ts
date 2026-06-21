/**
 * 敏感信息脱敏工具
 * 统一处理手机号、邮箱、API Key、URL 等敏感字段，避免在 API 响应中泄露。
 */

/** 手机号脱敏：保留前3位和后4位，中间用 **** 替代 */
export function maskPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const cleaned = phone.trim();
  if (cleaned.length < 7) return cleaned;
  return `${cleaned.slice(0, 3)}****${cleaned.slice(-4)}`;
}

/** 邮箱脱敏：保留邮箱名首末字符和域名 */
export function maskEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const [localPart, domain] = email.split("@");
  if (!domain) return email;
  if (localPart.length <= 2) return `*@${domain}`;
  return `${localPart[0]}${"*".repeat(localPart.length - 2)}${localPart.slice(-1)}@${domain}`;
}

/** API Key 脱敏：保留前4位和后3位，中间用 * 替代 */
export function maskApiKey(key: string | null | undefined): string | null {
  if (!key) return null;
  if (key.length <= 8) return "****";
  return `${key.slice(0, 4)}${"*".repeat(key.length - 7)}${key.slice(-3)}`;
}

/** URL 脱敏：只保留协议和主机名，路径和查询参数用 /... 替代 */
export function maskUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}/...`;
  } catch {
    return url.length > 12 ? `${url.slice(0, 12)}...` : url;
  }
}

/** 通用文本脱敏：移除或替换常见的敏感模式 */
export function sanitizeErrorMessage(message: string): string {
  return message
    .replace(/https?:\/\/[^\s]+/gi, "[URL已隐藏]")
    .replace(/sk-[a-zA-Z0-9]{8,}/g, "[KEY已隐藏]");
}

/** 通用错误脱敏：支持 Error / string / object */
export function sanitizeError(error: unknown): string {
  if (error instanceof Error) {
    return sanitizeErrorMessage(error.message);
  }
  if (typeof error === "string") {
    return sanitizeErrorMessage(error);
  }
  if (error && typeof error === "object") {
    try {
      return sanitizeErrorMessage(JSON.stringify(error));
    } catch {
      return "[无法序列化的错误对象]";
    }
  }
  return "[未知错误]";
}
