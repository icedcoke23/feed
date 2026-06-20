# API 错误响应规范

本文档说明项目 API 的统一响应格式与常见错误码。

## 统一响应格式

### 成功响应

```json
{
  "data": <T>,
  "message": "可选的提示信息"
}
```

由 `src/lib/api-response.ts` 中的 `successResponse` 生成。部分旧接口或 Service 层会直接返回 `{ data }` 对象。

### 错误响应

```json
{
  "success": false,
  "error": "人类可读的错误描述",
  "code": "ERROR_CODE",
  "status": 400
}
```

由 `src/lib/api-error.ts` 与 `src/lib/api-response.ts` 中的 `errorResponse` / `apiError` 生成。实际响应体包含 `error` 和可选的 `code`，HTTP 状态码由 `status` 体现。

## 错误码说明

| 错误码                    | HTTP 状态 | 说明               | 典型场景                                    |
| ------------------------- | --------- | ------------------ | ------------------------------------------- |
| `UNAUTHORIZED`            | 401       | 未登录或登录已过期 | 访问需要登录的接口时未携带有效 Cookie       |
| `FORBIDDEN`               | 403       | 权限不足           | 普通用户访问管理员接口                      |
| `VALIDATION_ERROR`        | 400       | 请求参数校验失败   | Zod 校验失败，响应中可能附带 `details` 字段 |
| `NOT_FOUND`               | 404       | 资源未找到         | 查询的用户/班级/学生不存在                  |
| `INTERNAL_ERROR`          | 500       | 服务器内部错误     | 未捕获的异常                                |
| `RATE_LIMITED`            | 429       | 请求过于频繁       | 登录接口同一 IP 多次失败后被限流            |
| `BAD_REQUEST`             | 400       | 请求参数错误       | 通用参数错误                                |
| `INVALID_CREDENTIALS`     | 401       | 用户名或密码错误   | 登录接口                                    |
| `PASSWORD_FORMAT_EXPIRED` | 401       | 密码格式已过期     | 旧密码未使用 bcrypt 哈希                    |
| `INVALID_PASSWORD`        | 400       | 旧密码错误         | 修改密码接口                                |
| `UNIQUE_VIOLATION`        | 409       | 记录已存在         | PostgreSQL 唯一约束冲突（code 23505）       |
| `FOREIGN_KEY_VIOLATION`   | 400       | 关联记录不存在     | PostgreSQL 外键约束冲突（code 23503）       |
| `CHECK_VIOLATION`         | 400       | 数据不满足约束     | PostgreSQL check 约束冲突（code 23514）     |

## 响应辅助函数

- `successResponse<T>(data, message?, status?)`：生成成功响应。
- `errorResponse(error, status?, code?, extra?)`：生成错误响应，可附加 `details` 等额外字段。
- `apiError(message, status?, code?)`：通用错误响应包装。
- `unauthorizedError(message?)`、`forbiddenError(message?)`、`notFoundError(message?)`、`badRequestError(message?)`：常用错误快捷函数。
- `handleDbError(error, context?)`：统一处理 PostgreSQL 错误，将错误码转换为上述业务错误码。

## 参数校验失败示例

```json
{
  "error": "请求参数错误",
  "code": "VALIDATION_ERROR",
  "details": [{ "path": "username", "message": "Required" }]
}
```
