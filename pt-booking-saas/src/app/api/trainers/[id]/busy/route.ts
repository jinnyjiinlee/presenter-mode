import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/http";
import { addMinutes, kstDateTimeLabel } from "@/lib/time";

// POST /api/trainers/:id/busy
// body: { startAt(ISO), duration(분), note? }
// 선생님이 특정 시간을 수동으로 막습니다 (카톡으로 확정한 수업 등).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: trainerId } = await params;

  const trainer = await prisma.trainer.findUnique({ where: { id: trainerId } });
  if (!trainer) {
    return errorResponse(404, "TRAINER_NOT_FOUND", "트레이너를 찾을 수 없습니다.");
  }

  let body: { startAt?: string; duration?: number; note?: string };
  try {
    body = await req.json();
  } catch {
    return errorResponse(400, "INVALID_JSON", "본문(JSON)을 파싱할 수 없습니다.");
  }

  const { startAt, duration, note } = body;
  if (!startAt || duration === undefined) {
    return errorResponse(400, "MISSING_FIELDS", "startAt, duration 이 필요합니다.");
  }
  if (!Number.isInteger(duration) || duration <= 0 || duration > 24 * 60) {
    return errorResponse(400, "INVALID_DURATION", "duration 은 1~1440(분) 사이의 정수여야 합니다.");
  }
  const start = new Date(startAt);
  if (Number.isNaN(start.getTime())) {
    return errorResponse(400, "INVALID_START_AT", "startAt 은 유효한 ISO 시각이어야 합니다.");
  }
  const end = addMinutes(start, duration);

  const block = await prisma.busyBlock.create({
    data: {
      trainerId,
      startAt: start,
      endAt: end,
      source: "MANUAL",
      note: note?.slice(0, 200) ?? null,
    },
  });

  return NextResponse.json(
    {
      id: block.id,
      trainerId: block.trainerId,
      startAt: block.startAt.toISOString(),
      endAt: block.endAt.toISOString(),
      startKst: kstDateTimeLabel(block.startAt),
      endKst: kstDateTimeLabel(block.endAt),
      source: block.source,
      note: block.note,
    },
    { status: 201 },
  );
}
