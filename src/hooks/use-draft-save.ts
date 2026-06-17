"use client";

import { useState, useEffect, useCallback, useRef } from "react";

const DRAFT_KEY = "feedbackDraft";
const DEBOUNCE_MS = 500;

export interface DraftData {
  selectedStudentId?: string;
  selectedThemeId?: string;
  selectedTeacherId?: string;
  selectedAdminTeacherId?: string;
  feedbackDate?: string;
  tagRatings?: Record<string, unknown>;
  generatedReport?: unknown;
  hasCoursePlan?: boolean | null;
  coursePlans?: unknown[];
  currentStageId?: string | null;
  savedAt?: string;
}

export function useDraftSave(draftData: DraftData | null) {
  const [hasDraft, setHasDraft] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 检测是否存在草稿
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(DRAFT_KEY);
      setHasDraft(!!saved);
    } catch {
      setHasDraft(false);
    }
  }, []);

  // 防抖自动保存
  useEffect(() => {
    if (!draftData) return;

    const hasData =
      draftData.selectedStudentId ||
      draftData.selectedThemeId ||
      (draftData.tagRatings && Object.keys(draftData.tagRatings).length > 0) ||
      draftData.generatedReport;

    if (!hasData) return;

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      try {
        sessionStorage.setItem(
          DRAFT_KEY,
          JSON.stringify({ ...draftData, savedAt: new Date().toISOString() })
        );
        setHasDraft(true);
      } catch {
        // sessionStorage 满了或不可用
      }
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [draftData]);

  // 恢复草稿
  const restoreDraft = useCallback((): DraftData | null => {
    try {
      const saved = sessionStorage.getItem(DRAFT_KEY);
      if (!saved) return null;
      return JSON.parse(saved) as DraftData;
    } catch {
      return null;
    }
  }, []);

  // 清除草稿
  const clearDraft = useCallback(() => {
    try {
      sessionStorage.removeItem(DRAFT_KEY);
      setHasDraft(false);
    } catch {
      // ignore
    }
  }, []);

  return { hasDraft, restoreDraft, clearDraft };
}
