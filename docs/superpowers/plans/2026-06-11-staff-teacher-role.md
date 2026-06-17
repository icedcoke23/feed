# 教务角色拆分实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 在教师中拆分教务和授课角色，前端选择教师时按角色过滤，教务老师登录后只能看到自己负责的学生。

**架构：** 保持现有双角色模型（users.role = admin | teacher），在 teachers 表中用 role 字段区分教务（"admin"）和授课（"teacher"）。API 增加 role 过滤参数，前端按角色分别显示教师列表，后端对教务老师按 admin_teacher_id 做数据隔离。

**技术栈：** Next.js 16, Supabase, Drizzle ORM, shadcn/ui

---

## 文件结构

| 文件 | 操作 | 职责 |
|------|------|------|
| `src/types/teacher.ts` | 修改 | Teacher 类型增加 role 字段 |
| `src/types/feedback.ts` | 修改 | FeedbackTeacher 类型增加 role 字段 |
| `src/types/settings.ts` | 修改 | UserItem 类型增加 teacherRole 字段 |
| `src/app/api/teachers/route.ts` | 修改 | GET 增加 role 过滤，POST 支持 role 参数 |
| `src/app/api/users/route.ts` | 修改 | 创建教师用户时支持 teacherRole |
| `src/components/business/user-management.tsx` | 修改 | 角色选择增加教务/授课子选项 |
| `src/components/business/course-plan-editor.tsx` | 修改 | 授课/教务下拉框按 role 过滤 |
| `src/components/business/add-student-dialog.tsx` | 修改 | 教务老师下拉框按 role 过滤 |
| `src/components/business/edit-student-dialog.tsx` | 修改 | 教务老师下拉框按 role 过滤 |
| `src/hooks/use-feedback-data.ts` | 修改 | 分别获取授课和教务教师列表 |
| `src/hooks/use-home-data.ts` | 修改 | 分别获取授课和教务教师列表 |
| `src/hooks/use-feedback-form.ts` | 修改 | 传入分离的教师列表 |
| `src/app/api/students/route.ts` | 修改 | 教务老师按 admin_teacher_id 过滤 |
| `src/contexts/auth-context.tsx` | 修改 | User 类型增加 teacherRole |
| `src/lib/route-auth.ts` | 修改 | getAuthUser 返回 teacherRole |

---

### 任务 1：类型定义更新

**文件：**
- 修改：`src/types/teacher.ts`
- 修改：`src/types/feedback.ts`
- 修改：`src/types/settings.ts`
- 修改：`src/contexts/auth-context.tsx`

- [ ] **步骤 1：更新 Teacher 类型**

`src/types/teacher.ts` — role 字段已有，无需修改。

- [ ] **步骤 2：更新 FeedbackTeacher 类型**

`src/types/feedback.ts` 第 39-43 行，增加 role 字段：

```typescript
export interface FeedbackTeacher {
  id: string;
  name: string;
  phone?: string;
  role?: "admin" | "teacher"; // admin=教务, teacher=授课
}
```

- [ ] **步骤 3：更新 UserItem 类型**

`src/types/settings.ts` 中 UserItem 增加 teacherRole：

```typescript
export interface UserItem {
  id: string;
  username: string;
  name: string;
  role: "admin" | "teacher";
  teacherRole?: "admin" | "teacher"; // teachers 表中的角色：admin=教务, teacher=授课
  phone?: string;
  password?: string;
}
```

- [ ] **步骤 4：更新 AuthContext User 类型**

`src/contexts/auth-context.tsx` 第 12-18 行，增加 teacherRole：

```typescript
export interface User {
  id: string;
  username: string;
  name: string;
  role: "admin" | "teacher";
  teacherRole?: "admin" | "teacher"; // teachers 表中的角色
  phone?: string;
}
```

---

### 任务 2：API 层 — 教师 API 支持 role 过滤

**文件：**
- 修改：`src/app/api/teachers/route.ts`

- [ ] **步骤 1：GET 接口增加 role 查询参数和返回 role 字段**

`src/app/api/teachers/route.ts` 第 19-48 行，修改 GET：

```typescript
export async function GET(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return errorResponse("未授权访问", 401);
  }

  const client = getServerSupabaseClient();
  const { searchParams } = new URL(request.url);
  const role = searchParams.get("role"); // "admin" | "teacher" | null(全部)
  const page = parseInt(searchParams.get("page") || "1");
  const pageSize = parseInt(searchParams.get("pageSize") || "100");

  try {
    let query = client
      .from("teachers")
      .select("id, name, phone, email, role", { count: "exact" })
      .or("is_active.eq.true,is_active.is.null")
      .order("name", { ascending: true })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (role) {
      query = query.eq("role", role);
    }

    const { data, error, count } = await query;

    if (error) {
      return errorResponse("获取教师列表失败", 500);
    }

    return successResponse({
      data,
      pagination: {
        page,
        pageSize,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / pageSize),
      },
    });
  } catch (error) {
    console.error("Failed to fetch teachers:", error);
    return errorResponse("获取教师列表失败", 500);
  }
}
```

- [ ] **步骤 2：POST 接口支持 role 参数**

`src/app/api/teachers/route.ts` POST 方法中，将硬编码的 `p_role: "teacher"` 改为从请求体读取：

找到 `p_role: "teacher"` 替换为 `p_role: body.role || "teacher"`。

---

### 任务 3：API 层 — 用户 API 返回 teacherRole

**文件：**
- 修改：`src/app/api/users/route.ts`
- 修改：`src/lib/route-auth.ts`
- 修改：`src/app/api/auth/me/route.ts`

- [ ] **步骤 1：GET /api/users 返回 teacherRole**

`src/app/api/users/route.ts` GET 方法中，查询 users 后关联查询 teachers 表获取 role：

在获取 users 数据后，对 role="teacher" 的用户，查询 teachers 表获取其 teacherRole：

```typescript
// 在 GET 方法返回数据前，为 teacher 角色用户补充 teacherRole
const teacherIds = users.filter((u: any) => u.role === "teacher").map((u: any) => u.id);
let teacherRoles: Record<string, string> = {};
if (teacherIds.length > 0) {
  const { data: teachersData } = await client
    .from("teachers")
    .select("id, role")
    .in("id", teacherIds);
  if (teachersData) {
    teacherRoles = Object.fromEntries(teachersData.map((t: any) => [t.id, t.role]));
  }
}

const enrichedUsers = users.map((u: any) => ({
  ...u,
  teacherRole: u.role === "teacher" ? (teacherRoles[u.id] || "teacher") : undefined,
}));
```

返回 `enrichedUsers` 替代 `users`。

- [ ] **步骤 2：POST /api/users 创建教师时支持 teacherRole**

在创建教师用户时，如果 `body.role === "teacher"`，将 `body.teacherRole` 传入 teachers 表的 role 字段。

找到创建 teachers 记录的位置，将 `role: "teacher"` 改为 `role: body.teacherRole || "teacher"`。

- [ ] **步骤 3：PUT /api/users 编辑用户时支持更新 teacherRole**

类似地，编辑教师用户时，如果传入了 teacherRole，更新 teachers 表的 role。

- [ ] **步骤 4：/api/auth/me 返回 teacherRole**

`src/app/api/auth/me/route.ts` 中，查询用户信息后，如果是 teacher 角色，关联查询 teachers 表获取 role：

```typescript
if (data.role === "teacher") {
  const { data: teacherData } = await client
    .from("teachers")
    .select("role")
    .eq("id", data.id)
    .single();
  if (teacherData) {
    (data as any).teacherRole = teacherData.role;
  }
}
```

- [ ] **步骤 5：getAuthUser 返回 teacherRole**

`src/lib/route-auth.ts` 中，`AuthUserResult` 增加 `teacherRole` 字段，`getAuthUser` 查询 teachers 表获取 role：

```typescript
export interface AuthUserResult {
  userId: string;
  userRole: string;
  teacherRole?: "admin" | "teacher"; // teachers 表中的角色
  newToken?: string;
}
```

在 getAuthUser 中，如果 userRole === "teacher"，查询 teachers 表：

```typescript
let teacherRole: "admin" | "teacher" | undefined;
if (payload.role === "teacher") {
  const client = getServerSupabaseClient();
  const { data: teacherData } = await client
    .from("teachers")
    .select("role")
    .eq("id", payload.userId)
    .single();
  teacherRole = (teacherData?.role as "admin" | "teacher") || "teacher";
}

return { userId: payload.userId, userRole: payload.role, teacherRole, newToken };
```

---

### 任务 4：前端 — 用户管理增加教务/授课子选项

**文件：**
- 修改：`src/components/business/user-management.tsx`

- [ ] **步骤 1：角色选择增加教务/授课子选项**

`src/components/business/user-management.tsx` 中，当选择 "teacher" 角色时，显示子选项：

找到角色选择 Select（约第 254-266 行），替换为：

```tsx
<div className="space-y-2">
  <Label>角色</Label>
  <Select
    value={editingUser.role || "teacher"}
    onValueChange={(v) => setEditingUser({ ...editingUser, role: v as "admin" | "teacher", teacherRole: v === "teacher" ? (editingUser.teacherRole || "teacher") : undefined })}
  >
    <SelectContent>
      <SelectItem value="teacher">教师</SelectItem>
      <SelectItem value="admin">管理员</SelectItem>
    </SelectContent>
  </Select>
  {editingUser.role === "teacher" && (
    <Select
      value={editingUser.teacherRole || "teacher"}
      onValueChange={(v) => setEditingUser({ ...editingUser, teacherRole: v as "admin" | "teacher" })}
    >
      <SelectContent>
        <SelectItem value="teacher">授课老师</SelectItem>
        <SelectItem value="admin">教务老师</SelectItem>
      </SelectContent>
    </Select>
  )}
</div>
```

- [ ] **步骤 2：用户列表角色显示更新**

找到角色 Badge 显示（约第 173-174 行），替换为：

```tsx
<Badge variant={userItem.role === "admin" ? "default" : "secondary"}>
  {userItem.role === "admin" ? "管理员" : userItem.teacherRole === "admin" ? "教务老师" : "授课老师"}
</Badge>
```

- [ ] **步骤 3：新增用户默认值更新**

找到 `openEditDialog` 新增用户时的默认值（约第 68 行），增加 `teacherRole: "teacher"`：

```typescript
setEditingUser({ role: "teacher", teacherRole: "teacher", ... });
```

---

### 任务 5：前端 — 课程规划界面按角色过滤教师

**文件：**
- 修改：`src/hooks/use-feedback-data.ts`
- 修改：`src/hooks/use-feedback-form.ts`
- 修改：`src/components/business/course-plan-editor.tsx`

- [ ] **步骤 1：use-feedback-data 分别获取授课和教务教师**

`src/hooks/use-feedback-data.ts` 中，将原来单一的 teachers 状态拆分为两个：

```typescript
const [teachers, setTeachers] = useState<FeedbackTeacher[]>([]);
const [adminTeachers, setAdminTeachers] = useState<FeedbackTeacher[]>([]);
```

在 fetchData 中，将原来的 `fetch("/api/teachers")` 改为两个请求：

```typescript
const [teachersRes, adminTeachersRes, tagsRes, themesRes, stagesRes] = await Promise.all([
  fetch("/api/teachers?role=teacher", { credentials: "include" }),
  fetch("/api/teachers?role=admin", { credentials: "include" }),
  fetch("/api/tags", { credentials: "include" }),
  fetch("/api/themes", { credentials: "include" }),
  fetch("/api/course-stages", { credentials: "include" }),
]);

// 检查所有响应是否成功
const responses = [teachersRes, adminTeachersRes, tagsRes, themesRes, stagesRes];
if (responses.some(r => !r.ok)) {
  toast.error("数据加载失败，请刷新页面重试");
  return;
}

const [teachersData, adminTeachersData, tagsData, themesData, stagesData] = await Promise.all([
  teachersRes.json(),
  adminTeachersRes.json(),
  tagsRes.json(),
  themesRes.json(),
  stagesRes.json(),
]);
setTeachers(teachersData.data || []);
setAdminTeachers(adminTeachersData.data || []);
```

返回值增加 `adminTeachers`：

```typescript
return {
  loading, students, setStudents, tags, setTags, themes,
  teachers, adminTeachers,
  courseStagePresets, feedbackHistory, setFeedbackHistory, fetchFeedbackHistory,
};
```

- [ ] **步骤 2：use-feedback-form 接收分离的教师列表**

`src/hooks/use-feedback-form.ts` 中，函数参数增加 `adminTeachers`：

找到参数定义，增加 `adminTeachers: FeedbackTeacher[]`。

- [ ] **步骤 3：course-plan-editor 按角色过滤**

`src/components/business/course-plan-editor.tsx` 中，props 增加 `adminTeachers`：

```typescript
interface CoursePlanEditorProps {
  // ... 现有 props
  teachers: FeedbackTeacher[];
  adminTeachers: FeedbackTeacher[];
  // ...
}
```

授课教师下拉框（约第 65-77 行）：继续使用 `teachers`（已过滤为 role=teacher）。

教务老师下拉框（约第 81-93 行）：改用 `adminTeachers`：

```tsx
<Select value={selectedAdminTeacherId} onValueChange={setSelectedAdminTeacherId}>
  <SelectTrigger className="w-48">
    <SelectValue placeholder="选择教务老师" />
  </SelectTrigger>
  <SelectContent>
    {adminTeachers.map((teacher) => (
      <SelectItem key={teacher.id} value={teacher.id}>
        {teacher.name} {teacher.phone && `(${teacher.phone})`}
      </SelectItem>
    ))}
  </SelectContent>
</Select>
```

- [ ] **步骤 4：反馈创建页面传递 adminTeachers**

`src/app/feedback/new/page.tsx` 中，从 `useFeedbackData` 解构 `adminTeachers`，传递给 `CoursePlanEditor` 和 `useFeedbackForm`。

---

### 任务 6：前端 — 学生管理界面按角色过滤教师

**文件：**
- 修改：`src/hooks/use-home-data.ts`
- 修改：`src/components/business/add-student-dialog.tsx`
- 修改：`src/components/business/edit-student-dialog.tsx`

- [ ] **步骤 1：use-home-data 分别获取授课和教务教师**

`src/hooks/use-home-data.ts` 中，增加获取教务教师列表的逻辑。

在获取 teachers 的地方，增加一个请求获取 adminTeachers：

```typescript
// 在 fetchHomeData 中，获取教师时分别获取
const [teachersRes, adminTeachersRes] = await Promise.all([
  fetch("/api/teachers?role=teacher", { credentials: "include" }),
  fetch("/api/teachers?role=admin", { credentials: "include" }),
]);
```

返回值增加 `adminTeachers`。

- [ ] **步骤 2：add-student-dialog 使用 adminTeachers**

`src/components/business/add-student-dialog.tsx` 中，props 增加 `adminTeachers: Teacher[]`。

教务老师下拉框改用 `adminTeachers`：

```tsx
<Select value={formData.adminTeacherId || "none"} onValueChange={(v) => setFormData({ ...formData, adminTeacherId: v === "none" ? "" : v })}>
  <SelectTrigger>
    <SelectValue placeholder="选择教务老师" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="none">不指定</SelectItem>
    {adminTeachers.map((teacher) => (
      <SelectItem key={teacher.id} value={teacher.id}>
        {teacher.name}
      </SelectItem>
    ))}
  </SelectContent>
</Select>
```

- [ ] **步骤 3：edit-student-dialog 使用 adminTeachers**

同上，`src/components/business/edit-student-dialog.tsx` 做相同修改。

- [ ] **步骤 4：首页传递 adminTeachers**

`src/app/page.tsx` 中，从 `useHomeData` 解构 `adminTeachers`，传递给 `AddStudentDialog` 和 `EditStudentDialog`。

---

### 任务 7：后端 — 教务老师数据隔离

**文件：**
- 修改：`src/app/api/students/route.ts`

- [ ] **步骤 1：学生列表 API 对教务老师按 admin_teacher_id 过滤**

`src/app/api/students/route.ts` GET 方法中，检查当前用户是否为教务老师，如果是，只返回 `admin_teacher_id = 自己ID` 的学生：

在获取 authUser 后，查询 teachers 表判断 teacherRole：

```typescript
const authUser = await getAuthUser(request);
if (!authUser) {
  return errorResponse("未授权访问", 401);
}

// 判断是否为教务老师
let isStaffTeacher = false;
if (authUser.userRole === "teacher") {
  const { data: teacherData } = await client
    .from("teachers")
    .select("role")
    .eq("id", authUser.userId)
    .single();
  isStaffTeacher = teacherData?.role === "admin";
}

// 构建查询
let query = client.from("students").select("*, classes(id, name, grade, teacher_id), admin_teacher:teachers!admin_teacher_id(id, name, phone)", { count: "exact" });

// 教务老师只能看到自己负责的学生
if (isStaffTeacher) {
  query = query.eq("admin_teacher_id", authUser.userId);
}
```

- [ ] **步骤 2：授课老师按 current_teacher_id 过滤（保持现有逻辑）**

确认现有逻辑中授课老师已经按 `current_teacher_id` 过滤，无需额外修改。

---

### 任务 8：前端 — AuthContext 保存 teacherRole

**文件：**
- 修改：`src/contexts/auth-context.tsx`

- [ ] **步骤 1：登录时保存 teacherRole**

`src/contexts/auth-context.tsx` login 方法中，从响应中提取 teacherRole 并保存：

```typescript
const userData = data.user as User;
if (userData.teacherRole) {
  // teacherRole 已包含在响应中
}
setUser(userData);
localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
```

- [ ] **步骤 2：/api/auth/me 验证时恢复 teacherRole**

`src/contexts/auth-context.tsx` useEffect 中，调用 `/api/auth/me` 后，更新 user 状态包含 teacherRole：

```typescript
fetch("/api/auth/me", { credentials: "include" })
  .then(res => {
    if (!res.ok) {
      setUser(null);
      localStorage.removeItem(STORAGE_KEY);
    } else {
      return res.json();
    }
  })
  .then(data => {
    if (data?.user) {
      const updatedUser = { ...parsedUser, ...data.user };
      setUser(updatedUser);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedUser));
    }
  })
  .catch(() => {});
```

---

### 任务 9：验证

- [ ] **步骤 1：重启开发服务器**

运行 `npx next dev -p 5000`，确认无编译错误。

- [ ] **步骤 2：验证用户管理**

1. 登录管理员账号
2. 进入设置 → 用户管理
3. 创建新用户，角色选择"教师"，子选项选择"教务老师"
4. 确认用户列表显示"教务老师"标签
5. 创建授课老师用户，确认显示"授课老师"标签

- [ ] **步骤 3：验证课程规划界面**

1. 进入反馈创建页面
2. 确认授课教师下拉框只显示授课老师
3. 确认教务老师下拉框只显示教务老师

- [ ] **步骤 4：验证学生管理**

1. 首页添加学生时，教务老师下拉框只显示教务老师
2. 编辑学生时同样

- [ ] **步骤 5：验证教务老师数据隔离**

1. 用教务老师账号登录
2. 确认只能看到自己负责的学生
3. 确认可以为这些学生创建反馈
