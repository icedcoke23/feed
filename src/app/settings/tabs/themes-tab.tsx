"use client";

import { ThemeManagement } from "@/components/business/theme-management";
import { ConfirmDialog } from "@/components/business/confirm-dialog";
import { useThemes } from "@/hooks/use-settings-data";

export function ThemesTab() {
  const {
    themes,
    themesLoading,
    saving,
    confirmDialog,
    setConfirmDialog,
    saveTheme,
    deleteTheme,
  } = useThemes();

  return (
    <>
      <ThemeManagement
        themes={themes}
        loading={themesLoading}
        saving={saving}
        onSave={saveTheme}
        onDelete={deleteTheme}
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
