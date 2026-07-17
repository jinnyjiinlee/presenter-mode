"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";

type Slot = {
  startAt: string;
  endAt: string;
  startKst: string;
  endKst: string;
};

type Notice = { type: "ok" | "err"; text: string } | null;

const DURATION = 60;

/** 오늘 날짜를 KST 기준 "YYYY-MM-DD" 로. */
function todayKst(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return parts; // en-CA => YYYY-MM-DD
}

export default function BookPage() {
  const params = useParams<{ trainerId: string }>();
  const trainerId = params.trainerId;

  const [membershipId, setMembershipId] = useState("");
  const [date, setDate] = useState(todayKst());
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(false);
  const [booking, setBooking] = useState<string | null>(null); // startAt 중인 슬롯
  const [notice, setNotice] = useState<Notice>(null);

  const loadSlots = useCallback(async () => {
    setLoading(true);
    setNotice(null);
    try {
      const res = await fetch(
        `/api/trainers/${trainerId}/slots?date=${date}&duration=${DURATION}`,
      );
      const data = await res.json();
      if (!res.ok) {
        setSlots([]);
        setNotice({ type: "err", text: data.message ?? "슬롯을 불러오지 못했습니다." });
        return;
      }
      setSlots(data.slots ?? []);
    } catch {
      setSlots([]);
      setNotice({ type: "err", text: "네트워크 오류로 슬롯을 불러오지 못했습니다." });
    } finally {
      setLoading(false);
    }
  }, [trainerId, date]);

  useEffect(() => {
    loadSlots();
  }, [loadSlots]);

  const book = async (slot: Slot) => {
    if (!membershipId.trim()) {
      setNotice({ type: "err", text: "먼저 회원권 ID(membershipId)를 입력하세요." });
      return;
    }
    setBooking(slot.startAt);
    setNotice(null);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          membershipId: membershipId.trim(),
          trainerId,
          startAt: slot.startAt,
          duration: DURATION,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNotice({ type: "err", text: `예약 실패: ${data.message ?? data.error}` });
      } else {
        setNotice({
          type: "ok",
          text: `예약 완료! ${data.startKst} ~ ${data.endKst} (예약 ID: ${data.id})`,
        });
      }
      // 성공/실패 무관하게 슬롯 목록 최신화
      await loadSlots();
    } catch {
      setNotice({ type: "err", text: "네트워크 오류로 예약하지 못했습니다." });
    } finally {
      setBooking(null);
    }
  };

  return (
    <main className="container">
      <div className="card">
        <h1>PT 예약</h1>
        <p className="muted">트레이너 ID: {trainerId}</p>

        <label htmlFor="membershipId">회원권 ID (membershipId)</label>
        <input
          id="membershipId"
          value={membershipId}
          placeholder="seed 실행 시 출력된 membershipId 를 붙여넣으세요"
          onChange={(e) => setMembershipId(e.target.value)}
        />

        <label htmlFor="date">날짜</label>
        <input
          id="date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />

        {notice && <div className={`notice ${notice.type}`}>{notice.text}</div>}

        <label style={{ marginTop: 24 }}>
          빈 슬롯 ({DURATION}분 단위)
        </label>
        {loading ? (
          <p className="empty">불러오는 중…</p>
        ) : slots.length === 0 ? (
          <p className="empty">예약 가능한 슬롯이 없습니다.</p>
        ) : (
          <div className="slot-grid">
            {slots.map((slot) => (
              <button
                key={slot.startAt}
                className="slot"
                disabled={booking !== null}
                onClick={() => book(slot)}
              >
                {booking === slot.startAt ? "예약 중…" : slot.startKst}
              </button>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
