-- CreateEnum
CREATE TYPE "BusySource" AS ENUM ('MANUAL', 'GOOGLE');

-- CreateTable
CREATE TABLE "busy_blocks" (
    "id" TEXT NOT NULL,
    "trainer_id" TEXT NOT NULL,
    "start_at" TIMESTAMPTZ(3) NOT NULL,
    "end_at" TIMESTAMPTZ(3) NOT NULL,
    "source" "BusySource" NOT NULL DEFAULT 'MANUAL',
    "google_event_id" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "busy_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "busy_blocks_trainer_id_start_at_idx" ON "busy_blocks"("trainer_id", "start_at");

-- AddForeignKey
ALTER TABLE "busy_blocks" ADD CONSTRAINT "busy_blocks_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "trainers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
