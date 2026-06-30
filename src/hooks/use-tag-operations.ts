"use client";

import { useState, useMemo, useCallback } from "react";
import { toast } from "sonner";
import type { TagItem, TagRating, CategorizedTags } from "@/types/feedback";

interface UseTagOperationsOptions {
  tags: TagItem[];
  setTags: React.Dispatch<React.SetStateAction<TagItem[]>>;
}

/**
 * 标签评分与自定义标签管理。
 * 从 use-feedback-form 拆分，负责：
 * - 标签选中/取消、评分、备注
 * - 自定义标签的创建与持久化
 * - 分类标签派生（categorizedTags）
 */
export function useTagOperations({ tags, setTags }: UseTagOperationsOptions) {
  const [tagRatings, setTagRatings] = useState<Record<string, TagRating>>({});

  // 自定义标签输入状态
  const [customTagName, setCustomTagName] = useState("");
  const [customTagNote, setCustomTagNote] = useState("");
  const [customTagRating, setCustomTagRating] = useState(3);
  const [customTagCategory, setCustomTagCategory] = useState<string>("strength");
  const [addingCustomTag, setAddingCustomTag] = useState(false);

  const categorizedTags: CategorizedTags = useMemo(() => {
    return {
      strength: tags.filter((t) => t.category === "strength"),
      improvement: tags.filter((t) => t.category === "improvement"),
      weakness: tags.filter((t) => t.category === "weakness"),
    };
  }, [tags]);

  const selectedTagsCount = Object.keys(tagRatings).length;

  const toggleTag = useCallback((tagId: string) => {
    setTagRatings((prev) => {
      if (prev[tagId]) {
        const newRatings = { ...prev };
        delete newRatings[tagId];
        return newRatings;
      }
      return { ...prev, [tagId]: { rating: 3, note: "" } };
    });
  }, []);

  const updateTagRating = useCallback((tagId: string, rating: number) => {
    setTagRatings((prev) => ({ ...prev, [tagId]: { ...prev[tagId], rating } }));
  }, []);

  const updateTagNote = useCallback((tagId: string, note: string) => {
    setTagRatings((prev) => ({ ...prev, [tagId]: { ...prev[tagId], note } }));
  }, []);

  const handleAddCustomTag = useCallback(async () => {
    if (!customTagName.trim()) return;

    setAddingCustomTag(true);
    const category = customTagCategory || "strength";
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const saveResponse = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          category,
          name: customTagName,
          description: customTagNote || "",
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const savedTag = await saveResponse.json();

      if (!saveResponse.ok) {
        toast.error("保存标签失败");
        return;
      }

      if (savedTag.data) {
        setTags((prev) => [...prev, savedTag.data]);
        setTagRatings((prev) => ({
          ...prev,
          [savedTag.data.id]: {
            rating: customTagRating,
            note: customTagNote,
            isCustom: true,
            category: customTagCategory,
          },
        }));
      } else {
        const tempId = `custom-${Date.now()}`;
        setTagRatings((prev) => ({
          ...prev,
          [tempId]: {
            rating: customTagRating,
            note: customTagNote,
            isCustom: true,
            category: customTagCategory,
          },
        }));
      }

      setCustomTagName("");
      setCustomTagNote("");
      setCustomTagRating(3);
    } catch (error) {
      console.error("Failed to add custom tag:", error);
      const tempId = `custom-${Date.now()}`;
      setTagRatings((prev) => ({
        ...prev,
        [tempId]: {
          rating: customTagRating,
          note: customTagNote,
          isCustom: true,
          category: customTagCategory,
        },
      }));
      setCustomTagName("");
      setCustomTagNote("");
      setCustomTagRating(3);
    } finally {
      setAddingCustomTag(false);
    }
  }, [customTagName, customTagNote, customTagRating, customTagCategory, setTags]);

  return {
    tagRatings,
    setTagRatings,
    categorizedTags,
    selectedTagsCount,
    toggleTag,
    updateTagRating,
    updateTagNote,
    customTagName,
    setCustomTagName,
    customTagNote,
    setCustomTagNote,
    customTagRating,
    setCustomTagRating,
    customTagCategory,
    setCustomTagCategory,
    addingCustomTag,
    handleAddCustomTag,
  };
}
