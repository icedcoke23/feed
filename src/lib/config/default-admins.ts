export interface DefaultAdminConfig {
  username: string;
  name: string;
}

/**
 * 读取环境变量 `DEFAULT_ADMIN_TEACHERS` 中的默认教务老师账号。
 * 格式：`username1:name1,username2:name2`
 * 例如：`xinxin:心心,yanzi:燕子`
 */
export function getDefaultAdminTeachers(): DefaultAdminConfig[] {
  const raw = process.env.DEFAULT_ADMIN_TEACHERS || "";
  if (!raw.trim()) return [];

  return raw.split(",").map((part) => {
    const [username, name] = part.trim().split(":");
    return {
      username: username.trim(),
      name: (name || username).trim(),
    };
  });
}

/**
 * 读取环境变量 `DEFAULT_ADMIN_PASSWORD`，未设置时返回一个随机占位符。
 * 生产环境必须显式配置，否则首次导入将无法创建默认管理员。
 */
export function getDefaultAdminPassword(): string {
  return process.env.DEFAULT_ADMIN_PASSWORD || generatePlaceholderPassword();
}

function generatePlaceholderPassword(): string {
  const array = new Uint8Array(12);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}
