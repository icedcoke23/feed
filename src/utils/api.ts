import { toast } from "sonner";

// API响应类型
export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  message?: string;
}

// API请求配置
interface RequestOptions extends RequestInit {
  showErrorToast?: boolean;
  errorMessage?: string;
}

// 统一的API请求处理函数
export async function apiRequest<T = unknown>(
  url: string,
  options: RequestOptions = {}
): Promise<{ data: T | null; error: string | null; response: Response }> {
  const { showErrorToast = true, errorMessage, ...fetchOptions } = options;

  try {
    const response = await fetch(url, {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...fetchOptions.headers,
      },
      ...fetchOptions,
    });

    // 尝试解析JSON响应
    let result: ApiResponse<T>;
    const contentType = response.headers.get("content-type");
    
    if (contentType?.includes("application/json")) {
      result = await response.json();
    } else {
      // 非JSON响应（如文件下载）
      return {
        data: null,
        error: null,
        response,
      };
    }

    // 处理错误响应
    if (!response.ok || result.error) {
      const errorMsg = result.error || result.message || errorMessage || `请求失败 (${response.status})`;
      
      if (showErrorToast) {
        toast.error(errorMsg);
      }
      
      return {
        data: null,
        error: errorMsg,
        response,
      };
    }

    return {
      data: result.data as T,
      error: null,
      response,
    };
  } catch (error) {
    const errorMsg = errorMessage || "网络请求失败，请检查网络连接";
    console.error("API request error:", error);
    
    if (showErrorToast) {
      toast.error(errorMsg);
    }
    
    return {
      data: null,
      error: errorMsg,
      response: new Response(),
    };
  }
}

// GET请求
export async function apiGet<T = unknown>(
  url: string,
  options: Omit<RequestOptions, "method" | "body"> = {}
): Promise<{ data: T | null; error: string | null }> {
  const result = await apiRequest<T>(url, { ...options, method: "GET" });
  return { data: result.data, error: result.error };
}

// POST请求
export async function apiPost<T = unknown>(
  url: string,
  body: unknown,
  options: Omit<RequestOptions, "method" | "body"> = {}
): Promise<{ data: T | null; error: string | null }> {
  const result = await apiRequest<T>(url, {
    ...options,
    method: "POST",
    body: JSON.stringify(body),
  });
  return { data: result.data, error: result.error };
}

// PUT请求
export async function apiPut<T = unknown>(
  url: string,
  body: unknown,
  options: Omit<RequestOptions, "method" | "body"> = {}
): Promise<{ data: T | null; error: string | null }> {
  const result = await apiRequest<T>(url, {
    ...options,
    method: "PUT",
    body: JSON.stringify(body),
  });
  return { data: result.data, error: result.error };
}

// DELETE请求
export async function apiDelete<T = unknown>(
  url: string,
  options: Omit<RequestOptions, "method"> = {}
): Promise<{ data: T | null; error: string | null }> {
  const result = await apiRequest<T>(url, { ...options, method: "DELETE" });
  return { data: result.data, error: result.error };
}

// 表单验证工具
export interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  message?: string;
  custom?: (value: unknown) => boolean | string;
}

export function validate(value: unknown, rules: ValidationRule[]): string | null {
  for (const rule of rules) {
    // 必填验证
    if (rule.required) {
      if (value === undefined || value === null || value === "") {
        return rule.message || "此项为必填项";
      }
    }

    // 如果值为空且非必填，跳过其他验证
    if (value === undefined || value === null || value === "") {
      continue;
    }

    // 最小长度验证
    if (rule.minLength !== undefined && typeof value === "string") {
      if (value.length < rule.minLength) {
        return rule.message || `最少需要 ${rule.minLength} 个字符`;
      }
    }

    // 最大长度验证
    if (rule.maxLength !== undefined && typeof value === "string") {
      if (value.length > rule.maxLength) {
        return rule.message || `最多允许 ${rule.maxLength} 个字符`;
      }
    }

    // 正则验证
    if (rule.pattern && typeof value === "string") {
      if (!rule.pattern.test(value)) {
        return rule.message || "格式不正确";
      }
    }

    // 自定义验证
    if (rule.custom) {
      const result = rule.custom(value);
      if (result !== true) {
        return typeof result === "string" ? result : rule.message || "验证失败";
      }
    }
  }

  return null;
}

// 常用验证规则
export const validationRules = {
  required: (message = "此项为必填项"): ValidationRule => ({
    required: true,
    message,
  }),
  
  minLength: (min: number, message?: string): ValidationRule => ({
    minLength: min,
    message: message || `最少需要 ${min} 个字符`,
  }),
  
  maxLength: (max: number, message?: string): ValidationRule => ({
    maxLength: max,
    message: message || `最多允许 ${max} 个字符`,
  }),
  
  phone: (message = "请输入正确的手机号码"): ValidationRule => ({
    pattern: /^1[3-9]\d{9}$/,
    message,
  }),
  
  email: (message = "请输入正确的邮箱地址"): ValidationRule => ({
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    message,
  }),
};
