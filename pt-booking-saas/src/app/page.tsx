export default function Home() {
  return (
    <main className="container">
      <div className="card">
        <h1>PT 예약 SaaS — Phase 1</h1>
        <p className="muted">자체 DB만으로 예약이 도는 최소 구성입니다.</p>

        <div style={{ marginTop: 20 }}>
          <p className="muted" style={{ marginBottom: 8 }}>
            예약 페이지는 트레이너별로 열립니다:
          </p>
          <code
            style={{
              display: "block",
              background: "#f3f4f6",
              padding: "10px 12px",
              borderRadius: 8,
              fontSize: 14,
            }}
          >
            /book/&lt;trainerId&gt;
          </code>
          <p className="muted" style={{ marginTop: 12 }}>
            <code>npm run db:seed</code> 실행 시 콘솔에 출력되는 trainerId /
            membershipId 를 사용하세요.
          </p>
        </div>
      </div>
    </main>
  );
}
