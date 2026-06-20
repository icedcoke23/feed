import { createClient, SupabaseClient } from '@supabase/supabase-js';

let envLoaded = false;
let clientInstance: SupabaseClient | null = null;
let serverClientInstance: SupabaseClient | null = null;

interface SupabaseCredentials {
  url: string;
  anonKey: string;
}

function loadEnv(): void {
  if (envLoaded) return;

  // Next.js 自动加载 .env，无需手动 require dotenv
  envLoaded = true;
}

function getSupabaseCredentials(): SupabaseCredentials {
  loadEnv();

  // 优先使用 COZE_ 前缀，回退到 NEXT_PUBLIC_ 前缀
  const url = process.env.COZE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.COZE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url) {
    throw new Error('COZE_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL is not set');
  }
  if (!anonKey) {
    throw new Error('COZE_SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY is not set');
  }

  return { url, anonKey };
}

/**
 * 获取前端用的 Supabase 客户端（anon key）
 *
 * 使用场景：前端页面中需要直接读取公开配置数据（如标签、课程阶段）。
 * 启用 RLS 后，此客户端仅能读取 anon 策略允许的数据（tags/teaching_themes/course_stages 的只读访问），
 * 无法读写敏感表（users/teachers/students/feedbacks/classes/ai_settings/class_transfers）。
 *
 * @param token - 可选的 JWT token，用于在 API 路由中传递用户身份
 */
function getSupabaseClient(token?: string): SupabaseClient {
  const { url, anonKey } = getSupabaseCredentials();

  if (token) {
    return createClient(url, anonKey, {
      global: {
        headers: { Authorization: `Bearer ${token}` },
      },
      db: { timeout: 60000 },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  // 无 token 时复用单例
  if (!clientInstance) {
    clientInstance = createClient(url, anonKey, {
      db: { timeout: 60000 },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return clientInstance;
}

/**
 * 获取服务端用的 Supabase 客户端（service_role key）
 *
 * 使用场景：所有 API 路由（src/app/api/）中的数据库操作。
 * service_role 绕过 RLS，拥有对所有表的完整读写权限。
 *
 * ⚠️ 此函数只能在服务端使用，绝不能暴露到前端代码中。
 * service_role key 拥有完全的数据库访问权限，泄露将导致严重安全问题。
 *
 * 环境变量：SUPABASE_SERVICE_ROLE_KEY（在 .env 或部署环境中配置）
 */
function getServerSupabaseClient(): SupabaseClient {
  loadEnv();

  const url = process.env.COZE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error('COZE_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL is not set');
  }

  // 开发环境：如果未配置 service_role key，回退到 anon key 并警告
  if (!serviceRoleKey) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set. This is required for server-side database operations in production.');
    }
    console.warn('WARNING: SUPABASE_SERVICE_ROLE_KEY not set, falling back to anon key. RLS policies will apply. Set SUPABASE_SERVICE_ROLE_KEY for full access.');
    return getSupabaseClient();
  }

  // 复用单例
  if (!serverClientInstance) {
    serverClientInstance = createClient(url, serviceRoleKey, {
      db: { timeout: 60000 },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return serverClientInstance;
}

export { loadEnv, getSupabaseCredentials, getSupabaseClient, getServerSupabaseClient };
