import { beforeEach, describe, expect, it, vi } from "vitest";

import { __resetApiGovernanceForTests, executeGovernedRequest } from "../apiGovernance";

describe("apiGovernance", () => {
  beforeEach(() => {
    __resetApiGovernanceForTests();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("同一请求键在软缓存窗口内复用结果", async () => {
    const runner = vi.fn(async () => ({ ok: true, ts: Date.now() }));

    const first = await executeGovernedRequest(
      { apiClass: "qweather", requestKey: "qweather:/v7/weather/now?location=1,1" },
      runner
    );
    const second = await executeGovernedRequest(
      { apiClass: "qweather", requestKey: "qweather:/v7/weather/now?location=1,1" },
      runner
    );

    expect(first).toEqual(second);
    expect(runner).toHaveBeenCalledTimes(1);
  });

  it("同一请求键并发时复用 in-flight Promise", async () => {
    let resolveTask: (v: number) => void = () => {};
    const runner = vi.fn(
      () =>
        new Promise<number>((resolve) => {
          resolveTask = resolve;
        })
    );

    const p1 = executeGovernedRequest(
      { apiClass: "free", requestKey: "ip:https://ipapi.co/json/" },
      runner
    );
    const p2 = executeGovernedRequest(
      { apiClass: "free", requestKey: "ip:https://ipapi.co/json/" },
      runner
    );

    expect(runner).toHaveBeenCalledTimes(1);
    resolveTask(7);
    await expect(p1).resolves.toBe(7);
    await expect(p2).resolves.toBe(7);
  });

  it("一言命中429后进入冷却窗口并拦截后续请求", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    await expect(
      executeGovernedRequest(
        { apiClass: "hitokoto", requestKey: "hitokoto:https://v1.hitokoto.cn/" },
        async () => {
          throw new Error("HTTP 429 Too Many Requests");
        }
      )
    ).rejects.toThrow("HTTP 429");

    await expect(
      executeGovernedRequest(
        { apiClass: "hitokoto", requestKey: "hitokoto:https://v1.hitokoto.cn/" },
        async () => ({ ok: true })
      )
    ).rejects.toThrow("API_GOVERNANCE_HITOKOTO_COOLDOWN");
  });
});
