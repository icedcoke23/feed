# 教学反馈系统长期开发计划

> **核心目标**：将系统从 Supabase 全面迁移到本地 PostgreSQL + Drizzle ORM，统一架构分层，消除技术债，提升性能与可维护性。
>
> **执行原则**：以最佳质量为基准，每个阶段完成后必须通过 `pnpm ts-check` + `pnpm lint` + 关键功能验证。

---

## 当前架构问题概览

### 致命问题
1. **双数据访问层并存**：40 个路由用 Supabase Client（snake_case、无类型、绕过 RLS），2 个路由 + 全部 services 用 Drizzle ORM（camelCase、类型安全）
2. **抽象层完全脱节**：`route-handlers/`、`services/`、`repositories/` 三层抽象全部存在但 0 处被 API 路由使用
3. **事务边界失效**：`student-service.transfer` 等事务内调用 `repo.findById` 使用全局 db 而非 tx
4. **导入逻辑三重复 + 无事务保护**

### 严重问题
5. 前端代码重复（page.tsx ≈ client.tsx）
6. SWR 基础设施搭建但 0 处使用
7. `use-feedback-form` 700+ 行单体 Hook
8. N+1 查询（enrichStudents 5-6 次串行查询）

---

## 长期开发路线图（6 个 Phase）

### Phase 1: 数据库迁移到本地 PostgreSQL（核心，2-3 周）

**目标**：移除所有 Supabase 依赖，统一使用 Drizzle ORM + 本地 PostgreSQL。

#### 1.1 增强 Drizzle Client
- 配置连接池参数（max connections、idle timeout、connection timeout）
- 添加事务辅助函数 `withTransaction`
- 添加健康检查函数
- 添加连接事件日志

#### 1.2 移除 Supabase Client
- 删除 `src/storage/database/supabase-client.ts`
- 移除 `@supabase/supabase-js` 依赖
- 移除所有 `getServerSupabaseClient()` 调用
- 移除所有 `getSupabaseClient()` 调用

#### 1.3 修复仓储层事务边界
- 为所有仓储添加事务参数注入（参考 `user-repository` 模式）
- 确保事务内的读写使用同一事务

#### 1.4 迁移 API 路由到 services + repositories
- `/api/students/*` → `student-service`
- `/api/home-data` → `home-service`
- `/api/stats` → `stats-service`
- `/api/data/*` → `data-service`（统一导入导出，删除重复实现）
- `/api/generate`、`/api/parse` → `generate-service`、`parse-service`
- `/api/classes/*`、`/api/teachers/*`、`/api/feedbacks/*` 等 → 对应 service

#### 1.5 接入 route-handlers HOC
- 所有路由使用 `withAuth` + `withDbError` + `withValidation`
- 消除手动内联的鉴权/校验/错误处理样板代码

#### 1.6 更新环境变量
- 移除 `COZE_SUPABASE_URL`、`COZE_SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY`
- 统一使用 `DATABASE_URL`
- 更新 `.env.example`

#### 1.7 更新初始化脚本
- 废弃 `scripts/init-supabase.sql`、`scripts/init-db.js`（Supabase REST API）
- 保留 `scripts/init-db-pg.js`（pg 直连）或改为 Drizzle 迁移
- 统一使用 `drizzle-kit migrate`

#### 1.8 验证
- `pnpm ts-check` 通过
- `pnpm lint` 通过
- `pnpm build` 通过
- 关键 API 路由功能验证

---

### Phase 2: 数据层加固（1-2 周）

**目标**：保证数据一致性、完整性、安全性。

#### 2.1 统一 Schema 单一真相源
- 以 Drizzle `schema.ts` 为唯一权威
- 将 `migrate-add-indexes.sql` 中的索引合并到 Drizzle schema
- 修复 `meta/_journal.json`（0001 未记录）
- 废弃过时的初始化脚本

#### 2.2 启用死表或移除
- **决策**：启用 `feedback_items` / `feedback_ability_scores`
- 将 `feedback-service` 从读写 JSONB 改为读写独立表
- 统计 API 用 SQL 聚合

#### 2.3 应用层权限加固
- 由于本地 PostgreSQL 无 RLS，强化应用层权限检查
- 审计所有 service 的权限过滤逻辑
- 添加单元测试覆盖权限边界

#### 2.4 索引优化
- 补充缺失索引：`feedbacks.status`、`feedbacks(period_start, period_end)`、`students.is_active` 部分索引
- 验证现有索引使用情况（EXPLAIN ANALYZE）

#### 2.5 软删除策略统一
- 统一软删除字段（`is_active`）
- 确保所有查询过滤软删除记录
- 反馈表考虑软删除（保留历史）

---

### Phase 3: 前端工程化落地（2 周）

**目标**：消除代码重复，提升性能与可维护性。

#### 3.1 删除重复文件
- 删除 `app/page.tsx`、`app/settings/page.tsx`、`app/student/[id]/page.tsx`
- 保留 client 版本，或改为 Server Component 入口 + 动态导入

#### 3.2 SWR 全面落地
- 将所有手写 `useState + fetch` 迁移到 SWR
- 使用已有的 `src/lib/swr/` 基础设施
- 统一缓存键管理

#### 3.3 拆分 `use-feedback-form`
- 拆分为 `useFeedbackSteps`、`useFeedbackEdit`、`useFeedbackSave`
- 每个 Hook 控制在 200 行以内

#### 3.4 抽象通用 CRUD Hook
- 创建 `useCrud<T>(endpoint, options)` 泛型工厂
- 替换 `useCourseStages`、`useTags`、`useThemes`、`useUsers`

#### 3.5 列表组件 React.memo
- 为 `StudentCard`、`TagRatingItem`、`CoursePlanRow` 添加 memo
- 合理 props 比较

#### 3.6 跨页面状态改造
- PDF 数据传递改为 URL 参数 + 服务端查询
- 统一 `tempReportData` 存储位置

---

### Phase 4: 性能优化（1-2 周）

**目标**：消除 N+1，提升响应速度。

#### 4.1 消除 N+1 查询
- `enrichStudents`：合并 5-6 次串行查询为 2-3 次批量查询
- `/api/home-data`：使用 Drizzle `with` 关联查询
- 使用 `Promise.all` 并行化独立查询

#### 4.2 统计 API 数据库聚合
- `/api/stats` 改用 SQL `GROUP BY` + `COUNT(*) FILTER`
- 替代应用层遍历 JSONB

#### 4.3 缓存优化
- 评估是否引入 Redis（多实例部署时）
- 单实例可保留内存 LRU 缓存
- 添加缓存失效策略

#### 4.4 限流扩展
- 为 AI 生成、数据导入导出、批量操作添加限流
- 评估是否引入 Redis 限流

#### 4.5 图片存储优化
- 学员照片从 base64 改为 S3/OSS 预签名 URL
- 释放 localStorage 压力

---

### Phase 5: 工程化与可维护性（1-2 周）

**目标**：统一规范，提升代码质量。

#### 5.1 统一错误处理
- 全部使用 `apiError` 系列函数
- 废弃 `errorResponse` / `NextResponse.json` 混用

#### 5.2 结构化日志
- 替换 `console.log` 为统一 logger
- 生产环境关闭调试日志

#### 5.3 统一字段命名
- 全 camelCase（前端）+ snake_case（数据库）
- Drizzle 自动映射
- 消除 `studentId` / `student_id` 双命名兼容

#### 5.4 测试覆盖
- API 路由集成测试
- 反馈生成流程 E2E
- 权限边界测试
- 仓储层事务测试

#### 5.5 清理调试代码
- 移除所有 `console.log` 调试日志
- 统一使用 logger

---

### Phase 6: 部署与运维（1 周）

**目标**：简化部署，提升可观测性。

#### 6.1 Docker 优化
- 完善 `.dockerignore`
- 优化镜像大小（多阶段构建）
- 健康检查端点

#### 6.2 Nginx 配置
- SSE 超时配置（`proxy_read_timeout 300s`）
- 静态资源缓存
- Gzip 压缩

#### 6.3 数据库备份
- 自动化备份脚本
- 定期备份策略
- 灾难恢复演练

#### 6.4 监控告警
- 应用健康监控
- 数据库连接池监控
- 关键业务指标监控

---

## 执行顺序与依赖关系

```
Phase 1 (数据库迁移) ──┬──> Phase 2 (数据层加固) ──> Phase 4 (性能优化)
                       │
                       └──> Phase 3 (前端工程化) ──┤
                                                   │
                                                   └──> Phase 5 (工程化) ──> Phase 6 (部署运维)
```

- Phase 1 是基础，必须先完成
- Phase 2 和 Phase 3 可并行
- Phase 4 依赖 Phase 1 和 Phase 2
- Phase 5 依赖 Phase 1
- Phase 6 最后执行

---

## 验证标准

每个 Phase 完成后必须满足：
1. `pnpm ts-check` 0 错误
2. `pnpm lint` 0 错误
3. `pnpm build` 成功
4. 关键功能 E2E 测试通过
5. 无回归问题

---

## 当前执行状态

**正在进行**：Phase 1 - 数据库迁移到本地 PostgreSQL

**下一步**：增强 Drizzle Client，移除 Supabase 依赖
