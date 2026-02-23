import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { debug, error, info, logger, warn } from "../logger";

/** logger 单元测试（函数级注释：验证各级别日志函数会调用对应 console 方法） */
describe("logger", () => {
  let debugSpy: any;
  let infoSpy: any;
  let warnSpy: any;
  let errorSpy: any;

  beforeEach(() => {
    debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
    infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("debug/info/warn/error 会调用对应 console 方法", () => {
    debug("a");
    info("b");
    warn("c");
    error("d");

    expect(debugSpy).toHaveBeenCalled();
    expect(infoSpy).toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();
  });

  it("logger 对象暴露同名方法", () => {
    logger.debug("a");
    logger.info("b");
    logger.warn("c");
    logger.error("d");

    expect(debugSpy).toHaveBeenCalled();
    expect(infoSpy).toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();
  });
});
