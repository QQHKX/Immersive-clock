import { EventEmitter } from "events";

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { dnsLookupMock, createSocketMock } = vi.hoisted(() => ({
  dnsLookupMock: vi.fn(),
  createSocketMock: vi.fn(),
}));

vi.mock("dns", () => ({
  default: {
    promises: {
      lookup: dnsLookupMock,
    },
  },
}));

vi.mock("dgram", () => ({
  default: {
    createSocket: createSocketMock,
  },
}));

import { queryNtpOnce } from "../../../electron/ntpService/ntpClient";

const NTP_EPOCH_DELTA_SEC = 2_208_988_800n;
const TWO_POW_32 = 4_294_967_296n;

function writeNtpTimestamp(buf: Buffer, offset: number, unixEpochMs: number): void {
  const msInt = BigInt(Math.trunc(unixEpochMs));
  const unixSec = msInt / 1000n;
  const remainderMs = msInt % 1000n;
  const seconds = unixSec + NTP_EPOCH_DELTA_SEC;
  const fraction = (remainderMs * TWO_POW_32) / 1000n;
  buf.writeUInt32BE(Number(seconds & 0xffff_ffffn), offset);
  buf.writeUInt32BE(Number(fraction & 0xffff_ffffn), offset + 4);
}

class FakeSocket extends EventEmitter {
  closeMock = vi.fn();

  close(): void {
    this.closeMock();
  }

  send(buf: Buffer, _port: number, _address: string, cb: (err?: Error | null) => void): void {
    cb(null);

    const response = Buffer.alloc(48);
    writeNtpTimestamp(response, 24, 1000);
    writeNtpTimestamp(response, 32, 1050);
    writeNtpTimestamp(response, 40, 1060);

    queueMicrotask(() => {
      this.emit("message", response);
    });
  }
}

describe("ntpClient", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("queryNtpOnce 能解析响应并计算 offset/rtt", async () => {
    dnsLookupMock.mockResolvedValue({ address: "1.2.3.4" });

    const socket = new FakeSocket();
    createSocketMock.mockReturnValue(socket);

    vi.spyOn(Date, "now")
      .mockImplementationOnce(() => 1000)
      .mockImplementationOnce(() => 1100);

    const res = await queryNtpOnce({ host: "pool.ntp.org", port: 123, timeoutMs: 2000 });

    expect(res.measuredAt).toBe(1100);
    expect(res.rttMs).toBe(90);
    expect(res.offsetMs).toBeGreaterThanOrEqual(4);
    expect(res.offsetMs).toBeLessThanOrEqual(5);
    expect(res.serverEpochMs).toBeGreaterThanOrEqual(1059);
    expect(res.serverEpochMs).toBeLessThanOrEqual(1060);
  });

  it("queryNtpOnce 在超时后抛错", async () => {
    dnsLookupMock.mockResolvedValue({ address: "1.2.3.4" });

    const socket = new FakeSocket();
    socket.send = (
      _buf: Buffer,
      _port: number,
      _address: string,
      cb: (err?: Error | null) => void
    ) => {
      cb(null);
    };
    createSocketMock.mockReturnValue(socket);

    vi.useFakeTimers();

    const p = queryNtpOnce({ host: "pool.ntp.org", port: 123, timeoutMs: 500 });
    const settled = p.then(
      () => ({ ok: true as const }),
      (e) => ({ ok: false as const, error: e })
    );
    await vi.advanceTimersByTimeAsync(600);
    const r = await settled;
    expect(r.ok).toBe(false);
    expect(String((r as { ok: false; error: unknown }).error)).toMatch(/超时/);
  });
});
