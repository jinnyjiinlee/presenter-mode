# PT 예약 SaaS — Phase 1

Next.js(App Router) + TypeScript + Supabase(PostgreSQL) + Prisma 로 만든 PT 예약 시스템의 1단계입니다.
**구글 연동 없이 자체 DB만으로 예약이 도는 것**까지가 목표입니다.

- 모든 시간은 **UTC(timestamptz)** 로 저장하고, 응답/화면에서는 **KST(Asia/Seoul)** 로 변환합니다.
- 예약 시간 겹침은 애플리케이션 재검증 + **DB의 `EXCLUDE` 제약**으로 이중 방어합니다.

---

## 스택

| 영역 | 기술 |
| --- | --- |
| 프레임워크 | Next.js 15 (App Router), TypeScript |
| DB | Supabase (PostgreSQL) |
| ORM | Prisma 6 |
| API | `app/api/**/route.ts` (Route Handlers) |

---

## 1) Supabase 프로젝트 생성 → 연결 문자열 `.env` 설정

1. [supabase.com](https://supabase.com) 에서 프로젝트를 생성합니다.
2. 대시보드 → **Project Settings → Database → Connection string** 로 이동합니다.
3. 두 가지 연결 문자열이 필요합니다.
   - **Connection pooling (Transaction, 포트 `6543`)** → 앱 런타임용 `DATABASE_URL`
   - **Direct connection (포트 `5432`)** → Prisma Migrate 용 `DIRECT_URL`
4. `.env.example` 을 `.env` 로 복사한 뒤 값을 채웁니다.

```bash
cp .env.example .env
```

```dotenv
# 앱 런타임 (PgBouncer, 6543)
DATABASE_URL="postgresql://postgres.[project-ref]:[YOUR-PASSWORD]@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"

# Prisma Migrate 전용 직접 연결 (5432)
DIRECT_URL="postgresql://postgres.[project-ref]:[YOUR-PASSWORD]@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres"
```

> `[project-ref]`, `[YOUR-PASSWORD]`, 리전(`aws-0-ap-northeast-2` 등)은 본인 프로젝트 값으로 교체하세요.
> Prisma 는 `schema.prisma` 의 `directUrl` 설정을 통해 마이그레이션 시 `DIRECT_URL` 을 사용합니다.

---

## 2) Prisma 마이그레이션 & `EXCLUDE` SQL 적용법

이 프로젝트는 **Prisma migration 폴더에 raw SQL 마이그레이션으로** 겹침 방지 제약을 관리합니다
(`supabase/migrations` 대신 `prisma/migrations` 방식을 택했습니다).

```
prisma/migrations/
├── 20240101000000_init/                       # 테이블/enum/인덱스/FK
└── 20240101000001_booking_exclude_constraint/ # btree_gist + EXCLUDE 제약
```

의존성 설치 후 마이그레이션을 배포합니다.

```bash
npm install
npx prisma generate          # Prisma Client 생성
npx prisma migrate deploy    # 두 마이그레이션(init + EXCLUDE) 을 순서대로 적용
```

`migrate deploy` 가 적용하는 핵심 SQL (`20240101000001_booking_exclude_constraint/migration.sql`):

```sql
-- gist 에서 스칼라 = 비교를 쓰기 위한 확장
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 같은 트레이너의 CONFIRMED 예약끼리 시간이 겹치면 원천 차단
ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_no_overlap"
  EXCLUDE USING gist (
    trainer_id WITH =,
    tstzrange(start_at, end_at) WITH &&
  ) WHERE (status = 'CONFIRMED');   -- partial: 확정 예약끼리만
```

> **왜 raw SQL 인가?** Prisma 스키마 문법으로는 `EXCLUDE` 제약을 표현할 수 없습니다.
> 그래서 스키마는 Prisma 가, 제약은 raw SQL 마이그레이션이 담당합니다.

### 스키마를 바꿀 때 (개발 중)

`schema.prisma` 를 수정하면 새 마이그레이션을 생성합니다.

```bash
npx prisma migrate dev --name <변경_이름>
```

`EXCLUDE` 마이그레이션은 그대로 두면 되고, 스키마 변경 마이그레이션만 추가로 쌓입니다.

---

## 3) Seed 실행 → dev 실행

```bash
npm run db:seed   # 테넌트 1 / 트레이너 1(월~금 09:00~21:00) / 회원 1(10회권) 생성
npm run dev       # http://localhost:3000
```

`db:seed` 는 콘솔에 `trainerId` 와 `membershipId` 를 출력합니다.

- 예약 페이지: `http://localhost:3000/book/<trainerId>`
- 페이지에서 `membershipId` 입력 → 날짜 선택 → 빈 슬롯 클릭 → 예약

전체 순서 요약:

```bash
cp .env.example .env          # 1) 연결 문자열 설정
# .env 편집 …
npm install
npx prisma generate
npx prisma migrate deploy     # 2) 마이그레이션 + EXCLUDE 적용
npm run db:seed               # 3) 시드
npm run dev                   #    개발 서버
```

---

## API

### `GET /api/trainers/:id/slots?date=YYYY-MM-DD&duration=60`

해당 요일의 `AvailabilityRule` 가용시간에서 `CONFIRMED` 예약을 뺀 `duration`(분) 단위 빈 슬롯 배열.

```jsonc
{
  "trainerId": "…",
  "date": "2026-07-20",
  "duration": 60,
  "slots": [
    { "startAt": "2026-07-20T00:00:00.000Z", "endAt": "2026-07-20T01:00:00.000Z", "startKst": "09:00", "endKst": "10:00" }
  ]
}
```

- 과거 슬롯과 이미 예약된 슬롯은 제외됩니다.
- `date`/`duration` 이 잘못되면 `400`, 없는 트레이너면 `404`.

### `POST /api/bookings`

```jsonc
// body
{ "membershipId": "…", "trainerId": "…", "startAt": "2026-07-20T00:00:00.000Z", "duration": 60 }
```

Prisma 트랜잭션 안에서 순서대로:

1. 회원권 잔여(`totalSessions - usedSessions > 0`) + 만료일 확인
2. 슬롯이 여전히 비어있는지 재검증
3. `Booking` 생성 (`status=CONFIRMED`)
4. `Membership.usedSessions += 1`

응답 코드:

| 상황 | 코드 |
| --- | --- |
| 성공 | `201` |
| 시간 겹침 (재검증 또는 `EXCLUDE` 위반) | `409` |
| 잔여 없음 / 만료 / 회원권-트레이너 불일치 | `422` |
| 회원권 없음 | `404` |
| 잘못된 입력 | `400` |

### `DELETE /api/bookings/:id`

- 예약 시작까지 남은 시간이 테넌트의 `cancelPolicyHours` 이내면 취소 거부 → `422`.
- 취소 성공 시 `status=CANCELLED`, `cancelledAt` 기록, `Membership.usedSessions -= 1`.

---

## 데이터 모델

`prisma/schema.prisma` 참고. 테이블/컬럼은 snake_case 로 매핑됩니다.

- `Tenant` — `name`, `timezone`(기본 `Asia/Seoul`), `cancelPolicyHours`(기본 24)
- `Trainer` — `tenantId`, `name`
- `AvailabilityRule` — `trainerId`, `weekday`(0=일 … 6=토), `startTime`/`endTime`("HH:mm", KST 벽시계)
- `Member` — `tenantId`, `name`, `phone`
- `Membership` — `memberId`, `trainerId`, `totalSessions`, `usedSessions`, `expiresAt`
- `Booking` — `membershipId`, `trainerId`, `startAt`/`endAt`(timestamptz), `status`(CONFIRMED/CANCELLED/COMPLETED/NO_SHOW), `cancelledAt`, `googleEventId`(nullable, Phase 2 구글 연동용)

---

## 시간 처리 원칙

- DB 저장: **UTC** (`@db.Timestamptz`). `AvailabilityRule` 의 시간만 "HH:mm" KST 벽시계 문자열.
- 응답/화면: **KST(Asia/Seoul)** 로 변환 (`src/lib/time.ts`).
- Asia/Seoul 은 DST 가 없어 항상 UTC+09:00 이므로 고정 오프셋으로 변환합니다.
