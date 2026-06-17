## Phase 1: 安全修复（P0）

- [x] Supabase 所有表已启用 RLS，anon key 无法直接读写敏感数据
- [x] API 路由统一认证：所有受保护路由使用 getAuthUser()，未认证请求返回 401
- [x] 前端不再手动设置 x-user-id/x-user-role 请求头
- [x] 教师资源级权限隔离：教师仅能访问/操作自己班级的学员和反馈
- [x] SSRF 防护增强：DNS 解析后二次校验 IP，禁止非标准 IP 表示
- [x] XSS 防护：AI 流式对话框使用 DOMPurify 消毒后渲染
- [x] 硬编码凭据已移除：data-management.tsx 无明文密码，校区名称从设置读取
- [x] 登录接口有速率限制：同一 IP 超过 5 次/分钟返回 429

## Phase 2: 逻辑 Bug 修复（P0-P1）

- [x] 反馈创建向导完成后数据保存到数据库，关闭浏览器后可从历史记录查看
- [x] 反馈版本号使用原子更新，并发请求不会导致版本号冲突
- [x] "本月新增"统计同时比较年份和月份，去年同月数据不被误统计
- [x] 批量操作数组长度限制为 100，超长数组返回 400

## Phase 3: 数据一致性（P1）

- [x] 创建教师使用事务（RPC），users 和 teachers 表数据一致
- [x] 转班操作使用事务，不会出现转班记录已写入但学员信息未更新的情况
- [x] 所有 API 路由使用 handleDbError 处理错误，不暴露 error.message
- [x] AI 调用失败时不泄露 API Key 和 base_url
- [x] 所有列表查询过滤 is_active = true，软删除数据不出现在列表中

## Phase 4: API 设计优化（P1）

- [x] 所有 API 响应格式统一为 { data: T, message?: string }
- [x] 错误响应格式统一为 { error: string, code?: string }
- [x] 列表接口支持 page/limit 参数，返回分页元信息
- [x] 前端列表组件适配分页，大数据量时不再全量加载

## Phase 5: 前端重构（P2）

- [x] PDF 页面拆分为独立子组件，主文件不超过 300 行
- [x] 类型定义统一到 src/types/ 目录，无重复定义
- [x] 所有 confirm() 替换为 AlertDialog 组件
- [x] 所有数据获取失败时使用 toast.error 提示用户
- [x] 加载状态统一使用 Skeleton 骨架屏

## Phase 6: 清理与优化（P3）

- [x] 无硬编码 UUID 映射，batch-import 使用动态查询
- [x] data/clear 仅支持 DELETE 方法
- [x] 生产环境无 console.log/error（通过构建配置移除）
- [x] history 接口的 overall_rating 使用真实评分而非硬编码 4
- [x] 客户端专用代码（compressImage、api.ts）不在 lib 目录中
- [x] 页面 metadata 与项目实际名称匹配
