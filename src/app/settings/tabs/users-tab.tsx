"use client";

import { UserManagement } from "@/components/business/user-management";
import { ConfirmDialog } from "@/components/business/confirm-dialog";
import { useUsers } from "@/hooks/use-settings-data";

interface UsersTabProps {
  currentUserId?: string;
}

export function UsersTab({ currentUserId }: UsersTabProps) {
  const {
    users,
    usersLoading,
    saving,
    confirmDialog,
    setConfirmDialog,
    saveUser,
    deleteUser,
  } = useUsers();

  return (
    <>
      <UserManagement
        users={users}
        loading={usersLoading}
        saving={saving}
        currentUserId={currentUserId}
        onSave={saveUser}
        onDelete={deleteUser}
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
