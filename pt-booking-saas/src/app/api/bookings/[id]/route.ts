import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/http";
import { kstDateTimeLabel } from "@/lib/time";

// DELETE /api/bookings/:id
// cancelPolicyHours 이내면 취소 거부(422).
// 취소 시 status=CANCELLED, cancelledAt 기록, Membership.usedSessions -= 1.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { trainer: { include: { tenant: true } } },
  });

  if (!booking) {
    return errorResponse(404, "BOOKING_NOT_FOUND", "예약을 찾을 수 없습니다.");
  }
  if (booking.status !== "CONFIRMED") {
    return errorResponse(
      422,
      "NOT_CANCELLABLE",
      `이미 ${booking.status} 상태인 예약은 취소할 수 없습니다.`,
    );
  }

  const cancelPolicyHours = booking.trainer.tenant.cancelPolicyHours;
  const now = new Date();
  const hoursUntilStart =
    (booking.startAt.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (hoursUntilStart < cancelPolicyHours) {
    return errorResponse(
      422,
      "CANCEL_POLICY_VIOLATION",
      `예약 시작 ${cancelPolicyHours}시간 이내에는 취소할 수 없습니다.`,
    );
  }

  const cancelled = await prisma.$transaction(async (tx) => {
    const updated = await tx.booking.update({
      where: { id },
      data: { status: "CANCELLED", cancelledAt: now },
    });
    await tx.membership.update({
      where: { id: booking.membershipId },
      data: { usedSessions: { decrement: 1 } },
    });
    return updated;
  });

  return NextResponse.json({
    id: cancelled.id,
    status: cancelled.status,
    cancelledAt: cancelled.cancelledAt?.toISOString() ?? null,
    startAt: cancelled.startAt.toISOString(),
    startKst: kstDateTimeLabel(cancelled.startAt),
  });
}
