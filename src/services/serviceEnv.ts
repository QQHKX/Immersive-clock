/**
 * 读取并校验环境变量
 * 统一在服务层校验，避免空值导致问题
 * @param name - 环境变量名称
 * @param value - 环境变量值
 * @returns 校验后的环境变量值
 */
export function requireEnv(name: string, value: string | undefined): string {
  if (!value || !String(value).trim()) {
    throw new Error(`环境变量缺失：${name}`);
  }
  return String(value).trim();
}
