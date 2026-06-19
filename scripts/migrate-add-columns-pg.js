// 通过 pg 库直接连接 PostgreSQL，为 feedbacks 表添加缺失列并刷新 PostgREST schema 缓存
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('请设置 DATABASE_URL 环境变量');
  console.error('');
  console.error('获取方式：');
  console.error('1. 打开 Supabase Dashboard (https://supabase.com/dashboard)');
  console.error('2. 选择项目 -> Settings -> Database');
  console.error('3. 复制 Connection string (URI 格式)');
  console.error('');
  console.error('运行命令（PowerShell）：');
  console.error('$env:DATABASE_URL="postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres"');
  console.error('node scripts/migrate-add-columns-pg.js');
  process.exit(1);
}

const SQL_FILE = path.join(__dirname, 'migrate-add-columns.sql');
const MIGRATION_SQL = fs.readFileSync(SQL_FILE, 'utf-8');

async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

  try {
    console.log('连接数据库...');
    await client.connect();
    console.log('连接成功！\n');

    console.log('=== 检查 feedbacks 表当前列 ===');
    const beforeRows = await client.query(
      `SELECT column_name, data_type
       FROM information_schema.columns
       WHERE table_name = 'feedbacks' AND column_name IN ('metadata', 'work_info', 'ability_scores')`
    );
    if (beforeRows.rows.length === 0) {
      console.log('当前 feedbacks 表缺少 metadata / work_info / ability_scores 列');
    } else {
      console.log('已存在列：', beforeRows.rows.map(r => r.column_name).join(', '));
    }
    console.log('');

    console.log('=== 执行迁移 SQL ===');
    await client.query(MIGRATION_SQL);
    console.log('迁移 SQL 执行成功！\n');

    console.log('=== 刷新 PostgREST schema 缓存 ===');
    await client.query("NOTIFY pgrst, 'reload schema';");
    console.log('Schema 缓存刷新已发送\n');

    console.log('=== 验证列是否已添加 ===');
    const afterRows = await client.query(
      `SELECT column_name, data_type
       FROM information_schema.columns
       WHERE table_name = 'feedbacks' AND column_name IN ('metadata', 'work_info', 'ability_scores')`
    );
    if (afterRows.rows.length >= 3) {
      console.log('验证通过，以下列已存在：');
      afterRows.rows.forEach(r => console.log(`  - ${r.column_name} (${r.data_type})`));
    } else {
      console.error('验证失败，缺少以下列，请手动检查数据库状态：');
      ['metadata', 'work_info', 'ability_scores']
        .filter(name => !afterRows.rows.some(r => r.column_name === name))
        .forEach(name => console.error(`  - ${name}`));
      process.exit(1);
    }

    console.log('\n迁移完成，请刷新页面重新保存反馈。');
  } catch (error) {
    console.error('迁移失败:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
