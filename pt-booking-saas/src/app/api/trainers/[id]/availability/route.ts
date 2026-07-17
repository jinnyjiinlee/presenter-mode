import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/http";

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// GET /api/trainers/:id/availability
// 요일별 가능 시간 규칙 목록.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: trainerId } = await params;

  const trainer = await prisma.trainer.findUnique({ where: { id: trainerId } });
  if (!trainer) {
    return errorResponse(404, "TRAINER_NOT_FOUND", "트레이너를 찾을 수 없습니다.");
  }

  const rules = await prisma.availabilityRule.findMany({
    where: { trainerId },
    orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
    select: { id: true, weekday: true, startTime: true, endTime: true },
  });

  return NextResponse.json({ trainerId, rules });
}

// PUT /api/trainers/:id/availability
// body: { rules: [{ weekday: 0~6, startTime: "HH:mm", endTime: "HH:mm" }] }
// 트레이너의 요일별 가능 시간을 통째로 교체합니다.
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: trainerId } = await params;

  const trainer = await prisma.trainer.findUnique({ where: { id: trainerId } });
  if (!trainer) {
    return errorResponse(404, "TRAINER_NOT_FOUND", "트레이너를 찾을 수 없습니다.");
  }

  let body: { rules?: { weekday?: number; startTime?: string; endTime?: string }[] };
  try {
    body = await req.json();
  } catch {
    return errorResponse(400, "INVALID_JSON", "본문(JSON)을 파싱할 수 없습니다.");
  }

  if (!Array.isArray(body.rules)) {
    return errorResponse(400, "MISSING_RULES", "rules 배열이 필요합니다.");
  }

  for (const r of body.rules) {
    if (
      !Number.isInteger(r.weekday) ||
      (r.weekday as number) < 0 ||
      (r.weekday as number) > 6
    ) {
      return errorResponse(400, "INVALID_WEEKDAY", "weekday 는 0(일)~6(토) 정수여야 합니다.");
    }
    if (!r.startTime || !TIME_RE.test(r.startTime) || !r.endTime || !TIME_RE.test(r.endTime)) {
      return errorResponse(400, "INVALID_TIME", "startTime/endTime 은 HH:mm 형식이어야 합니다.");
    }
    if (r.startTime >= r.endTime) {
      return errorResponse(400, "INVALID_RANGE", "startTime 은 endTime 보다 앞서야 합니다.");
    }
  }

  const rules = await prisma.$transaction(async (tx) => {
    await tx.availabilityRule.deleteMany({ where: { trainerId } });
    await tx.availabilityRule.createMany({
      data: body.rules!.map((r) => ({
        trainerId,
        weekday: r.weekday as number,
        startTime: r.startTime as string,
        endTime: r.endTime as string,
      })),
    });
    return tx.availabilityRule.findMany({
      where: { trainerId },
      orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
      select: { id: true, weekday: true, startTime: true, endTime: true },
    });
  });

  return NextResponse.json({ trainerId, rules });
}
