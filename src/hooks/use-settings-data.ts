"use client";

import { useState, useCallback, useMemo } from "react";
import useSWR, { mutate as globalMutate } from "swr";
import { toast } from "sonner";
import type { CourseStage, Tag, Theme, AISettings, UserItem } from "@/types/settings";
import { DEFAULT_COURSE_STAGES as DEFAULT_PRESETS } from "@/lib/constants/course-stages";
import { getDefaultPrompt } from "@/lib/constants/ai";
import type { ConfirmDialogState } from "@/components/business/confirm-dialog";
import { INITIAL_CONFIRM_STATE, createConfirmState } from "@/components/business/confirm-dialog";
import { fetcher, COURSE_STAGES_KEY, TAGS_KEY, THEMES_KEY, AI_SETTINGS_KEY, USERS_KEY } from "@/lib/swr";
import {
  courseStageFormSchema,
  tagFormSchema,
  themeFormSchema,
  validateUserForm,
  firstZodError,
} from "@/lib/validations/client";

// ============ useCourseStages ============

export function useCourseStages() {
  const { data: courseStages, isLoading: loading, mutate } = useSWR<CourseStage[]>(COURSE_STAGES_KEY, fetcher);
  const [saving, setSaving] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>(INITIAL_CONFIRM_STATE);

  const fetchCourseStages = useCallback(async () => {
    await mutate();
  }, [mutate]);

  const saveCourseStage = useCallback(async (editingStage: Partial<CourseStage>, isAdding: boolean) => {
    void isAdding;

    const parsed = courseStageFormSchema.safeParse(editingStage);
    if (!parsed.success) {
      toast.error(firstZodError(parsed.error));
      return false;
    }
    const valid = parsed.data;

    setSaving(true);
    try {
      const isNew = !editingStage.id;
      const url = isNew ? "/api/course-stages" : `/api/course-stages/${editingStage.id}`;
      const method = isNew ? "POST" : "PUT";

      const body = isNew
        ? {
            stageCode: editingStage.stage_code || `${valid.theme.toLowerCase()}_${valid.level}`,
            stageName: valid.stage_name,
            theme: valid.theme,
            level: valid.level,
            description: valid.description,
            content: valid.content,
            goal: valid.goal,
            sortOrder: valid.sort_order,
          }
        : editingStage;

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      if (response.ok) {
        toast.success(isNew ? "添加成功" : "更新成功");
        mutate();
        return true;
      } else {
        const error = await response.json();
        toast.error(error.error || "保存失败");
        return false;
      }
    } catch (error) {
      console.error("Failed to save:", error);
      toast.error("保存失败");
      return false;
    } finally {
      setSaving(false);
    }
  }, [mutate]);

  const deleteCourseStage = useCallback(async (id: string) => {
    setConfirmDialog(createConfirmState({
      title: "确认删除",
      description: "确定要删除这个课程阶段吗？",
      confirmText: "确认删除",
      variant: "destructive",
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, open: false }));
        try {
          const response = await fetch(`/api/course-stages/${id}`, { method: "DELETE", credentials: "include" });
          if (response.ok) {
            toast.success("删除成功");
            mutate();
          } else {
            toast.error("删除失败");
          }
        } catch {
          toast.error("删除失败");
        }
      },
    }));
  }, [mutate]);

  const addDefaultPresets = useCallback(async () => {
    setConfirmDialog(createConfirmState({
      title: "确认添加默认预设",
      description: "确定要添加默认预设吗？这将添加Scratch/Python/C++的初阶/中阶/高阶预设。",
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, open: false }));
        setSaving(true);
        try {
          // 并行发起所有预设创建请求，单个失败不影响其他
          const results = await Promise.allSettled(
            DEFAULT_PRESETS.map((preset) =>
              fetch("/api/course-stages", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                  stageCode: preset.stage_code,
                  stageName: preset.stage_name,
                  theme: preset.theme,
                  level: preset.level,
                  description: preset.description,
                  content: preset.content,
                  goal: preset.goal,
                  sortOrder: preset.sort_order,
                }),
              }).then((res) => res.ok)
            )
          );
          const successCount = results.filter(
            (r) => r.status === "fulfilled" && r.value
          ).length;
          const failedCount = results.length - successCount;
          if (failedCount === 0) {
            toast.success(`成功添加 ${successCount} 个预设`);
          } else {
            toast.error(`添加完成：成功 ${successCount} 个，失败 ${failedCount} 个`);
          }
          mutate();
        } catch {
          toast.error("添加预设失败");
        } finally {
          setSaving(false);
        }
      },
    }));
  }, [mutate]);

  const resetToPresets = useCallback(async () => {
    setConfirmDialog(createConfirmState({
      title: "确认重置预设",
      description: "确定要重置为默认预设吗？这将删除所有现有数据并替换为最新的默认预设（包含大颗粒、BricQ、WEDO2.0、SPIKE等新课程）。",
      confirmText: "确认重置",
      variant: "destructive",
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, open: false }));
        setSaving(true);
        try {
          const response = await fetch("/api/course-stages/reset", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
          });

          if (response.ok) {
            const result = await response.json();
            toast.success(result.message || "重置成功");
            mutate();
          } else {
            const error = await response.json();
            toast.error(error.error || "重置失败");
          }
        } catch {
          toast.error("重置失败");
        } finally {
          setSaving(false);
        }
      },
    }));
  }, [mutate]);

  return {
    courseStages: courseStages || [],
    loading,
    saving,
    confirmDialog,
    setConfirmDialog,
    fetchCourseStages,
    saveCourseStage,
    deleteCourseStage,
    addDefaultPresets,
    resetToPresets,
  };
}

// ============ useTags ============

export function useTags() {
  const { data: tags, isLoading: tagsLoading, mutate } = useSWR<Tag[]>(TAGS_KEY, fetcher);
  const [saving, setSaving] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>(INITIAL_CONFIRM_STATE);

  const fetchTags = useCallback(async () => {
    await mutate();
  }, [mutate]);

  const saveTag = useCallback(async (editingTag: Partial<Tag>, isAddingTag: boolean) => {
    void isAddingTag;

    const parsed = tagFormSchema.safeParse(editingTag);
    if (!parsed.success) {
      toast.error(firstZodError(parsed.error));
      return false;
    }
    const valid = parsed.data;

    setSaving(true);
    try {
      const isNew = !editingTag.id;
      const url = isNew ? "/api/tags" : `/api/tags/${editingTag.id}`;
      const method = isNew ? "POST" : "PUT";

      const body = isNew
        ? {
            category: valid.category,
            name: valid.name,
            description: valid.description,
            sortOrder: valid.sort_order,
          }
        : {
            category: valid.category,
            name: valid.name,
            description: editingTag.description,
            sortOrder: editingTag.sort_order,
          };

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      if (response.ok) {
        toast.success(isNew ? "添加成功" : "更新成功");
        mutate();
        return true;
      } else {
        const error = await response.json();
        toast.error(error.error || "保存失败");
        return false;
      }
    } catch (error) {
      console.error("Failed to save tag:", error);
      toast.error("保存失败");
      return false;
    } finally {
      setSaving(false);
    }
  }, [mutate]);

  const deleteTag = useCallback(async (id: string) => {
    setConfirmDialog(createConfirmState({
      title: "确认删除",
      description: "确定要删除这个标签吗？",
      confirmText: "确认删除",
      variant: "destructive",
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, open: false }));
        try {
          const response = await fetch(`/api/tags/${id}`, { method: "DELETE", credentials: "include" });
          if (response.ok) {
            toast.success("删除成功");
            mutate();
          } else {
            toast.error("删除失败");
          }
        } catch {
          toast.error("删除失败");
        }
      },
    }));
  }, [mutate]);

  return {
    tags: tags || [],
    tagsLoading,
    saving,
    confirmDialog,
    setConfirmDialog,
    fetchTags,
    saveTag,
    deleteTag,
  };
}

// ============ useThemes ============

export function useThemes() {
  const { data: themes, isLoading: themesLoading, mutate } = useSWR<Theme[]>(THEMES_KEY, fetcher);
  const [saving, setSaving] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>(INITIAL_CONFIRM_STATE);

  const fetchThemes = useCallback(async () => {
    await mutate();
  }, [mutate]);

  const saveTheme = useCallback(async (editingTheme: Partial<Theme>, isAddingTheme: boolean) => {
    void isAddingTheme;

    // theme 编辑时 category 可能为空，使用 default 兜底
    const parsed = themeFormSchema.safeParse({
      ...editingTheme,
      category: editingTheme.category || "default",
    });
    if (!parsed.success) {
      toast.error(firstZodError(parsed.error));
      return false;
    }
    const valid = parsed.data;

    setSaving(true);
    try {
      const isNew = !editingTheme.id;
      const url = isNew ? "/api/themes" : `/api/themes/${editingTheme.id}`;
      const method = isNew ? "POST" : "PUT";

      const body = isNew
        ? {
            name: valid.name,
            category: valid.category,
            description: valid.description,
            sortOrder: valid.sort_order,
          }
        : {
            name: valid.name,
            category: valid.category,
            description: editingTheme.description,
            sortOrder: editingTheme.sort_order,
          };

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      if (response.ok) {
        toast.success(isNew ? "添加成功" : "更新成功");
        mutate();
        return true;
      } else {
        const error = await response.json();
        toast.error(error.error || "保存失败");
        return false;
      }
    } catch (error) {
      console.error("Failed to save theme:", error);
      toast.error("保存失败");
      return false;
    } finally {
      setSaving(false);
    }
  }, [mutate]);

  const deleteTheme = useCallback(async (id: string) => {
    setConfirmDialog(createConfirmState({
      title: "确认删除",
      description: "确定要删除这个教学主题吗？",
      confirmText: "确认删除",
      variant: "destructive",
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, open: false }));
        try {
          const response = await fetch(`/api/themes/${id}`, { method: "DELETE", credentials: "include" });
          if (response.ok) {
            toast.success("删除成功");
            mutate();
          } else {
            toast.error("删除失败");
          }
        } catch {
          toast.error("删除失败");
        }
      },
    }));
  }, [mutate]);

  return {
    themes: themes || [],
    themesLoading,
    saving,
    confirmDialog,
    setConfirmDialog,
    fetchThemes,
    saveTheme,
    deleteTheme,
  };
}

// ============ useAISettings ============

export function useAISettings() {
  const { data: aiSettingsData, isLoading: aiSettingsLoading, mutate } = useSWR<AISettings>(AI_SETTINGS_KEY, fetcher);
  const [saving, setSaving] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>(INITIAL_CONFIRM_STATE);

  const aiSettings = useMemo<AISettings>(() => aiSettingsData || {
    api_key: "",
    base_url: "",
    model_id: "",
    max_concurrent: "5",
    system_prompt: "",
    use_custom_ai: "false",
  }, [aiSettingsData]);

  const setAiSettings = useCallback((updater: AISettings | ((prev: AISettings) => AISettings)) => {
    const next = typeof updater === "function" ? updater(aiSettings) : updater;
    mutate(next, { revalidate: false });
  }, [aiSettings, mutate]);

  const fetchAISettings = useCallback(async () => {
    await mutate();
  }, [mutate]);

  const saveAISettings = useCallback(async () => {
    setSaving(true);
    // 记录乐观更新前的值，便于失败时回滚
    const prevSettings = aiSettings;
    try {
      const response = await fetch("/api/ai-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(aiSettings),
      });

      if (response.ok) {
        toast.success("AI设置保存成功");
        mutate();
      } else {
        // 乐观回滚：恢复到保存前的状态
        mutate(prevSettings, { revalidate: false });
        toast.error("保存失败");
      }
    } catch (error) {
      // 网络异常同样回滚
      mutate(prevSettings, { revalidate: false });
      console.error("Failed to save AI settings:", error);
      toast.error("保存失败");
    } finally {
      setSaving(false);
    }
  }, [aiSettings, mutate]);

  const testConnection = useCallback(async () => {
    setTestingConnection(true);
    try {
      const response = await fetch("/api/ai-settings/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          api_key: aiSettings.api_key,
          base_url: aiSettings.base_url,
          model_id: aiSettings.model_id,
          use_custom_ai: aiSettings.use_custom_ai === "true",
        }),
      });

      const contentType = response.headers.get("content-type") || "";
      let result;

      if (!response.ok) {
        if (contentType.includes("application/json")) {
          result = await response.json();
        } else {
          result = { data: { success: false, message: "连接测试失败", error: `HTTP ${response.status}` } };
        }
      } else if (contentType.includes("application/json")) {
        result = await response.json();
      } else {
        const text = await response.text();
        result = {
          data: {
            success: false,
            message: "服务器返回了非预期的响应",
            error: text.substring(0, 200),
          },
        };
      }

      const testData = result.data;
      if (testData?.success) {
        toast.success(testData.message || "连接测试成功");
      } else {
        toast.error(testData?.message || "连接测试失败", {
          description: testData?.error || "",
        });
      }
    } catch (error) {
      console.error("Test connection error:", error);
      const errorMsg = error instanceof Error ? error.message : "未知错误";
      toast.error("连接测试失败", {
        description: errorMsg,
      });
    } finally {
      setTestingConnection(false);
    }
  }, [aiSettings]);

  const resetPrompt = useCallback(async () => {
    setConfirmDialog(createConfirmState({
      title: "确认重置提示词",
      description: "确定要重置提示词为默认值吗？当前的自定义提示词将被覆盖。",
      confirmText: "确认重置",
      variant: "destructive",
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, open: false }));
        // 记录乐观更新前的值，便于失败时回滚
        const prevSettings = aiSettings;
        try {
          const defaultPrompt = getDefaultPrompt();

          // 更新本地 state
          setAiSettings((prev: AISettings) => ({
            ...prev,
            system_prompt: defaultPrompt,
          }));

          // 保存默认值到数据库
          const response = await fetch("/api/ai-settings", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ system_prompt: defaultPrompt }),
          });

          if (response.ok) {
            toast.success("提示词已重置为默认值");
            mutate();
          } else {
            // 乐观回滚：恢复到重置前的提示词
            mutate(prevSettings, { revalidate: false });
            toast.error("重置提示词失败，保存到数据库时出错");
          }
        } catch (error) {
          // 网络异常同样回滚
          mutate(prevSettings, { revalidate: false });
          console.error("Reset prompt error:", error);
          toast.error("重置提示词失败");
        }
      },
    }));
  }, [aiSettings, setAiSettings, mutate]);

  return {
    aiSettings,
    setAiSettings,
    aiSettingsLoading,
    saving,
    testingConnection,
    confirmDialog,
    setConfirmDialog,
    fetchAISettings,
    saveAISettings,
    testConnection,
    resetPrompt,
  };
}

// ============ useUsers ============

export function useUsers() {
  const { data: users, isLoading: usersLoading, mutate } = useSWR<UserItem[]>(USERS_KEY, fetcher);
  const [saving, setSaving] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>(INITIAL_CONFIRM_STATE);

  const fetchUsers = useCallback(async () => {
    await mutate();
  }, [mutate]);

  const saveUser = useCallback(async (editingUser: Partial<UserItem>, isAddingUser: boolean) => {
    const parsed = validateUserForm(editingUser, isAddingUser);
    if (!parsed.success) {
      toast.error(firstZodError(parsed.error));
      return false;
    }
    const valid = parsed.data;

    setSaving(true);
    try {
      const isNew = !editingUser.id;
      const url = isNew ? "/api/users" : `/api/users/${editingUser.id}`;
      const method = isNew ? "POST" : "PUT";

      const body = isNew
        ? {
            username: valid.username,
            password: valid.password,
            name: valid.name,
            role: editingUser.role || "teacher",
            teacherRole: editingUser.teacherRole,
            phone: valid.phone || "",
          }
        : {
            name: valid.name,
            role: editingUser.role,
            teacherRole: editingUser.teacherRole,
            phone: valid.phone || "",
            password: editingUser.password,
          };

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      if (response.ok) {
        toast.success(isNew ? "添加成功" : "更新成功");
        mutate();
        return true;
      } else {
        const error = await response.json();
        toast.error(error.error || "保存失败");
        return false;
      }
    } catch (error) {
      console.error("Failed to save user:", error);
      toast.error("保存失败");
      return false;
    } finally {
      setSaving(false);
    }
  }, [mutate]);

  const deleteUser = useCallback(async (id: string) => {
    setConfirmDialog(createConfirmState({
      title: "确认删除",
      description: "确定要删除这个用户吗？",
      confirmText: "确认删除",
      variant: "destructive",
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, open: false }));
        try {
          const response = await fetch(`/api/users/${id}`, { method: "DELETE", credentials: "include" });
          if (response.ok) {
            toast.success("删除成功");
            mutate();
          } else {
            const error = await response.json();
            toast.error(error.error || "删除失败");
          }
        } catch {
          toast.error("删除失败");
        }
      },
    }));
  }, [mutate]);

  return {
    users: users || [],
    usersLoading,
    saving,
    confirmDialog,
    setConfirmDialog,
    fetchUsers,
    saveUser,
    deleteUser,
  };
}

// Re-export for consumers using globalMutate
export { globalMutate };
