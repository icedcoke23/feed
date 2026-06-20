import { db } from "@/storage/database/drizzle-client";
import { tags, teachingThemes, courseStages } from "@/storage/database/shared/schema";
import { DEFAULT_COURSE_STAGES } from "@/lib/constants/course-stages";

// 预设标签数据
const defaultTags = [
  // ========== 学员优点 ==========
  // 通用能力
  { category: "strength", name: "创造力", description: "作品有创意，敢于尝试新方案", sort_order: 1, is_active: true },
  { category: "strength", name: "协作能力", description: "团队合作中沟通顺畅，分工合理", sort_order: 2, is_active: true },
  { category: "strength", name: "表达能力", description: "能清晰描述作品结构、功能和原理", sort_order: 3, is_active: true },
  { category: "strength", name: "调试排错能力", description: "能独立发现并修复程序bug和硬件问题", sort_order: 4, is_active: true },
  // 大颗粒/小颗粒/BricQ - 乐高搭建类
  { category: "strength", name: "空间建构能力", description: "能理解三维结构，搭建作品空间布局合理", sort_order: 10, is_active: true },
  { category: "strength", name: "机械原理理解", description: "能正确运用齿轮、杠杆、滑轮等机械原理", sort_order: 11, is_active: true },
  { category: "strength", name: "动手操作能力", description: "搭建精细度高，操作熟练，作品牢固稳定", sort_order: 12, is_active: true },
  { category: "strength", name: "互锁结构掌握", description: "能熟练运用平面互锁、转角互锁、阶梯互锁等搭建技巧", sort_order: 13, is_active: true },
  { category: "strength", name: "传动原理运用", description: "能正确搭建齿轮传动、蜗轮蜗杆、连杆等传动结构", sort_order: 14, is_active: true },
  { category: "strength", name: "生活认知与观察", description: "能观察生活中的物品和现象，并在搭建中还原", sort_order: 15, is_active: true },
  // WeDo/SPIKE - 机器人编程类
  { category: "strength", name: "传感器应用能力", description: "能正确选择和使用各类传感器", sort_order: 20, is_active: true },
  { category: "strength", name: "软硬件联动能力", description: "能实现传感器与执行器的正确联动控制", sort_order: 21, is_active: true },
  { category: "strength", name: "图形化编程能力", description: "积木编程逻辑清晰，程序结构合理", sort_order: 22, is_active: true },
  { category: "strength", name: "硬件连接与调试", description: "能正确连接硬件设备，快速排查连接问题", sort_order: 23, is_active: true },
  { category: "strength", name: "多设备协同能力", description: "能实现多传感器、多电机的协调控制", sort_order: 24, is_active: true },
  { category: "strength", name: "梁结构搭建能力", description: "能熟练使用梁、销、轴搭建稳定的机械结构", sort_order: 25, is_active: true },
  // Scratch/Python/C++ - 代码编程类
  { category: "strength", name: "代码编程能力", description: "语法掌握扎实，代码规范，逻辑严谨", sort_order: 30, is_active: true },
  { category: "strength", name: "算法思维能力", description: "能将复杂问题拆解为可执行的算法步骤", sort_order: 31, is_active: true },
  { category: "strength", name: "程序逻辑清晰", description: "代码逻辑清晰，结构合理，易于理解", sort_order: 32, is_active: true },
  { category: "strength", name: "项目设计能力", description: "能独立进行需求分析和模块划分", sort_order: 33, is_active: true },
  { category: "strength", name: "竞赛解题能力", description: "能快速理解题目要求，设计高效算法", sort_order: 34, is_active: true },
  { category: "strength", name: "数据结构应用", description: "能合理选择和使用数组、链表、栈、队列等数据结构", sort_order: 35, is_active: true },

  // ========== 能力提升 ==========
  // 通用能力
  { category: "improvement", name: "独立思考能力", description: "遇到问题能自主分析，减少依赖", sort_order: 1, is_active: true },
  { category: "improvement", name: "问题解决能力", description: "面对困难时的分析和解决能力持续进步", sort_order: 2, is_active: true },
  { category: "improvement", name: "自主学习能力", description: "主动探索和独立思考的意愿增强", sort_order: 3, is_active: true },
  { category: "improvement", name: "创新思维能力", description: "作品创意性提升，敢于尝试新方法", sort_order: 4, is_active: true },
  { category: "improvement", name: "抗挫折能力", description: "遇到失败时情绪管理和再尝试意愿提升", sort_order: 5, is_active: true },
  // 乐高搭建类
  { category: "improvement", name: "结构设计能力", description: "搭建结构越来越合理，稳定性持续提升", sort_order: 10, is_active: true },
  { category: "improvement", name: "机械分析能力", description: "能越来越准确地分析模型的传动路径和受力原理", sort_order: 11, is_active: true },
  { category: "improvement", name: "搭建速度提升", description: "搭建效率明显提高，能在规定时间内完成作品", sort_order: 12, is_active: true },
  { category: "improvement", name: "作品创意性提升", description: "从照搬图纸到自主设计，作品越来越有个性", sort_order: 13, is_active: true },
  // 机器人编程类
  { category: "improvement", name: "编程逻辑优化能力", description: "编程逻辑越来越清晰，代码效率提升", sort_order: 20, is_active: true },
  { category: "improvement", name: "工程任务拆解能力", description: "能将复杂任务分解为可执行的步骤", sort_order: 21, is_active: true },
  { category: "improvement", name: "传感器运用进步", description: "从单一传感器到多传感器协同，应用能力持续提升", sort_order: 22, is_active: true },
  { category: "improvement", name: "软硬件协同进步", description: "编程与硬件配合越来越默契，联动效果更流畅", sort_order: 23, is_active: true },
  // 代码编程类
  { category: "improvement", name: "语言表达能力", description: "描述作品和思路越来越清晰", sort_order: 30, is_active: true },
  { category: "improvement", name: "代码规范提升", description: "命名越来越规范，代码结构越来越清晰", sort_order: 31, is_active: true },
  { category: "improvement", name: "算法优化意识", description: "从能实现功能到追求更高效的算法", sort_order: 32, is_active: true },
  { category: "improvement", name: "科学探究能力", description: "对原理的好奇心和探究精神增强", sort_order: 33, is_active: true },
  { category: "improvement", name: "数学应用能力", description: "能将数学知识应用到编程和搭建中", sort_order: 34, is_active: true },
  { category: "improvement", name: "团队协作能力", description: "合作中的沟通和协调能力进步", sort_order: 35, is_active: true },

  // ========== 需要提升的点 ==========
  // 通用
  { category: "weakness", name: "专注力", description: "课堂学习投入程度和持续时间需提升", sort_order: 1, is_active: true },
  { category: "weakness", name: "畏难情绪", description: "遇到挑战容易退缩，需要更多鼓励", sort_order: 2, is_active: true },
  { category: "weakness", name: "依赖性强", description: "过度依赖教师指导，自主性需培养", sort_order: 3, is_active: true },
  { category: "weakness", name: "细节把控", description: "容易忽略细节，需培养严谨态度", sort_order: 4, is_active: true },
  { category: "weakness", name: "时间管理", description: "任务时间分配和效率需提升", sort_order: 5, is_active: true },
  // 乐高搭建类
  { category: "weakness", name: "空间想象不足", description: "搭建时空间布局规划能力需加强", sort_order: 10, is_active: true },
  { category: "weakness", name: "机械原理理解薄弱", description: "对传动原理和力学概念理解不够", sort_order: 11, is_active: true },
  { category: "weakness", name: "动手协调性弱", description: "搭建速度和精细度有待提高", sort_order: 12, is_active: true },
  { category: "weakness", name: "搭建不够牢固", description: "作品结构松散，互锁结构运用不够", sort_order: 13, is_active: true },
  { category: "weakness", name: "照搬缺乏创意", description: "过于依赖图纸，缺少自主设计和创新", sort_order: 14, is_active: true },
  // 机器人编程类
  { category: "weakness", name: "软硬件联动困难", description: "编程与硬件配合的思路需加强", sort_order: 20, is_active: true },
  { category: "weakness", name: "编程逻辑混乱", description: "程序逻辑不够清晰，结构需优化", sort_order: 21, is_active: true },
  { category: "weakness", name: "传感器使用单一", description: "只会使用一种传感器，缺乏组合运用意识", sort_order: 22, is_active: true },
  { category: "weakness", name: "硬件连接不熟练", description: "设备连接容易出错，调试速度慢", sort_order: 23, is_active: true },
  // 代码编程类
  { category: "weakness", name: "编码习惯", description: "代码命名和结构规范需要改进", sort_order: 30, is_active: true },
  { category: "weakness", name: "学习习惯", description: "课堂参与和课后练习的主动性需加强", sort_order: 31, is_active: true },
  { category: "weakness", name: "算法思路受限", description: "解题方法单一，缺乏多角度思考", sort_order: 32, is_active: true },
  { category: "weakness", name: "调试能力不足", description: "遇到bug不知如何排查，缺乏系统调试方法", sort_order: 33, is_active: true },
  { category: "weakness", name: "抽象思维薄弱", description: "函数/类/模块的抽象能力需加强", sort_order: 34, is_active: true },
];

// 预设教学主题
const defaultThemes = [
  { name: "生活家电", category: "科技生活", description: "探索日常家电的工作原理", sort_order: 1, is_active: true },
  { name: "生命科学和自然环境", category: "自然科学", description: "了解生命和自然奥秘", sort_order: 2, is_active: true },
  { name: "工程机械", category: "工程技术", description: "学习机械结构和工作原理", sort_order: 3, is_active: true },
  { name: "智能机器人", category: "人工智能", description: "机器人编程与控制", sort_order: 4, is_active: true },
  { name: "编程思维", category: "计算机科学", description: "培养计算思维和算法能力", sort_order: 5, is_active: true },
  { name: "电子电路", category: "电子技术", description: "学习电路原理和电子元件", sort_order: 6, is_active: true },
  { name: "3D建模与打印", category: "数字制造", description: "三维设计和快速成型技术", sort_order: 7, is_active: true },
  { name: "航空航天", category: "航天科技", description: "探索航空航天知识", sort_order: 8, is_active: true },
  { name: "积木搭建与结构设计", category: "乐高教育", description: "积木搭建技巧与结构设计原理", sort_order: 9, is_active: true },
  { name: "机械传动与物理原理", category: "工程技术", description: "机械传动机制与物理原理应用", sort_order: 10, is_active: true },
  { name: "传感器与智能感知", category: "人工智能", description: "传感器原理与智能感知技术", sort_order: 11, is_active: true },
  { name: "机器人竞赛", category: "竞赛活动", description: "机器人竞赛策略与实战训练", sort_order: 12, is_active: true },
  { name: "游戏与互动媒体", category: "计算机科学", description: "游戏设计与互动媒体创作", sort_order: 13, is_active: true },
  { name: "数学与逻辑推理", category: "数学思维", description: "数学思维训练与逻辑推理能力培养", sort_order: 14, is_active: true },
];

export interface InitDataResult {
  tags: number;
  themes: number;
  courseStages: number;
  skipped: boolean;
}

export async function initializeDefaults(): Promise<InitDataResult> {
  const existingTags = await db.select({ id: tags.id }).from(tags).limit(1);
  if (existingTags.length > 0) {
    return { tags: 0, themes: 0, courseStages: 0, skipped: true };
  }

  await db.insert(tags).values(defaultTags.map(toTagInsert));
  await db.insert(teachingThemes).values(defaultThemes.map(toThemeInsert));

  const existingStages = await db.select({ id: courseStages.id }).from(courseStages).limit(1);
  let courseStagesCount = 0;
  if (existingStages.length === 0) {
    await db.insert(courseStages).values(DEFAULT_COURSE_STAGES.map(toCourseStageInsert));
    courseStagesCount = DEFAULT_COURSE_STAGES.length;
  }

  return {
    tags: defaultTags.length,
    themes: defaultThemes.length,
    courseStages: courseStagesCount,
    skipped: false,
  };
}

function toTagInsert(tag: (typeof defaultTags)[number]) {
  return {
    category: tag.category,
    name: tag.name,
    description: tag.description,
    sortOrder: tag.sort_order,
    isActive: tag.is_active,
  };
}

function toThemeInsert(theme: (typeof defaultThemes)[number]) {
  return {
    name: theme.name,
    category: theme.category,
    description: theme.description,
    sortOrder: theme.sort_order,
    isActive: theme.is_active,
  };
}

function toCourseStageInsert(stage: (typeof DEFAULT_COURSE_STAGES)[number]) {
  return {
    stageCode: stage.stage_code,
    stageName: stage.stage_name,
    theme: stage.theme,
    level: stage.level,
    description: stage.description,
    content: stage.content,
    goal: stage.goal,
    sortOrder: stage.sort_order,
    isActive: stage.is_active,
  };
}
