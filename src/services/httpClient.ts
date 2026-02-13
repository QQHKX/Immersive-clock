/**
 * 通过 fetch 获取 JSON（函数级中文注释）：
 * - 内置超时（AbortController）
 * - 对非 2xx 与非 JSON 响应抛出包含预览片段的错误，便于排障
 */
export async function httpGetJson(
  url: string,
  headers?: Record<string, string>,
  timeoutMs = 10000
): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, {
      headers: headers || {},
      signal: controller.signal,
    });
    const text = await resp.text();
    const preview = String(text || "")
      .replace(/\s+/g, " ")
      .slice(0, 300);

    let parsed: unknown | null = null;
    if (text) {
      try {
        parsed = JSON.parse(text) as unknown;
      } catch {
        parsed = null;
      }
    }

    if (!resp.ok) {
      throw new Error(
        `HTTP ${resp.status} ${resp.statusText}：${url}${preview ? `｜${preview}` : ""}`
      );
    }

    if (parsed == null) {
      throw new Error(`响应非 JSON：${url}${preview ? `｜${preview}` : ""}`);
    }

    return parsed;
  } finally {
    clearTimeout(timeout);
  }
}
