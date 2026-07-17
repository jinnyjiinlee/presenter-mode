"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";

// 선생님용 설정 페이지.
// 1) 요일별 가능 시간(언제부터 언제까지) 설정
// 2) 특정 날짜의 시간 막기/열기 (카톡으로 확정한 수업, 개인 일정 등)
// ⚠️ Phase 이 단계에서는 로그인이 없으므로 이 링크는 선생님만 알고 있어야 합니다.

type Rule = { weekday: number; startTime: string; endTime: string };
type DayRow = { enabled: boolean; startTime: string; endTime: string };
type Slot = {
  startAt: string;
  endAt: string;
  startKst: string;
  endKst: string;
  status: "FREE" | "BOOKED" | "BLOCKED";
  blockId?: string;
};

const DURATION = 60;
const WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"];
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // 월~일 순서로 표시

function todayKst(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

const DEFAULT_ROW: DayRow = { enabled: false, startTime: "09:00", endTime: "18:00" };

export default function SettingsPage() {
  const params = useParams<{ trainerId: string }>();
  const trainerId = params.trainerId;

  // --- 요일별 가능 시간 ---
  const [rows, setRows] = useState<DayRow[]>(Array(7).fill(DEFAULT_ROW));
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // --- 시간 막기 ---
  const [date, setDate] = useState(todayKst());
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [working, setWorking] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/trainers/${trainerId}/availability`);
        const data = await res.json();
        if (!res.ok) {
          setNotice({ type: "err", text: data.message ?? "설정을 불러오지 못했습니다." });
          return;
        }
        const next: DayRow[] = Array.from({ length: 7 }, () => ({ ...DEFAULT_ROW }));
        for (const rule of data.rules as Rule[]) {
          // UI 는 요일당 구간 1개만 지원 (첫 구간 사용)
          if (!next[rule.weekday].enabled) {
            next[rule.weekday] = {
              enabled: true,
              startTime: rule.startTime,
              endTime: rule.endTime,
            };
          }
        }
        setRows(next);
      } catch {
        setNotice({ type: "err", text: "네트워크 오류로 설정을 불러오지 못했습니다." });
      }
    })();
  }, [trainerId]);

  const updateRow = (weekday: number, patch: Partial<DayRow>) => {
    setRows((prev) => prev.map((r, i) => (i === weekday ? { ...r, ...patch } : r)));
  };

  const saveRules = async () => {
    for (let w = 0; w < 7; w++) {
      const r = rows[w];
      if (r.enabled && r.startTime >= r.endTime) {
        setNotice({
          type: "err",
          text: `${WEEKDAY_KO[w]}요일: 시작 시간이 끝 시간보다 빨라야 해요.`,
        });
        return;
      }
    }
    setSaving(true);
    setNotice(null);
    try {
      const rules = rows
        .map((r, weekday) => ({ weekday, startTime: r.startTime, endTime: r.endTime, enabled: r.enabled }))
        .filter((r) => r.enabled)
        .map(({ weekday, startTime, endTime }) => ({ weekday, startTime, endTime }));
      const res = await fetch(`/api/trainers/${trainerId}/availability`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNotice({ type: "err", text: data.message ?? "저장하지 못했습니다." });
      } else {
        setNotice({ type: "ok", text: "가능 시간이 저장됐어요. 회원 링크에 바로 반영됩니다." });
        loadSlots();
      }
    } catch {
      setNotice({ type: "err", text: "네트워크 오류로 저장하지 못했습니다." });
    } finally {
      setSaving(false);
    }
  };

  const loadSlots = useCallback(async () => {
    setSlotsLoading(true);
    try {
      const res = await fetch(
        `/api/trainers/${trainerId}/slots?date=${date}&duration=${DURATION}&view=all`,
      );
      const data = await res.json();
      setSlots(res.ok ? (data.slots ?? []) : []);
    } catch {
      setSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  }, [trainerId, date]);

  useEffect(() => {
    loadSlots();
  }, [loadSlots]);

  const toggleBlock = async (slot: Slot) => {
    if (slot.status === "BOOKED") return;
    setWorking(slot.startAt);
    try {
      if (slot.status === "FREE") {
        await fetch(`/api/trainers/${trainerId}/busy`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ startAt: slot.startAt, duration: DURATION }),
        });
      } else if (slot.blockId) {
        await fetch(`/api/busy-blocks/${slot.blockId}`, { method: "DELETE" });
      }
      await loadSlots();
    } finally {
      setWorking(null);
    }
  };

  const copyLink = async () => {
    const url = `${window.location.origin}/t/${trainerId}`;
    try {
      await navigator.clipboard.writeText(url);
      setNotice({ type: "ok", text: "회원용 링크가 복사됐어요. 카톡으로 공유하세요!" });
    } catch {
      window.prompt("회원용 링크:", url);
    }
  };

  return (
    <main className="container">
      <div className="card">
        <h1>선생님 설정</h1>
        <p className="muted">
          여기서 바꾼 내용은 회원용 링크에 바로 반영돼요.
        </p>

        {notice && <div className={`notice ${notice.type}`}>{notice.text}</div>}

        <label style={{ marginTop: 20 }}>요일별 가능 시간</label>
        <div>
          {WEEKDAY_ORDER.map((w) => {
            const r = rows[w];
            return (
              <div className="weekday-row" key={w}>
                <input
                  type="checkbox"
                  checked={r.enabled}
                  onChange={(e) => updateRow(w, { enabled: e.target.checked })}
                  aria-label={`${WEEKDAY_KO[w]}요일 가능`}
                />
                <span className="day">{WEEKDAY_KO[w]}</span>
                {r.enabled ? (
                  <>
                    <input
                      type="time"
                      value={r.startTime}
                      step={600}
                      onChange={(e) => updateRow(w, { startTime: e.target.value })}
                    />
                    <span className="tilde">~</span>
                    <input
                      type="time"
                      value={r.endTime}
                      step={600}
                      onChange={(e) => updateRow(w, { endTime: e.target.value })}
                    />
                  </>
                ) : (
                  <span className="off">쉬는 날</span>
                )}
              </div>
            );
          })}
        </div>
        <button className="primary" disabled={saving} onClick={saveRules}>
          {saving ? "저장 중…" : "가능 시간 저장"}
        </button>

        <label style={{ marginTop: 32 }}>특정 시간 막기 / 열기</label>
        <p className="muted" style={{ margin: "0 0 8px" }}>
          카톡으로 수업이 확정되면 그 시간을 눌러 막아주세요. 막힌 시간을 다시 누르면 열려요.
        </p>
        <input
          type="date"
          value={date}
          min={todayKst()}
          onChange={(e) => setDate(e.target.value)}
        />
        {slotsLoading ? (
          <p className="empty">불러오는 중…</p>
        ) : slots.length === 0 ? (
          <p className="empty">이 날은 가능 시간이 없어요 (요일 설정을 확인하세요).</p>
        ) : (
          <>
            <div className="slot-grid" style={{ marginTop: 12 }}>
              {slots.map((slot) => (
                <button
                  key={slot.startAt}
                  className={`slot${slot.status === "BLOCKED" ? " blocked" : ""}${slot.status === "BOOKED" ? " booked" : ""}`}
                  disabled={slot.status === "BOOKED" || working !== null}
                  onClick={() => toggleBlock(slot)}
                >
                  {working === slot.startAt ? "…" : slot.startKst}
                </button>
              ))}
            </div>
            <div className="legend">
              <span><span className="dot free" />비어있음</span>
              <span><span className="dot blocked" />막음 (눌러서 열기)</span>
              <span><span className="dot booked" />예약됨</span>
            </div>
          </>
        )}

        <button className="primary" style={{ background: "#111827" }} onClick={copyLink}>
          회원용 링크 복사
        </button>
      </div>
    </main>
  );
}
