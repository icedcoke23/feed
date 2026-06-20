"use client";

import { CourseStageManagement } from "@/components/business/course-stage-management";
import { ConfirmDialog } from "@/components/business/confirm-dialog";
import { useCourseStages } from "@/hooks/use-settings-data";

export function CourseStagesTab() {
  const {
    courseStages,
    loading,
    saving,
    confirmDialog,
    setConfirmDialog,
    saveCourseStage,
    deleteCourseStage,
    addDefaultPresets,
    resetToPresets,
  } = useCourseStages();

  return (
    <>
      <CourseStageManagement
        courseStages={courseStages}
        loading={loading}
        saving={saving}
        onSave={saveCourseStage}
        onDelete={deleteCourseStage}
        onAddDefaultPresets={addDefaultPresets}
        onResetToPresets={resetToPresets}
      />
      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog((prev) => ({ ...prev, open }))}
        title={confirmDialog.title}
        description={confirmDialog.description}
        confirmText={confirmDialog.confirmText}
        variant={confirmDialog.variant}
        onConfirm={confirmDialog.onConfirm}
      />
    </>
  );
}
