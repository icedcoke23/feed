import { relations } from "drizzle-orm/relations";
import {
  teachers,
  students,
  classes,
  feedbacks,
  feedbackItems,
  feedbackAbilityScores,
  tags,
  classTransfers,
  studentClasses,
} from "./schema";

// 学生 -> 教师（当前教师）
export const studentsRelations = relations(students, ({ one }) => ({
  currentTeacher: one(teachers, {
    fields: [students.currentTeacherId],
    references: [teachers.id],
    relationName: "currentTeacher",
  }),
  class: one(classes, {
    fields: [students.classId],
    references: [classes.id],
  }),
  adminTeacher: one(teachers, {
    fields: [students.adminTeacherId],
    references: [teachers.id],
    relationName: "adminTeacher",
  }),
}));

// 教学反馈 -> 学生、教师
export const feedbacksRelations = relations(feedbacks, ({ one, many }) => ({
  student: one(students, {
    fields: [feedbacks.studentId],
    references: [students.id],
  }),
  teacher: one(teachers, {
    fields: [feedbacks.teacherId],
    references: [teachers.id],
  }),
  items: many(feedbackItems),
  abilityScores: many(feedbackAbilityScores),
}));

// 反馈项目 -> 反馈、标签
export const feedbackItemsRelations = relations(feedbackItems, ({ one }) => ({
  feedback: one(feedbacks, {
    fields: [feedbackItems.feedbackId],
    references: [feedbacks.id],
  }),
  tag: one(tags, {
    fields: [feedbackItems.tagId],
    references: [tags.id],
  }),
}));

// 能力评分 -> 反馈
export const feedbackAbilityScoresRelations = relations(
  feedbackAbilityScores,
  ({ one }) => ({
    feedback: one(feedbacks, {
      fields: [feedbackAbilityScores.feedbackId],
      references: [feedbacks.id],
    }),
  })
);

// 转班记录 -> 学生、教师
export const classTransfersRelations = relations(classTransfers, ({ one }) => ({
  student: one(students, {
    fields: [classTransfers.studentId],
    references: [students.id],
  }),
  fromTeacher: one(teachers, {
    fields: [classTransfers.fromTeacherId],
    references: [teachers.id],
    relationName: "fromTeacher",
  }),
  toTeacher: one(teachers, {
    fields: [classTransfers.toTeacherId],
    references: [teachers.id],
    relationName: "toTeacher",
  }),
}));

// 班级 -> 教师
export const classesRelations = relations(classes, ({ one, many }) => ({
  teacher: one(teachers, {
    fields: [classes.teacherId],
    references: [teachers.id],
  }),
  studentClasses: many(studentClasses),
}));

// 学生班级关联 -> 学生、班级
export const studentClassesRelations = relations(studentClasses, ({ one }) => ({
  student: one(students, {
    fields: [studentClasses.studentId],
    references: [students.id],
  }),
  class: one(classes, {
    fields: [studentClasses.classId],
    references: [classes.id],
  }),
}));
