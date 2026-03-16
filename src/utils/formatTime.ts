/**
 * 格式化时钟显示时间
 * @param date 日期对象
 * @returns 格式化的时间字符串 (HH:MM:SS)
 */
export function formatClock(date: Date): string {
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const seconds = date.getSeconds().toString().padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

/**
 * 格式化计时器时间（倒计时和秒表）
 * @param totalSeconds 总秒数
 * @returns 格式化的时间字符串 (MM:SS 或 HH:MM:SS)
 */
export function formatTimer(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  } else {
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }
}

/**
 * 格式化秒表时间
 * @param totalMilliseconds 总毫秒数
 * @returns 格式化的时间字符串 (MM:SS 或 HH:MM:SS)
 */
export function formatStopwatch(totalMilliseconds: number): string {
  const totalSeconds = Math.floor(totalMilliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

/**
 * 将时分秒转换为总秒数
 * @param hours 小时
 * @param minutes 分钟
 * @param seconds 秒
 * @returns 总秒数
 */
export function timeToSeconds(hours: number, minutes: number, seconds: number): number {
  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * 将总秒数转换为时分秒对象
 * @param totalSeconds 总秒数
 * @returns 包含小时、分钟、秒的对象
 */
export function secondsToTime(totalSeconds: number): {
  hours: number;
  minutes: number;
  seconds: number;
} {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { hours, minutes, seconds };
}
