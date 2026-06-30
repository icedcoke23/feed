// 统一的 API 响应类型，覆盖成功与错误两种 wire format：
// - 成功: { data: T, message?: string }（来自 successResponse）
// - 错误: { error: string, code?: string }（来自 errorResponse）
// data 设为可选，便于客户端解析失败响应时不报类型错误。
export interface ApiResponse<T = unknown> {
  data?: T;
  message?: string;
  error?: string;
  code?: string;
}
