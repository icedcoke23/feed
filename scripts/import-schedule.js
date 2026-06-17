/**
 * 课表数据导入脚本
 * 
 * 从 scripts/schedule-data.json 读取解析好的课表数据，
 * 导入到 Supabase 数据库中。
 * 
 * 导入内容：
 * 1. 授课老师（users + teachers 表）
 * 2. 教务老师（users + teachers 表，role=admin）
 * 3. 班级（classes 表）
 * 4. 学生（students 表）
 * 5. 学生-班级关联（student_classes 表）
 * 6. 学生的教务老师关联（admin_teacher_id）
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const path = require('path');

// 加载 .env 文件
const envPath = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  });
}

// 读取环境变量
const SUPABASE_URL = process.env.COZE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.COZE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const DEFAULT_PASSWORD = process.env.DEFAULT_TEACHER_PASSWORD || 'teacher123';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('错误：请设置 COZE_SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY 或 COZE_SUPABASE_ANON_KEY 环境变量');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  db: { timeout: 60000 },
  auth: { autoRefreshToken: false, persistSession: false },
});

// 读取解析好的课表数据
const scheduleData = JSON.parse(fs.readFileSync('scripts/schedule-data.json', 'utf-8'));

// 教务老师配置
const ADMIN_TEACHERS = [
  { name: '心心', username: 'xinxin', email: 'xinxin@school.com' },
  { name: '燕子', username: 'yanzi', email: 'yanzi@school.com' },
  { name: '睿睿', username: 'ruirui', email: 'ruirui@school.com' },
];

// 授课老师配置
const TEACHING_TEACHERS = scheduleData.teachers.map(t => ({
  name: t.name,
  username: t.name.toLowerCase().replace(/\s+/g, ''),
  email: `${t.name.toLowerCase().replace(/\s+/g, '')}@school.com`,
}));

async function main() {
  console.log('========================================');
  console.log('课表数据导入脚本');
  console.log('========================================\n');

  const results = {
    teachersCreated: 0,
    adminTeachersCreated: 0,
    classesCreated: 0,
    studentsCreated: 0,
    studentClassesCreated: 0,
    errors: [],
  };

  // ============================================
  // Step 1: 创建 student_classes 表（如果不存在）
  // ============================================
  console.log('--- Step 1: 确保 student_classes 表存在 ---');
  // 注意：这个表需要通过 Supabase Dashboard SQL Editor 手动执行
  // 或者通过 REST API 创建。这里先检查表是否存在。
  const { error: scCheckError } = await supabase
    .from('student_classes')
    .select('id')
    .limit(1);
  
  if (scCheckError && scCheckError.message.includes('does not exist')) {
    console.error('❌ student_classes 表不存在！请先在 Supabase Dashboard SQL Editor 中执行 scripts/add-student-classes.sql');
    process.exit(1);
  } else if (scCheckError && scCheckError.code === '42P01') {
    console.error('❌ student_classes 表不存在！请先在 Supabase Dashboard SQL Editor 中执行 scripts/add-student-classes.sql');
    process.exit(1);
  }
  console.log('✅ student_classes 表已存在\n');

  // ============================================
  // Step 2: 获取现有数据
  // ============================================
  console.log('--- Step 2: 获取现有数据 ---');
  const { data: existingUsers } = await supabase.from('users').select('id, username, name, role');
  const { data: existingTeachers } = await supabase.from('teachers').select('id, name, email, role');
  const { data: existingClasses } = await supabase.from('classes').select('id, name, teacher_id');
  const { data: existingStudents } = await supabase.from('students').select('id, name, class_id, current_teacher_id, admin_teacher_id');

  const userMap = new Map(); // username -> user
  existingUsers?.forEach(u => userMap.set(u.username, u));

  const teacherMap = new Map(); // name -> teacher
  existingTeachers?.forEach(t => teacherMap.set(t.name, t));

  const classMap = new Map(); // name + teacher_id -> class
  existingClasses?.forEach(c => classMap.set(`${c.name}:${c.teacher_id}`, c));

  const studentMap = new Map(); // name -> student
  existingStudents?.forEach(s => studentMap.set(s.name, s));

  console.log(`  现有用户: ${existingUsers?.length || 0}`);
  console.log(`  现有老师: ${existingTeachers?.length || 0}`);
  console.log(`  现有班级: ${existingClasses?.length || 0}`);
  console.log(`  现有学生: ${existingStudents?.length || 0}\n`);

  // ============================================
  // Step 3: 创建教务老师（users + teachers）
  // ============================================
  console.log('--- Step 3: 创建教务老师 ---');
  const adminTeacherIdMap = new Map(); // name -> id

  for (const admin of ADMIN_TEACHERS) {
    // 检查是否已存在
    const existing = teacherMap.get(admin.name);
    if (existing) {
      adminTeacherIdMap.set(admin.name, existing.id);
      console.log(`  ⏭ 教务老师已存在: ${admin.name} (${existing.id})`);
      continue;
    }

    // 创建 users 记录
    const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);
    const { data: newUser, error: userError } = await supabase
      .from('users')
      .insert({
        username: admin.username,
        password: hashedPassword,
        name: admin.name,
        role: 'teacher',
      })
      .select('id')
      .single();

    if (userError) {
      // 可能 username 已存在，尝试查找
      if (userError.code === '23505') {
        const { data: existingUser } = await supabase
          .from('users')
          .select('id')
          .eq('username', admin.username)
          .single();
        if (existingUser) {
          // 用已有用户 ID 创建 teacher
          const { data: newTeacher, error: teacherError } = await supabase
            .from('teachers')
            .insert({
              id: existingUser.id,
              name: admin.name,
              email: admin.email,
              role: 'admin',
            })
            .select('id')
            .single();
          
          if (teacherError) {
            if (teacherError.code === '23505') {
              // teacher 也已存在
              const { data: existingT } = await supabase
                .from('teachers')
                .select('id')
                .eq('name', admin.name)
                .single();
              if (existingT) {
                adminTeacherIdMap.set(admin.name, existingT.id);
                console.log(`  ⏭ 教务老师已存在: ${admin.name} (${existingT.id})`);
                continue;
              }
            }
            results.errors.push(`创建教务老师失败: ${admin.name} - ${teacherError.message}`);
            continue;
          }
          adminTeacherIdMap.set(admin.name, newTeacher.id);
          teacherMap.set(admin.name, newTeacher);
          results.adminTeachersCreated++;
          console.log(`  ✅ 创建教务老师: ${admin.name} (${newTeacher.id})`);
          continue;
        }
      }
      results.errors.push(`创建教务老师用户失败: ${admin.name} - ${userError.message}`);
      continue;
    }

    // 创建 teachers 记录（id 与 users.id 相同）
    const { data: newTeacher, error: teacherError } = await supabase
      .from('teachers')
      .insert({
        id: newUser.id,
        name: admin.name,
        email: admin.email,
        role: 'admin',
      })
      .select('id')
      .single();

    if (teacherError) {
      results.errors.push(`创建教务老师失败: ${admin.name} - ${teacherError.message}`);
      continue;
    }

    adminTeacherIdMap.set(admin.name, newTeacher.id);
    teacherMap.set(admin.name, newTeacher);
    results.adminTeachersCreated++;
    console.log(`  ✅ 创建教务老师: ${admin.name} (${newTeacher.id})`);
  }
  console.log();

  // ============================================
  // Step 4: 创建授课老师（users + teachers）
  // ============================================
  console.log('--- Step 4: 创建授课老师 ---');
  const teachingTeacherIdMap = new Map(); // name -> id

  for (const teacher of TEACHING_TEACHERS) {
    const existing = teacherMap.get(teacher.name);
    if (existing) {
      teachingTeacherIdMap.set(teacher.name, existing.id);
      console.log(`  ⏭ 授课老师已存在: ${teacher.name} (${existing.id})`);
      continue;
    }

    // 创建 users 记录
    const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);
    const { data: newUser, error: userError } = await supabase
      .from('users')
      .insert({
        username: teacher.username,
        password: hashedPassword,
        name: teacher.name,
        role: 'teacher',
      })
      .select('id')
      .single();

    if (userError) {
      if (userError.code === '23505') {
        // username 冲突，尝试用不同 username
        const altUsername = teacher.username + '_teacher';
        const { data: altUser, error: altError } = await supabase
          .from('users')
          .insert({
            username: altUsername,
            password: hashedPassword,
            name: teacher.name,
            role: 'teacher',
          })
          .select('id')
          .single();
        
        if (altError) {
          results.errors.push(`创建授课老师用户失败: ${teacher.name} - ${altError.message}`);
          continue;
        }
        
        const { data: newTeacher, error: teacherError } = await supabase
          .from('teachers')
          .insert({
            id: altUser.id,
            name: teacher.name,
            email: teacher.email,
            role: 'teacher',
          })
          .select('id')
          .single();

        if (teacherError) {
          if (teacherError.code === '23505') {
            const { data: existingT } = await supabase
              .from('teachers')
              .select('id')
              .eq('name', teacher.name)
              .single();
            if (existingT) {
              teachingTeacherIdMap.set(teacher.name, existingT.id);
              console.log(`  ⏭ 授课老师已存在: ${teacher.name} (${existingT.id})`);
              continue;
            }
          }
          results.errors.push(`创建授课老师失败: ${teacher.name} - ${teacherError.message}`);
          continue;
        }

        teachingTeacherIdMap.set(teacher.name, newTeacher.id);
        teacherMap.set(teacher.name, newTeacher);
        results.teachersCreated++;
        console.log(`  ✅ 创建授课老师: ${teacher.name} (${newTeacher.id})`);
        continue;
      }
      results.errors.push(`创建授课老师用户失败: ${teacher.name} - ${userError.message}`);
      continue;
    }

    // 创建 teachers 记录
    const { data: newTeacher, error: teacherError } = await supabase
      .from('teachers')
      .insert({
        id: newUser.id,
        name: teacher.name,
        email: teacher.email,
        role: 'teacher',
      })
      .select('id')
      .single();

    if (teacherError) {
      if (teacherError.code === '23505') {
        const { data: existingT } = await supabase
          .from('teachers')
          .select('id')
          .eq('name', teacher.name)
          .single();
        if (existingT) {
          teachingTeacherIdMap.set(teacher.name, existingT.id);
          console.log(`  ⏭ 授课老师已存在: ${teacher.name} (${existingT.id})`);
          continue;
        }
      }
      results.errors.push(`创建授课老师失败: ${teacher.name} - ${teacherError.message}`);
      continue;
    }

    teachingTeacherIdMap.set(teacher.name, newTeacher.id);
    teacherMap.set(teacher.name, newTeacher);
    results.teachersCreated++;
    console.log(`  ✅ 创建授课老师: ${teacher.name} (${newTeacher.id})`);
  }
  console.log();

  // ============================================
  // Step 5: 创建班级
  // ============================================
  console.log('--- Step 5: 创建班级 ---');
  const classIdMap = new Map(); // className -> classId

  for (const cls of scheduleData.classes) {
    const teacherId = teachingTeacherIdMap.get(cls.teacher);
    if (!teacherId) {
      results.errors.push(`创建班级失败: 找不到老师 ${cls.teacher} (班级: ${cls.name})`);
      continue;
    }

    // 检查是否已存在
    const existingClass = classMap.get(`${cls.name}:${teacherId}`);
    if (existingClass) {
      classIdMap.set(cls.name, existingClass.id);
      console.log(`  ⏭ 班级已存在: ${cls.name}`);
      continue;
    }

    // 推断年级
    const grade = cls.course.includes('小小乐高') ? '幼儿' :
      cls.course.includes('百变') || cls.course.includes('生活') ? '幼儿' :
      cls.course.includes('BQ') || cls.course.includes('wedo') || cls.course.includes('Wedo') ? '小学低年级' :
      cls.course.includes('spike') ? '小学中高年级' :
      cls.course.includes('scratch') ? '小学' :
      cls.course.includes('python') || cls.course.includes('C++') ? '小学高年级' :
      cls.course.includes('wrc') ? '小学高年级' : '小学';

    // 构建上课时间描述
    const schedule = `${cls.day} ${cls.time}`;

    const { data: newClass, error: classError } = await supabase
      .from('classes')
      .insert({
        name: cls.name,
        teacher_id: teacherId,
        grade,
        schedule,
      })
      .select('id')
      .single();

    if (classError) {
      results.errors.push(`创建班级失败: ${cls.name} - ${classError.message}`);
      continue;
    }

    classIdMap.set(cls.name, newClass.id);
    classMap.set(`${cls.name}:${teacherId}`, newClass);
    results.classesCreated++;
    console.log(`  ✅ 创建班级: ${cls.name} (${newClass.id})`);
  }
  console.log();

  // ============================================
  // Step 6: 创建学生 + student_classes 关联
  // ============================================
  console.log('--- Step 6: 创建学生 + student_classes 关联 ---');
  
  // 先批量创建所有学生（去重）
  for (const student of scheduleData.students) {
    const existingStudent = studentMap.get(student.name);
    if (existingStudent) {
      continue; // 学生已存在，跳过创建
    }

    // 确定主班级（第一个班级）
    const primaryClassName = student.classNames[0];
    const primaryClassId = classIdMap.get(primaryClassName);
    
    // 确定主授课老师
    const primaryTeacherName = student.teachers[0];
    const primaryTeacherId = teachingTeacherIdMap.get(primaryTeacherName);

    // 确定教务老师
    const adminTeacherId = student.adminTeacher ? adminTeacherIdMap.get(student.adminTeacher) : null;

    const { data: newStudent, error: studentError } = await supabase
      .from('students')
      .insert({
        name: student.name,
        class_id: primaryClassId || null,
        current_teacher_id: primaryTeacherId || null,
        current_class: primaryClassName || null,
        admin_teacher_id: adminTeacherId || null,
      })
      .select('id')
      .single();

    if (studentError) {
      results.errors.push(`创建学生失败: ${student.name} - ${studentError.message}`);
      continue;
    }

    studentMap.set(student.name, newStudent);
    results.studentsCreated++;
    console.log(`  ✅ 创建学生: ${student.name}`);
  }
  console.log();

  // ============================================
  // Step 7: 创建 student_classes 关联
  // ============================================
  console.log('--- Step 7: 创建 student_classes 关联 ---');

  // 先获取已有的 student_classes 关联
  const { data: existingSC } = await supabase
    .from('student_classes')
    .select('student_id, class_id');
  
  const scSet = new Set();
  existingSC?.forEach(sc => scSet.add(`${sc.student_id}:${sc.class_id}`));

  for (const student of scheduleData.students) {
    const studentId = studentMap.get(student.name)?.id;
    if (!studentId) {
      results.errors.push(`找不到学生 ID: ${student.name}`);
      continue;
    }

    for (let i = 0; i < student.classNames.length; i++) {
      const className = student.classNames[i];
      const classId = classIdMap.get(className);
      if (!classId) {
        results.errors.push(`找不到班级 ID: ${className} (学生: ${student.name})`);
        continue;
      }

      // 检查是否已存在关联
      const scKey = `${studentId}:${classId}`;
      if (scSet.has(scKey)) {
        continue; // 关联已存在
      }

      const isPrimary = i === 0; // 第一个班级为主班级

      const { error: scError } = await supabase
        .from('student_classes')
        .insert({
          student_id: studentId,
          class_id: classId,
          is_primary: isPrimary,
        });

      if (scError) {
        // 唯一约束冲突，忽略
        if (scError.code !== '23505') {
          results.errors.push(`创建学生班级关联失败: ${student.name} -> ${className} - ${scError.message}`);
        }
        continue;
      }

      scSet.add(scKey);
      results.studentClassesCreated++;
    }
  }
  console.log(`  ✅ 创建了 ${results.studentClassesCreated} 条学生班级关联\n`);

  // ============================================
  // Step 8: 更新已存在学生的 admin_teacher_id
  // ============================================
  console.log('--- Step 8: 更新已存在学生的教务老师 ---');
  let adminUpdated = 0;

  for (const student of scheduleData.students) {
    if (!student.adminTeacher) continue;
    
    const studentData = studentMap.get(student.name);
    if (!studentData) continue;

    // 如果已有教务老师，跳过
    if (studentData.admin_teacher_id) continue;

    const adminId = adminTeacherIdMap.get(student.adminTeacher);
    if (!adminId) {
      results.errors.push(`找不到教务老师 ID: ${student.adminTeacher}`);
      continue;
    }

    const { error: updateError } = await supabase
      .from('students')
      .update({ admin_teacher_id: adminId })
      .eq('id', studentData.id);

    if (updateError) {
      results.errors.push(`更新教务老师失败: ${student.name} - ${updateError.message}`);
    } else {
      adminUpdated++;
    }
  }
  console.log(`  ✅ 更新了 ${adminUpdated} 个学生的教务老师\n`);

  // ============================================
  // 结果汇总
  // ============================================
  console.log('========================================');
  console.log('导入结果汇总');
  console.log('========================================');
  console.log(`  授课老师创建: ${results.teachersCreated}`);
  console.log(`  教务老师创建: ${results.adminTeachersCreated}`);
  console.log(`  班级创建: ${results.classesCreated}`);
  console.log(`  学生创建: ${results.studentsCreated}`);
  console.log(`  学生班级关联创建: ${results.studentClassesCreated}`);
  console.log(`  教务老师更新: ${adminUpdated}`);
  
  if (results.errors.length > 0) {
    console.log(`\n  ❌ 错误 (${results.errors.length}):`);
    results.errors.forEach(e => console.log(`    - ${e}`));
  } else {
    console.log('\n  ✅ 无错误');
  }
}

main().catch(err => {
  console.error('导入脚本执行失败:', err);
  process.exit(1);
});
