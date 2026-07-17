-- 시간 겹침을 DB 레벨에서 원천 차단하기 위한 EXCLUDE 제약.
-- Prisma 스키마로는 EXCLUDE 를 표현할 수 없으므로 raw SQL 마이그레이션으로 관리합니다.

-- gist 인덱스에서 스칼라 동등비교(trainer_id WITH =)를 쓰려면 btree_gist 확장이 필요합니다.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 같은 트레이너의 CONFIRMED 예약끼리 시간 범위가 겹치면 INSERT/UPDATE 를 거부합니다.
--   - trainer_id WITH =            : 같은 트레이너에 대해서만
--   - tstzrange(start_at, end_at) WITH &&  : 시간 범위가 겹치면(&&)
--   - WHERE (status = 'CONFIRMED') : partial — 확정 예약끼리만 검사(취소/완료/노쇼는 제외)
-- tstzrange 는 기본 '[)' (시작 포함, 끝 제외) 이므로 09:00~10:00 과 10:00~11:00 은 겹치지 않습니다.
ALTER TABLE "bookings"
    ADD CONSTRAINT "bookings_no_overlap"
    EXCLUDE USING gist (
        trainer_id WITH =,
        tstzrange(start_at, end_at) WITH &&
    ) WHERE (status = 'CONFIRMED');
