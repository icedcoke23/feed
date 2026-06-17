import { NextRequest, NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/storage/database/supabase-client";
import { forbiddenError } from "@/lib/api-error";
import { getAuthUser } from "@/lib/route-auth";
import { errorResponse, successResponse } from "@/lib/api-response";

// 课程阶段映射
const COURSE_STAGE_MAP: Record<string, string> = {
  "小小乐高": "dk_beginner",
  "生活与科技": "dk_advanced",
  "百变工程": "dk_intermediate",
  "BQ": "bricq_foundation",
  "BricQ": "bricq_foundation",
  "wedo": "wedo_foundation",
  "WEDO2.0": "wedo_foundation",
  "Wedo": "wedo_foundation",
  "spike": "spike_intermediate",
  "SPIKE": "spike_intermediate",
  "scratch初": "scratch_beginner",
  "scratch初阶": "scratch_beginner",
  "scratch中": "scratch_intermediate",
  "scratch中阶": "scratch_intermediate",
  "scratch高": "scratch_advanced",
  "scratch高阶": "scratch_advanced",
  "scratch": "scratch_beginner",
  "python初": "python_beginner",
  "python初阶": "python_beginner",
  "python高": "python_advanced",
  "python": "python_beginner",
  "C++基础语法": "cpp_beginner",
  "C++进阶算法": "cpp_intermediate",
  "C++": "cpp_beginner",
};

interface ClassData {
  teacherName: string;
  classTime: string;
  courseName: string;
  students: string[];
}

// 解析学员名单，过滤掉(寒)和其他特殊标记的学员
function parseStudents(rawStudents: string[]): string[] {
  const validStudents: string[] = [];
  
  for (const raw of rawStudents) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    
    // 提取学员名（去掉括号标记）
    // 格式如: (高)于子航 或 (心)黄耀东 或 (寒)丁墩墩
    
    // 检查是否是(寒)学员，如果是则跳过
    if (trimmed.startsWith("(寒)")) {
      continue;
    }
    
    // 检查是否是(高)或(心)学员，这些是有效的
    const match = trimmed.match(/^\((高|心)\)(.+)$/);
    if (match) {
      validStudents.push(match[2].trim());
      continue;
    }
    
    // 其他格式的学员（如带有其他标记的），跳过
    if (trimmed.startsWith("(") && trimmed.includes(")")) {
      // 有括号但不是(高)或(心)，跳过
      continue;
    }
    
    // 没有括号的学员名，也添加（可能是纯名字）
    if (!trimmed.startsWith("(")) {
      validStudents.push(trimmed);
    }
  }
  
  return validStudents;
}

// POST /api/batch-import/classes - 批量导入班级
export async function POST(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return errorResponse("未授权访问", 401);
  }

  if (authUser.userRole !== "admin") {
    return forbiddenError("仅管理员可访问");
  }

  const client = getServerSupabaseClient();
  
  try {
    const body = await request.json();
    const { classes } = body as { classes: ClassData[] };
    
    if (!classes || !Array.isArray(classes)) {
      return errorResponse("请提供班级数据", 400);
    }
    
    const results = {
      success: true,
      classesCreated: 0,
      studentsCreated: 0,
      studentsLinked: 0,
      errors: [] as string[],
      details: [] as any[],
    };
    
    // 获取现有学员列表，避免重复创建
    const { data: existingStudents } = await client
      .from("students")
      .select("id, name");
    
    const studentMap = new Map<string, string>();
    existingStudents?.forEach((s) => {
      studentMap.set(s.name, s.id);
    });
    
    // 获取课程阶段列表
    const { data: courseStages } = await client
      .from("course_stages")
      .select("id, stage_code");
    
    const stageMap = new Map<string, string>();
    courseStages?.forEach((s) => {
      stageMap.set(s.stage_code, s.id);
    });
    
    // 动态获取教师列表，建立名称到ID的映射
    const { data: existingTeachers } = await client
      .from("teachers")
      .select("id, name");
    
    const teacherMap = new Map<string, string>();
    existingTeachers?.forEach((t) => {
      teacherMap.set(t.name, t.id);
    });
    
    // 处理每个班级
    for (const classData of classes) {
      const teacherId = teacherMap.get(classData.teacherName);
      
      if (!teacherId) {
        results.errors.push(`找不到老师: ${classData.teacherName}`);
        continue;
      }
      
      // 查找课程阶段ID
      let stageId = null;
      for (const [key, code] of Object.entries(COURSE_STAGE_MAP)) {
        if (classData.courseName.includes(key)) {
          stageId = stageMap.get(code) || null;
          break;
        }
      }
      
      // 创建班级名称
      const className = `${classData.classTime} ${classData.courseName}`;
      
      // 检查班级是否已存在
      const { data: existingClass } = await client
        .from("classes")
        .select("id")
        .eq("name", className)
        .eq("teacher_id", teacherId)
        .single();
      
      let classId: string;
      
      if (existingClass) {
        classId = existingClass.id;
      } else {
        // 创建班级
        const { data: newClass, error: classError } = await client
          .from("classes")
          .insert({
            name: className,
            teacher_id: teacherId,
            grade: classData.courseName.includes("小小乐高") ? "幼儿" : 
                   classData.courseName.includes("百变") || classData.courseName.includes("生活") ? "幼儿" :
                   classData.courseName.includes("BQ") || classData.courseName.includes("wedo") ? "小学低年级" :
                   classData.courseName.includes("spike") ? "小学中高年级" :
                   classData.courseName.includes("scratch") ? "小学" :
                   classData.courseName.includes("python") || classData.courseName.includes("C++") ? "小学高年级" : "小学",
          })
          .select("id")
          .single();
        
        if (classError) {
          results.errors.push(`创建班级失败: ${className} - ${classError.message}`);
          continue;
        }
        
        classId = newClass.id;
        results.classesCreated++;
      }
      
      // 处理学员
      const validStudents = parseStudents(classData.students);
      
      for (const studentName of validStudents) {
        if (!studentName) continue;
        
        let studentId: string;
        
        if (studentMap.has(studentName)) {
          // 学员已存在，不覆盖 class_id，而是创建 student_classes 关联
          studentId = studentMap.get(studentName)!;
          
          // 检查是否已存在该关联
          const { data: existingRelation } = await client
            .from("student_classes")
            .select("id")
            .eq("student_id", studentId)
            .eq("class_id", classId)
            .single();

          if (!existingRelation) {
            // 检查学生是否已有主班级
            const { data: primaryCheck } = await client
              .from("student_classes")
              .select("id")
              .eq("student_id", studentId)
              .eq("is_primary", true)
              .single();

            const { error: scError } = await client
              .from("student_classes")
              .insert({
                student_id: studentId,
                class_id: classId,
                is_primary: !primaryCheck, // 如果没有主班级则设为主班级
              });

            if (scError) {
              results.errors.push(`关联学员班级失败: ${studentName} - ${scError.message}`);
            } else {
              results.studentsLinked++;
            }
          }
        } else {
          // 创建新学员
          const { data: newStudent, error: studentError } = await client
            .from("students")
            .insert({
              name: studentName,
              class_id: classId,
              current_teacher_id: teacherId,
            })
            .select("id")
            .single();
          
          if (studentError) {
            results.errors.push(`创建学员失败: ${studentName} - ${studentError.message}`);
          } else {
            studentId = newStudent.id;
            studentMap.set(studentName, studentId);
            results.studentsCreated++;

            // 同时创建 student_classes 关联，第一个班级设为主班级
            const { error: scError } = await client
              .from("student_classes")
              .insert({
                student_id: studentId,
                class_id: classId,
                is_primary: true,
              });

            if (scError) {
              results.errors.push(`关联学员班级失败: ${studentName} - ${scError.message}`);
            }
          }
        }
      }
      
      results.details.push({
        className,
        teacher: classData.teacherName,
        studentsCount: validStudents.length,
      });
    }
    
    return successResponse(results);
  } catch (error) {
    console.error("Batch import error:", error);
    return errorResponse("导入失败", 500);
  }
}
