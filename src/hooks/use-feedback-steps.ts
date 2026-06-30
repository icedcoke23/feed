"use client";

import { useState, useCallback } from "react";
import type { GeneratedReport } from "@/types/feedback";

interface UseFeedbackStepsOptions {
  initialStep: number;
  selectedStudentId: string;
  selectedTeacherId: string;
  selectedAdminTeacherId: string;
  selectedTagsCount: number;
  generatedReport: GeneratedReport | null;
}

/**
 * 反馈表单步骤导航。
 * 从 use-feedback-form 拆分，负责：
 * - 当前步骤状态
 * - canProceed 校验（依赖各步骤的必填项）
 * - 前进/后退导航
 */
export function useFeedbackSteps({
  initialStep,
  selectedStudentId,
  selectedTeacherId,
  selectedAdminTeacherId,
  selectedTagsCount,
  generatedReport,
}: UseFeedbackStepsOptions) {
  const [currentStep, setCurrentStep] = useState(initialStep);

  const canProceed = useCallback(() => {
    switch (currentStep) {
      case 0:
        return selectedStudentId !== "";
      case 1:
        return selectedTeacherId !== "" || selectedAdminTeacherId !== "";
      case 2:
        return selectedTagsCount >= 1;
      case 3:
        return generatedReport !== null;
      default:
        return true;
    }
  }, [
    currentStep,
    selectedStudentId,
    selectedTeacherId,
    selectedAdminTeacherId,
    selectedTagsCount,
    generatedReport,
  ]);

  const handleNext = useCallback(() => {
    if (canProceed() && currentStep < 5) {
      setCurrentStep((prev) => prev + 1);
    }
  }, [canProceed, currentStep]);

  const handleBack = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  }, [currentStep]);

  return {
    currentStep,
    setCurrentStep,
    canProceed,
    handleNext,
    handleBack,
  };
}
