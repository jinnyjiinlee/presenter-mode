import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/http";
import {
  addMinutes,
  isValidDateStr,
  kstTimeLabel,
  kstWallClockToUtc,
  rangesOverlap,
  weekdayOfDate,
} from "@/lib/time";

type SlotStatus = "FREE" | "BOOKED" | "BLOCKED";

// GET /api/trainers/:id/slots?date=YYYY-MM-DD&duration=60[&view=all]
// 해당 요일의 AvailabilityRule 가용시간에서 CONFIRMED booking / BusyBlock 을 뺀
// duration(분) 단위의 빈 슬롯 배열을 반환합니다.
// view=all 이면 빈 슬롯뿐 아니라 BOOKED/BLOCKED 슬롯도 상태와 함께 반환합니다(설정 페이지용).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: trainerId } = await params;
  const { searchParams } = new URL(_req.url);
  const date = searchParams.get("date");
  const durationRaw = searchParams.get("duration") ?? "60";
  const duration = Number.parseInt(durationRaw, 10);
  const viewAll = searchParams.get("view") === "all";

  if (!isValidDateStr(date)) {
    return errorResponse(400, "INVALID_DATE", "date 는 YYYY-MM-DD 형식이어야 합니다.");
  }
  if (!Number.isInteger(duration) || duration <= 0 || duration > 24 * 60) {
    return errorResponse(400, "INVALID_DURATION", "duration 은 1~1440(분) 사이의 정수여야 합니다.");
  }

  const trainer = await prisma.trainer.findUnique({ where: { id: trainerId } });
  if (!trainer) {
    return errorResponse(404, "TRAINER_NOT_FOUND", "트레이너를 찾을 수 없습니다.");
  }

  const weekday = weekdayOfDate(date);
  const rules = await prisma.availabilityRule.findMany({
    where: { trainerId, weekday },
    orderBy: { startTime: "asc" },
  });

  if (rules.length === 0) {
    return NextResponse.json({ trainerId, date, duration, slots: [] });
  }

  // 해당 KST 날짜 하루에 걸치는 CONFIRMED 예약 / BusyBlock 조회 (UTC 경계로 질의).
  const dayStartUtc = kstWallClockToUtc(date, "00:00");
  const dayEndUtc = addMinutes(dayStartUtc, 24 * 60);
  const overlapWindow = {
    startAt: { lt: dayEndUtc },
    endAt: { gt: dayStartUtc },
  };

  const [bookings, busyBlocks] = await Promise.all([
    prisma.booking.findMany({
      where: { trainerId, status: "CONFIRMED", ...overlapWindow },
      select: { startAt: true, endAt: true },
    }),
    prisma.busyBlock.findMany({
      where: { trainerId, ...overlapWindow },
      select: { id: true, startAt: true, endAt: true, source: true },
    }),
  ]);

  const now = new Date();
  const seen = new Set<string>();
  const slots: {
    startAt: string;
    endAt: string;
    startKst: string;
    endKst: string;
    status: SlotStatus;
    blockId?: string;
  }[] = [];

  for (const rule of rules) {
    const ruleStart = kstWallClockToUtc(date, rule.startTime);
    const ruleEnd = kstWallClockToUtc(date, rule.endTime);

    let cursor = ruleStart;
    while (addMinutes(cursor, duration) <= ruleEnd) {
      const slotStart = cursor;
      const slotEnd = addMinutes(cursor, duration);
      const key = slotStart.toISOString();
      cursor = slotEnd;

      if (slotStart <= now || seen.has(key)) continue;
      seen.add(key);

      const isBooked = bookings.some((b) =>
        rangesOverlap(slotStart, slotEnd, b.startAt, b.endAt),
      );
      const block = busyBlocks.find((b) =>
        rangesOverlap(slotStart, slotEnd, b.startAt, b.endAt),
      );
      const status: SlotStatus = isBooked ? "BOOKED" : block ? "BLOCKED" : "FREE";

      if (!viewAll && status !== "FREE") continue;

      slots.push({
        startAt: slotStart.toISOString(),
        endAt: slotEnd.toISOString(),
        startKst: kstTimeLabel(slotStart),
        endKst: kstTimeLabel(slotEnd),
        status,
        ...(status === "BLOCKED" && block ? { blockId: block.id } : {}),
      });
    }
  }

  slots.sort((a, b) => a.startAt.localeCompare(b.startAt));

  return NextResponse.json({ trainerId, date, duration, slots });
}
