/**
 * 지도 내보내기 시 포함되는 저작권 워터마크
 * 지도 좌측 하단에 표시됩니다.
 */
export default function MapWatermark({ subtitle }) {
  return (
    <div
      className="absolute bottom-8 left-4 z-[1000] pointer-events-none"
      style={{ fontFamily: 'sans-serif' }}
    >
      <div
        style={{
          background: 'rgba(255,255,255,0.88)',
          backdropFilter: 'blur(4px)',
          borderRadius: '10px',
          border: '1px solid rgba(0,0,0,0.08)',
          padding: '8px 12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
          maxWidth: '260px',
        }}
      >
        {/* 기관 */}
        <p style={{ margin: 0, fontSize: '10px', color: '#6b7280', letterSpacing: '0.03em', lineHeight: 1.4 }}>
          국립공주대학교 지리학과
        </p>
        {/* 이름 */}
        <p style={{ margin: '2px 0 0', fontSize: '13px', fontWeight: '700', color: '#1e3a5f', letterSpacing: '0.02em', lineHeight: 1.3 }}>
          임 창 민
        </p>
        {/* 부제 */}
        {subtitle && (
          <p style={{ margin: '3px 0 0', fontSize: '9px', color: '#9ca3af', lineHeight: 1.4 }}>
            {subtitle}
          </p>
        )}
        {/* 구분선 */}
        <div style={{ margin: '5px 0 4px', height: '1px', background: 'linear-gradient(to right, #c7d2fe, transparent)' }} />
        {/* 저작권 */}
        <p style={{ margin: 0, fontSize: '9px', color: '#9ca3af', lineHeight: 1.4 }}>
          © {new Date().getFullYear()} Kongju National University<br />
          Dept. of Geography · All rights reserved
        </p>
      </div>
    </div>
  )
}
