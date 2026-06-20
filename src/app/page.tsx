"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Upload, User } from "lucide-react";

import { useHomeData } from "@/hooks/use-home-data";
import { useStudentActions } from "@/hooks/use-student-actions";
import { useClassActions } from "@/hooks/use-class-actions";
import { useBatchAdd } from "@/hooks/use-batch-add";

import { AppHeader } from "@/components/business/app-header";
import { AppSidebar } from "@/components/business/app-sidebar";
import { StatsCards } from "@/components/business/stats-cards";
import { StudentActionBar } from "@/components/business/student-action-bar";
import { StudentList } from "@/components/business/student-list";
import { ConfirmDialog } from "@/components/business/confirm-dialog";

const AddStudentDialog = dynamic(() => import("@/components/business/add-student-dialog").then(m => ({ default: m.AddStudentDialog })), { ssr: false });
const EditStudentDialog = dynamic(() => import("@/components/business/edit-student-dialog").then(m => ({ default: m.EditStudentDialog })), { ssr: false });
const TransferStudentDialog = dynamic(() => import("@/components/business/transfer-student-dialog").then(m => ({ default: m.TransferStudentDialog })), { ssr: false });
const BatchAddDialog = dynamic(() => import("@/components/business/batch-add-dialog").then(m => ({ default: m.BatchAddDialog })), { ssr: false });
const ClassFormDialog = dynamic(() => import("@/components/business/class-form-dialog").then(m => ({ default: m.ClassFormDialog })), { ssr: false });

export default function HomePage() {
  const { logout } = useAuth();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const {
    user,
    classes,
    teachers,
    adminTeachers,
    loading,
    searchQuery,
    setSearchQuery,
    teacherFilter,
    setTeacherFilter,
    expandedClasses,
    toggleClassExpand,
    expandAllClasses,
    teachersFromClasses,
    filteredStudents,
    stats,
    fetchData,
    loadingMore,
    hasMoreStudents,
    loadMoreStudents,
  } = useHomeData();

  const studentActions = useStudentActions(fetchData, classes, teachers);
  const classActions = useClassActions(fetchData, user);
  const batchAdd = useBatchAdd(fetchData, classes);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航 */}
      <AppHeader user={user} onLogout={logout} />

      <div className="flex">
        {/* 侧边栏 */}
        <AppSidebar
          user={user}
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
          onLogout={logout}
        />

        {/* 主内容 */}
        <main className="flex-1 p-4 lg:p-8">
          <div className="max-w-7xl mx-auto">
            {/* 统计卡片 */}
            <StatsCards
              total={stats.total}
              thisMonth={stats.thisMonth}
              classes={stats.classes}
            />

            {/* 操作栏 */}
            <StudentActionBar
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              teacherFilter={teacherFilter}
              onTeacherFilterChange={setTeacherFilter}
              teachersFromClasses={teachersFromClasses}
              onExpandAll={expandAllClasses}
              onOpenAddStudent={() => studentActions.setIsAddDialogOpen(true)}
              onOpenBatchAdd={() => batchAdd.setIsBatchDialogOpen(true)}
              onOpenAddClass={classActions.handleOpenAddClass}
            />

            {/* 学员列表 */}
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <Card key={i}>
                    <CardContent className="pt-6">
                      <Skeleton className="h-6 w-24 mb-4" />
                      <Skeleton className="h-4 w-full mb-2" />
                      <Skeleton className="h-4 w-2/3 mb-4" />
                      <div className="flex gap-2">
                        <Skeleton className="h-9 flex-1" />
                        <Skeleton className="h-9 flex-1" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : filteredStudents.length === 0 && classes.length === 0 ? (
              <Card className="text-center py-16">
                <CardContent>
                  <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <User className="h-10 w-10 text-gray-400" />
                  </div>
                  <p className="text-gray-500 text-lg mb-2">
                    {searchQuery || teacherFilter !== "all" ? "未找到匹配的学员" : "暂无学员数据"}
                  </p>
                  <p className="text-gray-400 text-sm mb-4">
                    点击上方“添加学员”或“批量添加”按钮创建学员
                  </p>
                  <div className="flex gap-2 justify-center">
                    <Button onClick={() => studentActions.setIsAddDialogOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      添加学员
                    </Button>
                    <Button variant="outline" onClick={() => batchAdd.setIsBatchDialogOpen(true)}>
                      <Upload className="h-4 w-4 mr-2" />
                      批量添加
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <StudentList
                filteredStudents={filteredStudents}
                classes={classes}
                expandedClasses={expandedClasses}
                onToggleClassExpand={toggleClassExpand}
                onEditStudent={studentActions.handleOpenEdit}
                onTransferStudent={studentActions.handleOpenTransfer}
                onOpenAddStudent={() => studentActions.setIsAddDialogOpen(true)}
                onEditClass={classActions.handleOpenEditClass}
                onDeleteClass={classActions.handleDeleteClass}
                hasMoreStudents={hasMoreStudents}
                loadingMore={loadingMore}
                onLoadMore={loadMoreStudents}
              />
            )}

            {/* 对话框 */}
            <AddStudentDialog
              open={studentActions.isAddDialogOpen}
              onOpenChange={studentActions.setIsAddDialogOpen}
              formData={studentActions.newStudent}
              onFormDataChange={studentActions.setNewStudent}
              classes={classes}
              teachers={teachers}
              adminTeachers={adminTeachers}
              onSubmit={studentActions.handleAddStudent}
            />

            <EditStudentDialog
              open={studentActions.isEditDialogOpen}
              onOpenChange={studentActions.setIsEditDialogOpen}
              formData={studentActions.newStudent}
              onFormDataChange={studentActions.setNewStudent}
              classes={classes}
              teachers={teachers}
              adminTeachers={adminTeachers}
              saving={studentActions.saving}
              onSubmit={studentActions.handleSaveEdit}
            />

            <TransferStudentDialog
              open={studentActions.isTransferDialogOpen}
              onOpenChange={studentActions.setIsTransferDialogOpen}
              student={studentActions.transferringStudent}
              targetClassId={studentActions.targetClassId}
              onTargetClassIdChange={studentActions.setTargetClassId}
              classes={classes}
              transferring={studentActions.transferring}
              onSubmit={studentActions.handleTransferStudent}
            />

            <BatchAddDialog
              open={batchAdd.isBatchDialogOpen}
              onOpenChange={batchAdd.setIsBatchDialogOpen}
              batchInput={batchAdd.batchInput}
              onBatchInputChange={batchAdd.setBatchInput}
              batchClassId={batchAdd.batchClassId}
              onBatchClassIdChange={batchAdd.setBatchClassId}
              classes={classes}
              parsing={batchAdd.parsing}
              parsedStudents={batchAdd.parsedStudents}
              onClearParsed={() => batchAdd.setParsedStudents([])}
              adding={batchAdd.adding}
              onParse={batchAdd.handleParseInput}
              onBatchAdd={batchAdd.handleBatchAdd}
            />

            <ClassFormDialog
              open={classActions.isClassDialogOpen}
              onOpenChange={classActions.setIsClassDialogOpen}
              mode="add"
              formData={classActions.newClass}
              onFormDataChange={classActions.setNewClass}
              teachers={teachers}
              user={user}
              saving={classActions.savingClass}
              onSubmit={classActions.handleAddClass}
            />

            <ClassFormDialog
              open={classActions.isEditClassDialogOpen}
              onOpenChange={classActions.setIsEditClassDialogOpen}
              mode="edit"
              formData={classActions.newClass}
              onFormDataChange={classActions.setNewClass}
              teachers={teachers}
              user={user}
              saving={classActions.savingClass}
              onSubmit={classActions.handleUpdateClass}
            />

            <ConfirmDialog
              open={classActions.confirmDialog.open}
              onOpenChange={(open) => classActions.setConfirmDialog(prev => ({ ...prev, open }))}
              title={classActions.confirmDialog.title}
              description={classActions.confirmDialog.description}
              confirmText={classActions.confirmDialog.confirmText}
              variant={classActions.confirmDialog.variant}
              onConfirm={classActions.confirmDialog.onConfirm}
            />
          </div>
        </main>
      </div>
    </div>
  );
}
