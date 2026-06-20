"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import type { CourseStage, Tag, Theme, AISettings, UserItem } from "@/types/settings";
import { DEFAULT_COURSE_STAGES as DEFAULT_PRESETS } from "@/lib/constants/course-stages";
import { getDefaultPrompt } from "@/lib/constants/ai";
import type { ConfirmDialogState } from "@/components/business/confirm-dialog";
import { INITIAL_CONFIRM_STATE, createConfirmState } from "@/components/business/confirm-dialog";

export function useCourseStages() {
  const [courseStages, setCourseStages] = useState<CourseStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>(INITIAL_CONFIRM_STATE);

  const fetchCourseStages = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/course-stages", { credentials: "include" });
      if (!response.ok) {
        toast.error("获取课程阶段失败");
        return;
      }
      const data = await response.json();
      setCourseStages(data.data || []);
    } catch (error) {
      console.error("Failed to fetch course stages:", error);
      toast.error("获取课程阶段失败");
    } finally {
      setLoading(false);
    }
  }, []);

  const saveCourseStage = useCallback(async (editingStage: Partial<CourseStage>, isAdding: boolean) => {
    if (!editingStage.stage_name || !editingStage.theme || !editingStage.level) {
      toast.error("请填写必填项");
      return false;
    }

    setSaving(true);
    try {
      const isNew = !editingStage.id;
      const url = isNew ? "/api/course-stages" : `/api/course-stages/${editingStage.id}`;
      const method = isNew ? "POST" : "PUT";

      const body = isNew
        ? {
            stageCode: editingStage.stage_code || `${editingStage.theme.toLowerCase()}_${editingStage.level}`,
            stageName: editingStage.stage_name,
            theme: editingStage.theme,
            level: editingStage.level,
            description: editingStage.description,
            content: editingStage.content,
            goal: editingStage.goal,
            sortOrder: editingStage.sort_order || 0,
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
        fetchCourseStages();
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
  }, [fetchCourseStages]);

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
            fetchCourseStages();
          } else {
            toast.error("删除失败");
          }
        } catch (error) {
          toast.error("删除失败");
        }
      },
    }));
  }, [fetchCourseStages]);

  const addDefaultPresets = useCallback(async () => {
    setConfirmDialog(createConfirmState({
      title: "确认添加默认预设",
      description: "确定要添加默认预设吗？这将添加Scratch/Python/C++的初阶/中阶/高阶预设。",
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, open: false }));
        setSaving(true);
        try {
          let successCount = 0;
          for (const preset of DEFAULT_PRESETS) {
            const response = await fetch("/api/course-stages", {
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
            });
            if (response.ok) successCount++;
          }
          toast.success(`成功添加 ${successCount} 个预设`);
          fetchCourseStages();
        } catch (error) {
          toast.error("添加预设失败");
        } finally {
          setSaving(false);
        }
      },
    }));
  }, [fetchCourseStages]);

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
            fetchCourseStages();
          } else {
            const error = await response.json();
            toast.error(error.error || "重置失败");
          }
        } catch (error) {
          toast.error("重置失败");
        } finally {
          setSaving(false);
        }
      },
    }));
  }, [fetchCourseStages]);

  return {
    courseStages,
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

export function useTags() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [tagsLoading, setTagsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>(INITIAL_CONFIRM_STATE);

  const fetchTags = useCallback(async () => {
    setTagsLoading(true);
    try {
      const response = await fetch("/api/tags", { credentials: "include" });
      if (!response.ok) {
        toast.error("获取标签失败");
        return;
      }
      const data = await response.json();
      setTags(data.data || []);
    } catch (error) {
      console.error("Failed to fetch tags:", error);
      toast.error("获取标签失败");
    } finally {
      setTagsLoading(false);
    }
  }, []);

  const saveTag = useCallback(async (editingTag: Partial<Tag>, isAddingTag: boolean) => {
    if (!editingTag.name || !editingTag.category) {
      toast.error("请填写标签名称和分类");
      return false;
    }

    setSaving(true);
    try {
      const isNew = !editingTag.id;
      const url = isNew ? "/api/tags" : `/api/tags/${editingTag.id}`;
      const method = isNew ? "POST" : "PUT";

      const body = isNew
        ? {
            category: editingTag.category,
            name: editingTag.name,
            description: editingTag.description || "",
            sortOrder: editingTag.sort_order || 0,
          }
        : {
            category: editingTag.category,
            name: editingTag.name,
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
        fetchTags();
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
  }, [fetchTags]);

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
            fetchTags();
          } else {
            toast.error("删除失败");
          }
        } catch (error) {
          toast.error("删除失败");
        }
      },
    }));
  }, [fetchTags]);

  return {
    tags,
    tagsLoading,
    saving,
    confirmDialog,
    setConfirmDialog,
    fetchTags,
    saveTag,
    deleteTag,
  };
}

export function useThemes() {
  const [themes, setThemes] = useState<Theme[]>([]);
  const [themesLoading, setThemesLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>(INITIAL_CONFIRM_STATE);

  const fetchThemes = useCallback(async () => {
    setThemesLoading(true);
    try {
      const response = await fetch("/api/themes", { credentials: "include" });
      if (!response.ok) {
        toast.error("获取教学主题失败");
        return;
      }
      const data = await response.json();
      setThemes(data.data || []);
    } catch (error) {
      console.error("Failed to fetch themes:", error);
      toast.error("获取教学主题失败");
    } finally {
      setThemesLoading(false);
    }
  }, []);

  const saveTheme = useCallback(async (editingTheme: Partial<Theme>, isAddingTheme: boolean) => {
    if (!editingTheme.name) {
      toast.error("请填写主题名称");
      return false;
    }

    setSaving(true);
    try {
      const isNew = !editingTheme.id;
      const url = isNew ? "/api/themes" : `/api/themes/${editingTheme.id}`;
      const method = isNew ? "POST" : "PUT";

      const body = isNew
        ? {
            name: editingTheme.name,
            category: editingTheme.category || "default",
            description: editingTheme.description || "",
            sortOrder: editingTheme.sort_order || 0,
          }
        : {
            name: editingTheme.name,
            category: editingTheme.category,
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
        fetchThemes();
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
  }, [fetchThemes]);

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
            fetchThemes();
          } else {
            toast.error("删除失败");
          }
        } catch (error) {
          toast.error("删除失败");
        }
      },
    }));
  }, [fetchThemes]);

  return {
    themes,
    themesLoading,
    saving,
    confirmDialog,
    setConfirmDialog,
    fetchThemes,
    saveTheme,
    deleteTheme,
  };
}

export function useAISettings() {
  const [aiSettings, setAiSettings] = useState<AISettings>({
    api_key: "",
    base_url: "",
    model_id: "",
    max_concurrent: "5",
    system_prompt: "",
    use_custom_ai: "false",
  });
  const [aiSettingsLoading, setAiSettingsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>(INITIAL_CONFIRM_STATE);

  const fetchAISettings = useCallback(async () => {
    setAiSettingsLoading(true);
    try {
      const response = await fetch("/api/ai-settings", { credentials: "include" });
      if (!response.ok) {
        toast.error("获取AI设置失败");
        return;
      }
      const data = await response.json();
      const settings = data.data;
      setAiSettings({
        api_key: settings?.api_key || "",
        base_url: settings?.base_url || "",
        model_id: settings?.model_id || "",
        max_concurrent: settings?.max_concurrent || "5",
        system_prompt: settings?.system_prompt || "",
        use_custom_ai: settings?.use_custom_ai || "false",
      });
    } catch (error) {
      console.error("Failed to fetch AI settings:", error);
      toast.error("获取AI设置失败");
    } finally {
      setAiSettingsLoading(false);
    }
  }, []);

  const saveAISettings = useCallback(async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/ai-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(aiSettings),
      });

      if (response.ok) {
        toast.success("AI设置保存成功");
      } else {
        toast.error("保存失败");
      }
    } catch (error) {
      console.error("Failed to save AI settings:", error);
      toast.error("保存失败");
    } finally {
      setSaving(false);
    }
  }, [aiSettings]);

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
        try {
          const defaultPrompt = getDefaultPrompt();

          // 更新本地 state
          setAiSettings((prev) => ({
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
          } else {
            toast.error("重置提示词失败，保存到数据库时出错");
          }
        } catch (error) {
          console.error("Reset prompt error:", error);
          toast.error("重置提示词失败");
        }
      },
    }));
  }, []);

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

export function useUsers(userRole?: string) {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>(INITIAL_CONFIRM_STATE);

  const fetchUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const response = await fetch("/api/users", { credentials: "include" });
      if (!response.ok) {
        toast.error("获取用户列表失败");
        return;
      }
      const data = await response.json();
      setUsers(data.data || []);
    } catch (error) {
      console.error("Failed to fetch users:", error);
      toast.error("获取用户列表失败");
    } finally {
      setUsersLoading(false);
    }
  }, []);

  const saveUser = useCallback(async (editingUser: Partial<UserItem>, isAddingUser: boolean) => {
    if (!editingUser.username || !editingUser.name) {
      toast.error("请填写用户名和姓名");
      return false;
    }

    if (isAddingUser && !editingUser.password) {
      toast.error("请设置初始密码");
      return false;
    }

    setSaving(true);
    try {
      const isNew = !editingUser.id;
      const url = isNew ? "/api/users" : `/api/users/${editingUser.id}`;
      const method = isNew ? "POST" : "PUT";

      const body = isNew
        ? {
            username: editingUser.username,
            password: editingUser.password,
            name: editingUser.name,
            role: editingUser.role || "teacher",
            teacherRole: editingUser.teacherRole,
            phone: editingUser.phone || "",
          }
        : {
            name: editingUser.name,
            role: editingUser.role,
            teacherRole: editingUser.teacherRole,
            phone: editingUser.phone || "",
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
        fetchUsers();
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
  }, [fetchUsers]);

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
            fetchUsers();
          } else {
            const error = await response.json();
            toast.error(error.error || "删除失败");
          }
        } catch (error) {
          toast.error("删除失败");
        }
      },
    }));
  }, [fetchUsers]);

  return {
    users,
    usersLoading,
    saving,
    confirmDialog,
    setConfirmDialog,
    fetchUsers,
    saveUser,
    deleteUser,
  };
}
