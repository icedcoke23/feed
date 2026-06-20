const XLSX = require('xlsx');

const wb = XLSX.readFile('课表.xlsx');
const ws = wb.Sheets['Sheet1'];
const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

// Row 0: [null, null, "小何","赵军","晓雪","果果","小鱼","乐乐","小雷","郭郭","小罗"]
// 老师映射（列索引 -> 老师名）
const teacherCols = {}; // colIndex -> teacherName
data[0].forEach((name, i) => {
  if (name && i >= 2) teacherCols[i] = name;
});

// 老师名 -> 第二个字（用于班级命名）
const teacherSecondChar = {};
for (const [col, name] of Object.entries(teacherCols)) {
  teacherSecondChar[col] = name.length >= 2 ? name[1] : name[0];
}

console.log('=== 老师列表 ===');
Object.entries(teacherCols).forEach(([col, name]) => {
  console.log(`  列${col}: ${name} (班级前缀: ${teacherSecondChar[col]})`);
});

// 教务老师标记映射：括号中的标记 -> 教务老师用户名
const adminTeacherMap = {
  '心': '心心',
  '高': '燕子',
  '睿': '睿睿',
};

// 解析班级和学生
const classes = []; // { name, teacher, day, time, course, students: [] }
const allStudents = new Map(); // name -> { name, teachers: Set, classNames: [], adminTeacher: string|null }

let currentDay = '';
let currentTime = '';

// 第一遍扫描：从后往前，为没有星期的行填充后续最近的星期
const rowDays = new Array(data.length).fill('');
let nextDay = '';
for (let i = data.length - 1; i >= 0; i--) {
  const row = data[i];
  if (row && row[0] && typeof row[0] === 'string' && row[0].trim()) {
    nextDay = row[0].trim();
  }
  rowDays[i] = nextDay;
}

for (let i = 1; i < data.length; i++) {
  const row = data[i];
  if (!row || row.length === 0) continue;

  // 星期信息：取最左侧列（列0），如果为空则从预扫描结果获取
  if (row[0] && typeof row[0] === 'string' && row[0].trim()) {
    currentDay = row[0].trim();
  } else if (!currentDay && rowDays[i]) {
    currentDay = rowDays[i];
  }

  // 时间信息：取列1，如果为空则沿用上一个
  if (row[1] && typeof row[1] === 'string' && row[1].trim()) {
    currentTime = row[1].trim();
  }

  // 检查是否是课程行（包含课程名）
  let hasCourse = false;
  for (const [colStr, _teacher] of Object.entries(teacherCols)) {
    const col = parseInt(colStr);
    const cellVal = row[col];
    if (cellVal && typeof cellVal === 'string' && cellVal.trim()) {
      const val = cellVal.trim();
      const isStudentList = val.includes('\n') || val.includes('（') || val.includes('(');
      const isCourseName = !isStudentList && (
        val.includes('乐高') || val.includes('scratch') || val.includes('python') ||
        val.includes('wedo') || val.includes('Wedo') || val.includes('WEDO') ||
        val.includes('spike') || val.includes('SPIKE') || val.includes('C++') ||
        val.includes('百变') || val.includes('生活') || val.includes('BQ') ||
        val.includes('BricQ') || val.includes('wrc') || val.includes('WRC') ||
        val.includes('集训') || val.includes('基础语法') || val.includes('进阶算法') ||
        val.includes('培优')
      );
      if (isCourseName) hasCourse = true;
    }
  }

  // 如果当前行有课程名，下一行是学生列表
  if (hasCourse) {
    for (const [colStr, _teacher] of Object.entries(teacherCols)) {
      const col = parseInt(colStr);
      const courseCell = row[col];
      if (!courseCell || typeof courseCell !== 'string') continue;

      const courseVal = courseCell.trim();
      const isStudentList = courseVal.includes('\n') || courseVal.includes('（') || courseVal.includes('(');
      if (isStudentList) continue;

      // 提取课程名（去掉括号中的备注）
      let courseName = courseVal.replace(/（[^）]*）/g, '').replace(/\([^)]*\)/g, '').trim();
      // 去掉时间标注（如 "15：20" "19：10-20：40"）
      courseName = courseName.replace(/\d{1,2}[：:]\d{2}[^）)]*$/g, '').trim();
      // 去掉 "不加体验" "不要超过3个人" "不加人" "满" 等备注
      courseName = courseName.replace(/（不加.*?）/g, '').replace(/（不要.*?）/g, '').replace(/（满）/g, '').trim();
      courseName = courseName.replace(/（不加.*?$/g, '').trim();
      // 清理 "补课刚升" "刚学" 等非标准词汇
      courseName = courseName.replace(/补课刚升/g, '').replace(/刚升/g, '').replace(/刚学/g, '').trim();

      if (!courseName) continue;

      // 构建班级名：老师第二个字 + 星期 + 时间 + 课程
      const secondChar = teacherSecondChar[col];
      const dayStr = currentDay; // 直接使用当前星期

      // 提取时间中的小时
      let timeStr = currentTime.replace(/：/g, ':');
      const hourMatch = timeStr.match(/(\d{1,2}):\d{2}/);
      let hourStr = '';
      if (hourMatch) {
        const h = parseInt(hourMatch[1]);
        hourStr = `${h}点`;
      }

      // 如果缺少星期信息，标记为异常
      if (!currentDay) {
        console.warn(`  ⚠ 班级缺少星期信息: 老师=${teacher}, 时间=${currentTime}, 课程=${courseName}`);
      }

      const className = `${secondChar}-${dayStr}${hourStr}${courseName}`;

      // 下一行是学生列表
      const studentRow = data[i + 1];
      const students = [];
      if (studentRow && studentRow[col]) {
        const studentStr = String(studentRow[col]);
        const lines = studentStr.split('\n').map(s => s.trim()).filter(Boolean);
        for (const line of lines) {
          // 提取教务老师标记（括号前缀：心/高/睿）
          let adminTeacherKey = null;
          const adminPrefixMatch = line.match(/^[（(](心|高|睿)[）)]\s*(.+)$/);
          let name = line;
          if (adminPrefixMatch) {
            adminTeacherKey = adminPrefixMatch[1];
            name = adminPrefixMatch[2].trim();
          }
          // 去掉所有括号内容（后缀备注如（补）（7月上）等）
          name = name.replace(/（[^）]*）/g, '').replace(/\([^)]*\)/g, '').trim();
          // 去掉名字后的标记如 "补" "假" "寒"
          name = name.replace(/补$/g, '').replace(/假$/g, '').replace(/寒$/g, '').trim();
          // 去掉"集训停课"等备注
          name = name.replace(/集训停课.*$/g, '').trim();
          // 去掉"不扣课"等备注
          name = name.replace(/不扣课.*$/g, '').trim();
          // 去掉"7月上"等备注（可能在名字后面，如"王梓悠7月上"）
          name = name.replace(/\d+月上?$/g, '').trim();
          // 去掉名字中的数字后缀（如"黄鑫03"->"黄鑫"）
          name = name.replace(/\d+$/g, '').trim();
          // 去掉"固定时间"等备注
          name = name.replace(/固定时间$/g, '').trim();
          // 去掉剩余的括号
          name = name.replace(/[（）()]/g, '').trim();
          // 去掉尾部空格和特殊字符
          name = name.replace(/\s+/g, '').trim();

          if (name && name.length >= 2) {
            students.push(name);
            if (!allStudents.has(name)) {
              allStudents.set(name, { name, teachers: new Set(), classNames: [], adminTeacher: null });
            }
            const studentInfo = allStudents.get(name);
            studentInfo.teachers.add(teacher);
            studentInfo.classNames.push(className);
            // 如果有教务老师标记，设置教务老师（跨班级以第一个标记为准）
            if (adminTeacherKey && !studentInfo.adminTeacher) {
              studentInfo.adminTeacher = adminTeacherMap[adminTeacherKey] || null;
            }
          }
        }
      }

      if (students.length > 0) {
        classes.push({
          name: className,
          teacher,
          day: currentDay,
          time: currentTime,
          course: courseName,
          students,
        });
      }
    }
  }
}

// 输出结果
console.log('\n\n=== 班级列表 ===');
console.log(`共 ${classes.length} 个班级\n`);
classes.forEach((c, i) => {
  console.log(`${i + 1}. ${c.name} | 老师: ${c.teacher} | ${c.day} ${c.time} | 课程: ${c.course} | ${c.students.length}人`);
  c.students.forEach(s => console.log(`   - ${s}`));
});

console.log('\n\n=== 老师列表 ===');
const teachers = new Set(classes.map(c => c.teacher));
teachers.forEach(t => {
  const teacherClasses = classes.filter(c => c.teacher === t);
  const totalStudents = new Set(teacherClasses.flatMap(c => c.students)).size;
  console.log(`  ${t}: ${teacherClasses.length}个班, ${totalStudents}个学生`);
});

console.log('\n\n=== 学生列表（去重）===');
console.log(`共 ${allStudents.size} 个学生\n`);
const studentEntries = [...allStudents.entries()].sort((a, b) => a[0].localeCompare(b[0]));
studentEntries.forEach(([name, info]) => {
  const teacherList = [...info.teachers].join(', ');
  const adminStr = info.adminTeacher ? ` | 教务: ${info.adminTeacher}` : '';
  console.log(`  ${name} | 老师: ${teacherList}${adminStr} | 班级: ${info.classNames.join(', ')}`);
});

// 检查跨老师学生
console.log('\n\n=== 跨老师学生 ===');
let crossCount = 0;
for (const [name, info] of allStudents) {
  if (info.teachers.size > 1) {
    crossCount++;
    console.log(`  ${name}: ${[...info.teachers].join(', ')} | 班级: ${info.classNames.join(', ')}`);
  }
}
console.log(`共 ${crossCount} 个跨老师学生`);

// 输出 JSON 格式数据（用于导入）
const importData = {
  teachers: [...teachers].map(t => ({ name: t })),
  classes: classes.map(c => ({
    name: c.name,
    teacher: c.teacher,
    day: c.day,
    time: c.time,
    course: c.course,
    students: c.students,
  })),
  students: [...allStudents.entries()].map(([name, info]) => ({
    name,
    teachers: [...info.teachers],
    classNames: info.classNames,
    adminTeacher: info.adminTeacher || null,
  })),
};

// 统计教务老师分布
console.log('\n\n=== 教务老师分布 ===');
const adminStats = {};
for (const [, info] of allStudents) {
  const key = info.adminTeacher || '未绑定';
  adminStats[key] = (adminStats[key] || 0) + 1;
}
Object.entries(adminStats).sort((a, b) => b[1] - a[1]).forEach(([admin, count]) => {
  console.log(`  ${admin}: ${count}人`);
});

// 写入 JSON 文件
const fs = require('fs');
fs.writeFileSync('scripts/schedule-data.json', JSON.stringify(importData, null, 2), 'utf-8');
console.log('\n\n已导出数据到 scripts/schedule-data.json');
