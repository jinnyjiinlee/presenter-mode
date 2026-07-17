// 시간 유틸.
//
// 저장은 전부 UTC(Date/timestamptz). 화면/응답 표기는 KST(Asia/Seoul).
// Asia/Seoul 은 DST 가 없고 항상 UTC+09:00 이므로 고정 오프셋으로 안전하게 변환합니다.

export const KST_OFFSET = "+09:00";

/**
 * KST 벽시계(날짜 + "HH:mm")를 UTC 순간(Date)으로 변환합니다.
 * 예) ("2026-07-17", "09:00") -> 2026-07-17T00:00:00.000Z
 */
export function kstWallClockToUtc(dateStr: string, timeStr: string): Date {
  const normalized = timeStr.length === 5 ? `${timeStr}:00` : timeStr; // "HH:mm" -> "HH:mm:ss"
  const d = new Date(`${dateStr}T${normalized}${KST_OFFSET}`);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid KST wall clock: ${dateStr} ${timeStr}`);
  }
  return d;
}

/**
 * "YYYY-MM-DD" 날짜의 요일(0=일 ... 6=토, JS getUTCDay 기준)을 반환합니다.
 * 달력상의 요일은 타임존과 무관하므로 UTC 자정으로 계산합니다.
 */
export function weekdayOfDate(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Date 에 분을 더한 새 Date 를 반환합니다. */
export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

/** 두 구간 [aStart, aEnd) 과 [bStart, bEnd) 가 겹치는지 여부. */
export function rangesOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/** UTC 순간을 KST "HH:mm" 라벨로. 예) 2026-07-17T00:00:00Z -> "09:00" */
export function kstTimeLabel(date: Date): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

/** UTC 순간을 KST "YYYY-MM-DD HH:mm" 형태로. */
export function kstDateTimeLabel(date: Date): string {
  const parts = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`;
}

/** "YYYY-MM-DD" 형식 검증. */
export function isValidDateStr(s: string | null): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
}
