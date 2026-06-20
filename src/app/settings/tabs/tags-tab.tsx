"use client";

import { TagManagement } from "@/components/business/tag-management";
import { ConfirmDialog } from "@/components/business/confirm-dialog";
import { useTags } from "@/hooks/use-settings-data";

export function TagsTab() {
  const {
    tags,
    tagsLoading,
    saving,
    confirmDialog,
    setConfirmDialog,
    saveTag,
    deleteTag,
  } = useTags();

  return (
    <>
      <TagManagement
        tags={tags}
        loading={tagsLoading}
        saving={saving}
        onSave={saveTag}
        onDelete={deleteTag}
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
