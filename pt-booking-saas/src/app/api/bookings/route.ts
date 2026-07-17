import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { HttpError, errorResponse, isBookingOverlapViolation } from "@/lib/http";
import { addMinutes, kstDateTimeLabel } from "@/lib/time";

// POST /api/bookings
// body: { membershipId, trainerId, startAt(ISO, UTC), duration(분) }
export async function POST(req: NextRequest) {
  let body: {
    membershipId?: string;
    trainerId?: string;
    startAt?: string;
    duration?: number;
  };
  try {
    body = await req.json();
  } catch {
    return errorResponse(400, "INVALID_JSON", "본문(JSON)을 파싱할 수 없습니다.");
  }

  const { membershipId, trainerId, startAt, duration } = body;

  if (!membershipId || !trainerId || !startAt || duration === undefined) {
    return errorResponse(
      400,
      "MISSING_FIELDS",
      "membershipId, trainerId, startAt, duration 이 모두 필요합니다.",
    );
  }
  if (!Number.isInteger(duration) || duration <= 0 || duration > 24 * 60) {
    return errorResponse(400, "INVALID_DURATION", "duration 은 1~1440(분) 사이의 정수여야 합니다.");
  }

  const start = new Date(startAt);
  if (Number.isNaN(start.getTime())) {
    return errorResponse(400, "INVALID_START_AT", "startAt 은 유효한 ISO 시각이어야 합니다.");
  }
  const end = addMinutes(start, duration);

  try {
    const booking = await prisma.$transaction(async (tx) => {
      // a. Membership 잔여/만료 확인
      const membership = await tx.membership.findUnique({
        where: { id: membershipId },
      });
      if (!membership) {
        throw new HttpError(404, "MEMBERSHIP_NOT_FOUND", "회원권을 찾을 수 없습니다.");
      }
      if (membership.trainerId !== trainerId) {
        throw new HttpError(
          422,
          "MEMBERSHIP_TRAINER_MISMATCH",
          "해당 회원권으로는 이 트레이너를 예약할 수 없습니다.",
        );
      }
      if (membership.totalSessions - membership.usedSessions <= 0) {
        throw new HttpError(422, "NO_REMAINING_SESSIONS", "남은 세션이 없습니다.");
      }
      if (membership.expiresAt.getTime() <= Date.now()) {
        throw new HttpError(422, "MEMBERSHIP_EXPIRED", "회원권이 만료되었습니다.");
      }

      // b. 슬롯이 여전히 비어있는지 재검증 (DB EXCLUDE 가 최종 방어선)
      const overlap = await tx.booking.findFirst({
        where: {
          trainerId,
          status: "CONFIRMED",
          startAt: { lt: end },
          endAt: { gt: start },
        },
        select: { id: true },
      });
      if (overlap) {
        throw new HttpError(409, "SLOT_TAKEN", "이미 예약된 시간대입니다.");
      }

      // c. Booking 생성 (status=CONFIRMED)
      const created = await tx.booking.create({
        data: {
          membershipId,
          trainerId,
          startAt: start,
          endAt: end,
          status: "CONFIRMED",
        },
      });

      // d. Membership.usedSessions += 1
      await tx.membership.update({
        where: { id: membershipId },
        data: { usedSessions: { increment: 1 } },
      });

      return created;
    });

    return NextResponse.json(
      {
        id: booking.id,
        membershipId: booking.membershipId,
        trainerId: booking.trainerId,
        status: booking.status,
        startAt: booking.startAt.toISOString(),
        endAt: booking.endAt.toISOString(),
        startKst: kstDateTimeLabel(booking.startAt),
        endKst: kstDateTimeLabel(booking.endAt),
      },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof HttpError) {
      return errorResponse(err.status, err.code, err.message);
    }
    // EXCLUDE 위반(동시 예약 경합) → 409
    if (isBookingOverlapViolation(err)) {
      return errorResponse(409, "SLOT_TAKEN", "이미 예약된 시간대입니다.");
    }
    console.error("POST /api/bookings failed:", err);
    return errorResponse(500, "INTERNAL_ERROR", "예약 처리 중 오류가 발생했습니다.");
  }
}
