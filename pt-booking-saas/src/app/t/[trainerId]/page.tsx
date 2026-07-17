"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";

// 회원용 조회 전용 페이지.
// 빈 시간만 보여주고, 원하는 시간을 골라 카톡에 붙여넣을 문구를 복사해 갑니다.
// 예약 확정은 카톡 대화로 — 이 페이지에서는 아무것도 저장하지 않습니다.

type Slot = {
  startAt: string;
  endAt: string;
  startKst: string;
  endKst: string;
};

const DURATION = 60;
const WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"];

/** 오늘 날짜를 KST 기준 "YYYY-MM-DD" 로. */
function todayKst(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** "YYYY-MM-DD" -> "7/20(월)" */
function dateLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${m}/${d}(${WEEKDAY_KO[weekday]})`;
}

export default function AvailabilityPage() {
  const params = useParams<{ trainerId: string }>();
  const trainerId = params.trainerId;

  const [date, setDate] = useState(todayKst());
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSlots = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSelected(new Set());
    setCopied(false);
    try {
      const res = await fetch(
        `/api/trainers/${trainerId}/slots?date=${date}&duration=${DURATION}`,
      );
      const data = await res.json();
      if (!res.ok) {
        setSlots([]);
        setError(data.message ?? "시간을 불러오지 못했습니다.");
        return;
      }
      setSlots(data.slots ?? []);
    } catch {
      setSlots([]);
      setError("네트워크 오류로 시간을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [trainerId, date]);

  useEffect(() => {
    loadSlots();
  }, [loadSlots]);

  const toggle = (startAt: string) => {
    setCopied(false);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(startAt)) next.delete(startAt);
      else next.add(startAt);
      return next;
    });
  };

  const copyMessage = async () => {
    const chosen = slots.filter((s) => selected.has(s.startAt));
    if (chosen.length === 0) return;
    const times = chosen.map((s) => s.startKst).join(", ");
    const text = `선생님, ${dateLabel(date)} ${times} 중에 수업 가능할까요?`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      // 클립보드 권한이 없으면 문구를 직접 보여줍니다.
      window.prompt("아래 문구를 복사해서 카톡에 붙여넣으세요:", text);
    }
  };

  return (
    <main className="container">
      <div className="card">
        <h1>비어있는 시간 보기</h1>
        <p className="muted">
          가능한 시간을 고른 뒤 <b>문구 복사</b> → 카톡으로 선생님께 보내주세요.
          예약 확정은 선생님이 답장으로 해드립니다.
        </p>

        <label htmlFor="date">날짜</label>
        <input
          id="date"
          type="date"
          value={date}
          min={todayKst()}
          onChange={(e) => setDate(e.target.value)}
        />

        {error && <div className="notice err">{error}</div>}

        <label style={{ marginTop: 24 }}>
          {dateLabel(date)} 비어있는 시간 ({DURATION}분 수업)
        </label>
        {loading ? (
          <p className="empty">불러오는 중…</p>
        ) : slots.length === 0 ? (
          <p className="empty">이 날은 비어있는 시간이 없어요. 다른 날짜를 골라보세요.</p>
        ) : (
          <div className="slot-grid">
            {slots.map((slot) => (
              <button
                key={slot.startAt}
                className={`slot${selected.has(slot.startAt) ? " selected" : ""}`}
                onClick={() => toggle(slot.startAt)}
              >
                {slot.startKst}
              </button>
            ))}
          </div>
        )}

        {slots.length > 0 && (
          <button
            className="primary"
            disabled={selected.size === 0}
            onClick={copyMessage}
          >
            {selected.size === 0
              ? "시간을 골라주세요"
              : `선택한 ${selected.size}개 시간, 카톡 문구 복사`}
          </button>
        )}

        {copied && (
          <div className="notice ok">
            복사됐어요! 카톡 대화창에 붙여넣기 하세요. 📋
          </div>
        )}
      </div>
    </main>
  );
}
