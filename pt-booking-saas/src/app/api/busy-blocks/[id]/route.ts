import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/http";

// DELETE /api/busy-blocks/:id
// 수동으로 막은 시간을 다시 엽니다. GOOGLE 소스 블록은 동기화가 관리하므로 여기서 못 지웁니다.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const block = await prisma.busyBlock.findUnique({ where: { id } });
  if (!block) {
    return errorResponse(404, "BLOCK_NOT_FOUND", "막은 시간을 찾을 수 없습니다.");
  }
  if (block.source !== "MANUAL") {
    return errorResponse(
      422,
      "NOT_DELETABLE",
      "구글 캘린더에서 온 일정은 여기서 지울 수 없습니다. 구글 캘린더에서 지워주세요.",
    );
  }

  await prisma.busyBlock.delete({ where: { id } });

  return NextResponse.json({ id, deleted: true });
}
