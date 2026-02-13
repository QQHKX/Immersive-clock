/**
 * 通过 fetch 获取 JSON 数据
 * 包含超时控制与异常处理
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
