/**
 * 读取并校验环境变量（函数级中文注释）：
 * - 统一在服务层进行 env 校验，避免静默使用空值导致难排查问题。
 */
export function requireEnv(name: string, value: string | undefined): string {
  if (!value || !String(value).trim()) {
    throw new Error(`环境变量缺失：${name}`);
  }
  return String(value).trim();
}

