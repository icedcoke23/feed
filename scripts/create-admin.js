const bcrypt = require('bcryptjs');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('错误: 环境变量 SUPABASE_URL 和 SUPABASE_KEY 必须设置。');
  console.error('请先设置后再运行此脚本：');
  console.error('  export SUPABASE_URL="https://your-project.supabase.co"');
  console.error('  export SUPABASE_KEY="your-api-key"');
  process.exit(1);
}

async function createAdmin() {
  const adminId = crypto.randomUUID();
  const password = process.env.ADMIN_PASSWORD || 'admin123';
  if (password === 'admin123') {
    console.warn('\n⚠️  警告: 正在使用默认管理员密码 "admin123"，这在生产环境中极不安全！');
    console.warn('⚠️  请通过环境变量 ADMIN_PASSWORD 设置一个强密码，例如：');
    console.warn('⚠️  export ADMIN_PASSWORD="your-strong-password"\n');
  }
  const hashedPassword = await bcrypt.hash(password, 10);

  console.log('Creating admin with bcryptjs hash...');
  console.log('Hash:', hashedPassword);

  // 先删除可能存在的旧 admin（pgcrypto 创建的）
  const delRes = await fetch(`${SUPABASE_URL}/rest/v1/users?username=eq.admin`, {
    method: 'DELETE',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
    },
  });
  console.log('Delete existing admin:', delRes.ok ? 'OK' : delRes.status);

  // 用 bcryptjs 哈希创建新 admin
  const response = await fetch(`${SUPABASE_URL}/rest/v1/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Prefer': 'return=representation',
    },
    body: JSON.stringify({
      id: adminId,
      username: 'admin',
      password: hashedPassword,
      name: '管理员',
      role: 'admin',
      is_active: true,
      created_at: new Date().toISOString(),
    }),
  });

  if (response.ok) {
    await response.json();
    console.log('Admin created successfully!');
    console.log('Username: admin');
    console.log('Password: ********');
    if (password === 'admin123') {
      console.warn('⚠️  当前使用默认密码，请尽快修改！');
    }
  } else {
    const error = await response.text();
    console.error('Failed:', response.status, error);
  }
}

createAdmin().catch(console.error);
