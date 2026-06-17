import { NextRequest, NextResponse } from "next/server";
import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  Packer,
} from "docx";
import { z } from "zod";
import { validateInput } from "@/lib/validations";
import { getAuthUser } from "@/lib/route-auth";
import { errorResponse } from "@/lib/api-response";

const exportSchema = z.object({
  studentName: z.string().optional().default(""),
  grade: z.string().optional().default(""),
  className: z.string().optional().default(""),
  theme: z.string().optional().default(""),
  feedbackDate: z.string().optional().default(""),
  teacherName: z.string().optional().default(""),
  strengths: z.string().optional(),
  improvements: z.string().optional(),
  weaknesses: z.string().optional(),
  recommendations: z.string().optional(),
  summary: z.string().optional(),
  tagRatings: z.array(z.object({
    name: z.string(),
    rating: z.number(),
    note: z.string(),
  })).optional(),
});

// POST /api/export - 导出Word文档
export async function POST(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return errorResponse("未授权访问", 401);
  }

  const body = await request.json();

  // 校验输入
  const result = validateInput(exportSchema, body);
  if ("error" in result) return result.error;
  const {
    studentName,
    grade,
    className,
    theme,
    feedbackDate,
    teacherName,
    strengths,
    improvements,
    weaknesses, // 新增：需要提升的部分
    recommendations,
    summary,
    tagRatings,
  } = result.data;

  try {
    // 创建文档
    const doc = new Document({
      sections: [
        {
          properties: {},
          children: [
            // 标题
            new Paragraph({
              children: [
                new TextRun({
                  text: "个性化教学反馈报告",
                  bold: true,
                  size: 36,
                }),
              ],
              heading: HeadingLevel.TITLE,
              alignment: AlignmentType.CENTER,
              spacing: { after: 400 },
            }),

            // 基本信息
            new Paragraph({
              children: [
                new TextRun({
                  text: "学员基本信息",
                  bold: true,
                  size: 28,
                }),
              ],
              heading: HeadingLevel.HEADING_1,
              spacing: { before: 200, after: 100 },
            }),
            ...createInfoTable(studentName, grade, className, theme, feedbackDate, teacherName),

            // 能力评分概览
            new Paragraph({
              children: [
                new TextRun({
                  text: "能力评分概览",
                  bold: true,
                  size: 28,
                }),
              ],
              heading: HeadingLevel.HEADING_1,
              spacing: { before: 300, after: 100 },
            }),
            ...createTagRatingsTable(tagRatings ?? null),

            // 详细分析报告
            new Paragraph({
              children: [
                new TextRun({
                  text: "详细分析报告",
                  bold: true,
                  size: 28,
                }),
              ],
              heading: HeadingLevel.HEADING_1,
              spacing: { before: 300, after: 100 },
            }),

            // 学员优点
            ...(strengths
              ? [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: "学员优点",
                        bold: true,
                        size: 24,
                        color: "2E7D32",
                      }),
                    ],
                    spacing: { before: 200, after: 100 },
                  }),
                  ...parseReportToParagraphs(strengths, "2E7D32"),
                ]
              : []),

            // 能力提升
            ...(improvements
              ? [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: "能力提升",
                        bold: true,
                        size: 24,
                        color: "1565C0",
                      }),
                    ],
                    spacing: { before: 200, after: 100 },
                  }),
                  ...parseReportToParagraphs(improvements, "1565C0"),
                ]
              : []),

            // 需要提升
            ...(weaknesses
              ? [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: "需要提升",
                        bold: true,
                        size: 24,
                        color: "E65100",
                      }),
                    ],
                    spacing: { before: 200, after: 100 },
                  }),
                  ...parseReportToParagraphs(weaknesses, "E65100"),
                ]
              : []),

            // 教学建议
            ...(recommendations
              ? [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: "教学建议",
                        bold: true,
                        size: 24,
                        color: "6A1B9A",
                      }),
                    ],
                    spacing: { before: 200, after: 100 },
                  }),
                  ...parseReportToParagraphs(recommendations, "6A1B9A"),
                ]
              : []),

            // 总结
            ...(summary
              ? [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: "总结",
                        bold: true,
                        size: 24,
                        color: "424242",
                      }),
                    ],
                    spacing: { before: 200, after: 100 },
                  }),
                  ...parseReportToParagraphs(summary, "424242"),
                ]
              : []),

            // 落款
            new Paragraph({
              children: [
                new TextRun({
                  text: "",
                  size: 22,
                }),
              ],
              spacing: { before: 400, after: 100 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: `授课教师：${teacherName || "教师签名"}`,
                  size: 22,
                }),
              ],
              alignment: AlignmentType.RIGHT,
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: `日期：${feedbackDate || new Date().toLocaleDateString("zh-CN")}`,
                  size: 22,
                }),
              ],
              alignment: AlignmentType.RIGHT,
            }),
          ],
        },
      ],
    });

    // 生成文档buffer
    const buffer = await Packer.toBuffer(doc);

    // 返回文档 - 使用RFC 5987编码文件名以支持中文
    const filename = `${studentName}_教学反馈报告.docx`;
    const encodedFilename = encodeURIComponent(filename);
    
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${encodedFilename}"; filename*=UTF-8''${encodedFilename}`,
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return errorResponse("导出失败", 500);
  }
}

// 创建基本信息表格
function createInfoTable(
  studentName: string,
  grade: string,
  className: string,
  theme: string,
  feedbackDate: string,
  teacherName: string
) {
  const rows = [
    ["学员姓名", studentName || "", "年级班级", `${grade || ""}年级 ${className || ""}班`],
    ["教学主题", theme || "", "反馈日期", feedbackDate || ""],
    ["授课教师", teacherName || "", "", ""],
  ];

  return [
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: rows.map((row) =>
        new TableRow({
          children: row.map((cell, index) =>
            new TableCell({
              width: { size: 25, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: cell,
                      bold: index % 2 === 0,
                      size: 22,
                    }),
                  ],
                }),
              ],
            })
          ),
        })
      ),
    }),
  ];
}

// 创建标签评分表格
function createTagRatingsTable(
  tagRatings: Array<{ name: string; rating: number; note: string }> | null
) {
  if (!tagRatings || tagRatings.length === 0) {
    return [
      new Paragraph({
        children: [new TextRun({ text: "暂无评分数据", size: 22 })],
      }),
    ];
  }

  const headerRow = new TableRow({
    children: ["评价维度", "星级评分", "详细说明"].map(
      (header) =>
        new TableCell({
          children: [
            new Paragraph({
              children: [new TextRun({ text: header, bold: true, size: 22 })],
              alignment: AlignmentType.CENTER,
            }),
          ],
        })
    ),
  });

  const dataRows = tagRatings.map(
    (item) =>
      new TableRow({
        children: [
          item.name || "",
          "⭐".repeat(item.rating || 0) + ` (${item.rating}星)`,
          item.note || "",
        ].map((text) =>
          new TableCell({
            children: [
              new Paragraph({
                children: [new TextRun({ text, size: 20 })],
              }),
            ],
          })
        ),
      })
  );

  return [
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [headerRow, ...dataRows],
    }),
  ];
}

// 解析报告为段落
function parseReportToParagraphs(report: string, color?: string): Paragraph[] {
  if (!report) {
    return [new Paragraph({ children: [new TextRun({ text: "暂无内容", size: 22 })] })];
  }

  const lines = report.split("\n").filter((line) => line.trim());
  return lines.map((line) => {
    // 检查是否是标题行
    const isHeading = /^【.+】/.test(line) || /^#{1,3}\s/.test(line) || /^[一二三四五六七八九十]、/.test(line);
    
    // 清理文本
    let cleanText = line
      .replace(/^#+\s*/, "")
      .replace(/【|】/g, "")
      .replace(/^\d+\.\s*/, "")
      .replace(/^[●•]\s*/, "");

    return new Paragraph({
      children: [
        new TextRun({
          text: cleanText,
          bold: isHeading,
          size: isHeading ? 24 : 22,
          color: color,
        }),
      ],
      spacing: { after: 100 },
    });
  });
}
