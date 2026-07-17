import { NextResponse } from "next/server";

/** 트랜잭션 내부에서 던져 라우트 핸들러가 상태코드로 변환하는 에러. */
export class HttpError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message?: string) {
    super(message ?? code);
    this.status = status;
    this.code = code;
  }
}

export function errorResponse(status: number, code: string, message?: string) {
  return NextResponse.json({ error: code, message: message ?? code }, { status });
}

/**
 * Postgres EXCLUDE 제약(bookings_no_overlap) 위반인지 판별합니다.
 * Prisma 는 exclusion_violation(SQLSTATE 23P01)을 전용 코드로 매핑하지 않으므로
 * 에러 내용(코드/메시지/제약명)을 폭넓게 확인합니다.
 */
export function isBookingOverlapViolation(err: unknown): boolean {
  const anyErr = err as {
    code?: string;
    meta?: Record<string, unknown>;
    message?: string;
  } | null;
  if (!anyErr) return false;

  const haystack = [
    anyErr.code,
    anyErr.message,
    anyErr.meta ? JSON.stringify(anyErr.meta) : undefined,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    haystack.includes("23P01") ||
    haystack.includes("exclusion") ||
    haystack.includes("bookings_no_overlap")
  );
}
