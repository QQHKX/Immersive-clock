import dgram from "dgram";
import dns from "dns";

export interface NtpQueryOptions {
  host: string;
  port: number;
  timeoutMs: number;
}

export interface NtpQueryResult {
  offsetMs: number;
  rttMs: number;
  serverEpochMs: number;
  measuredAt: number;
}

const NTP_EPOCH_DELTA_SEC = 2_208_988_800n;
const TWO_POW_32 = 4_294_967_296n;

/**
 * 将 Unix Epoch 毫秒转换为 NTP 64 位时间戳（函数级注释：把毫秒时间拆成秒与 2^-32 分数，便于写入 NTP 包）
 */
function unixEpochMsToNtpTimestamp(ms: number): { seconds: bigint; fraction: bigint } {
  const msInt = BigInt(Math.trunc(ms));
  const unixSec = msInt / 1000n;
  const remainderMs = msInt % 1000n;
  const ntpSeconds = unixSec + NTP_EPOCH_DELTA_SEC;
  const ntpFraction = (remainderMs * TWO_POW_32) / 1000n;
  return { seconds: ntpSeconds, fraction: ntpFraction };
}

/**
 * 将 NTP 64 位时间戳转换为 Unix Epoch 毫秒（函数级注释：把 NTP 的秒/分数转换成 JS 可用的毫秒时间戳）
 */
function ntpTimestampToUnixEpochMs(seconds: bigint, fraction: bigint): number {
  const unixSeconds = seconds - NTP_EPOCH_DELTA_SEC;
  const msFromSeconds = unixSeconds * 1000n;
  const msFromFraction = (fraction * 1000n) / TWO_POW_32;
  return Number(msFromSeconds + msFromFraction);
}

/**
 * 读取 NTP 包中的 64 位时间戳（函数级注释：从指定偏移读取秒与分数两段 32 位大端整数）
 */
function readNtpTimestamp(buf: Buffer, offset: number): { seconds: bigint; fraction: bigint } {
  const sec = BigInt(buf.readUInt32BE(offset));
  const frac = BigInt(buf.readUInt32BE(offset + 4));
  return { seconds: sec, fraction: frac };
}

/**
 * 写入 NTP 包中的 64 位时间戳（函数级注释：将秒与分数两段 32 位大端整数写入指定偏移）
 */
function writeNtpTimestamp(buf: Buffer, offset: number, seconds: bigint, fraction: bigint): void {
  buf.writeUInt32BE(Number(seconds & 0xffff_ffffn), offset);
  buf.writeUInt32BE(Number(fraction & 0xffff_ffffn), offset + 4);
}

/**
 * 解析 NTP 响应并计算 offset/rtt（函数级注释：按 SNTP 四时间戳公式计算本地时钟偏移与往返时延）
 */
function parseNtpResponse(options: { response: Buffer; t4LocalMs: number }): NtpQueryResult {
  if (options.response.length < 48) {
    throw new Error(`NTP 响应长度不足：${options.response.length}`);
  }

  const originate = readNtpTimestamp(options.response, 24);
  const receive = readNtpTimestamp(options.response, 32);
  const transmit = readNtpTimestamp(options.response, 40);

  const t1 = ntpTimestampToUnixEpochMs(originate.seconds, originate.fraction);
  const t2 = ntpTimestampToUnixEpochMs(receive.seconds, receive.fraction);
  const t3 = ntpTimestampToUnixEpochMs(transmit.seconds, transmit.fraction);
  const t4 = Math.trunc(options.t4LocalMs);

  const delayMs = t4 - t1 - (t3 - t2);
  const offsetMs = (t2 - t1 + (t3 - t4)) / 2;

  return {
    offsetMs: Math.round(offsetMs),
    rttMs: Math.max(0, Math.round(delayMs)),
    serverEpochMs: Math.trunc(t3),
    measuredAt: t4,
  };
}

/**
 * 向 NTP 服务器发起一次查询（函数级注释：通过 UDP/123 获取服务端时间并计算本地偏移量，供渲染进程做校时）
 */
export async function queryNtpOnce(options: NtpQueryOptions): Promise<NtpQueryResult> {
  const host = String(options.host || "").trim();
  if (!host) throw new Error("NTP host 不能为空");

  const port = Number.isFinite(options.port) ? Math.trunc(options.port) : 123;
  if (port < 1 || port > 65535) throw new Error(`NTP port 非法：${options.port}`);

  const timeoutMs = Number.isFinite(options.timeoutMs) ? Math.trunc(options.timeoutMs) : 8000;
  if (timeoutMs < 500 || timeoutMs > 30000) throw new Error(`timeoutMs 非法：${options.timeoutMs}`);

  const request = Buffer.alloc(48);
  request[0] = 0x1b;

  const t1LocalMs = Date.now();
  const t1 = unixEpochMsToNtpTimestamp(t1LocalMs);
  writeNtpTimestamp(request, 40, t1.seconds, t1.fraction);

  const lookup = dns.promises.lookup(host, { family: 4 }).catch(() => ({ address: host }));
  const { address } = await lookup;

  const socket = dgram.createSocket("udp4");

  return await new Promise<NtpQueryResult>((resolve, reject) => {
    let settled = false;

    const done = (fn: () => void) => {
      if (settled) return;
      settled = true;
      try {
        socket.removeAllListeners();
        socket.close();
      } catch {
      } finally {
        fn();
      }
    };

    const timer = setTimeout(() => {
      done(() => reject(new Error(`NTP 请求超时（${timeoutMs}ms）`)));
    }, timeoutMs);

    socket.once("error", (err) => {
      clearTimeout(timer);
      done(() => reject(err));
    });

    socket.once("message", (msg) => {
      clearTimeout(timer);
      const t4LocalMs = Date.now();
      try {
        const res = parseNtpResponse({ response: msg, t4LocalMs });
        done(() => resolve(res));
      } catch (e) {
        done(() => reject(e instanceof Error ? e : new Error(String(e))));
      }
    });

    socket.send(request, port, address, (err) => {
      if (err) {
        clearTimeout(timer);
        done(() => reject(err));
      }
    });
  });
}
