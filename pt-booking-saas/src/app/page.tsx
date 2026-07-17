export default function Home() {
  return (
    <main className="container">
      <div className="card">
        <h1>PT 예약 SaaS — Phase 1</h1>
        <p className="muted">자체 DB만으로 예약이 도는 최소 구성입니다.</p>

        <div style={{ marginTop: 20 }}>
          <p className="muted" style={{ marginBottom: 8 }}>
            페이지는 트레이너별로 열립니다:
          </p>
          <code
            style={{
              display: "block",
              background: "#f3f4f6",
              padding: "10px 12px",
              borderRadius: 8,
              fontSize: 14,
              lineHeight: 1.9,
            }}
          >
            /t/&lt;trainerId&gt; — 회원용 빈 시간 조회 (카톡 공유용)
            <br />
            /t/&lt;trainerId&gt;/settings — 선생님 설정 (가능 시간·시간 막기)
            <br />
            /book/&lt;trainerId&gt; — 셀프 예약 데모 (Phase 1)
          </code>
          <p className="muted" style={{ marginTop: 12 }}>
            <code>npm run db:seed</code> 실행 시 콘솔에 출력되는 trainerId 를
            사용하세요.
          </p>
        </div>
      </div>
    </main>
  );
}
