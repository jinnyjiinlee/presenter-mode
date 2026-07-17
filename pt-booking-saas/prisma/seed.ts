import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // 재실행 가능하도록 기존 데이터 정리 (개발용 seed).
  // FK onDelete: Cascade 이므로 tenant/member 만 지워도 하위가 함께 삭제됩니다.
  await prisma.booking.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.availabilityRule.deleteMany();
  await prisma.trainer.deleteMany();
  await prisma.member.deleteMany();
  await prisma.tenant.deleteMany();

  // 테넌트 1
  const tenant = await prisma.tenant.create({
    data: {
      name: "데이포커스 PT 스튜디오",
      timezone: "Asia/Seoul",
      cancelPolicyHours: 24,
    },
  });

  // 트레이너 1 (월~금 09:00~21:00 가용)
  const trainer = await prisma.trainer.create({
    data: {
      tenantId: tenant.id,
      name: "김트레이너",
    },
  });

  // weekday: 0=일 ... 6=토. 월~금 = 1~5
  for (const weekday of [1, 2, 3, 4, 5]) {
    await prisma.availabilityRule.create({
      data: {
        trainerId: trainer.id,
        weekday,
        startTime: "09:00",
        endTime: "21:00",
      },
    });
  }

  // 회원 1
  const member = await prisma.member.create({
    data: {
      tenantId: tenant.id,
      name: "홍길동",
      phone: "010-1234-5678",
    },
  });

  // 10회권 (오늘 기준 90일 뒤 만료)
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 90);

  const membership = await prisma.membership.create({
    data: {
      memberId: member.id,
      trainerId: trainer.id,
      totalSessions: 10,
      usedSessions: 0,
      expiresAt,
    },
  });

  console.log("✅ Seed 완료");
  console.log("──────────────────────────────────────────────");
  console.log("tenantId      :", tenant.id);
  console.log("trainerId     :", trainer.id);
  console.log("memberId      :", member.id);
  console.log("membershipId  :", membership.id);
  console.log("──────────────────────────────────────────────");
  console.log(`회원용 조회 링크 : /t/${trainer.id}`);
  console.log(`선생님 설정      : /t/${trainer.id}/settings`);
  console.log(`셀프 예약 데모   : /book/${trainer.id} (membershipId 필요)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
