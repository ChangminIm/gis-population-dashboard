const GISTAR_COLORS = {
  hot_99: '#b2182b', hot_95: '#ef8a62', hot_90: '#fddbc7',
  ns: '#f0f0f0',
  cold_90: '#d1e5f0', cold_95: '#67a9cf', cold_99: '#2166ac',
}
const MORAN_COLORS = { HH: '#d7191c', LL: '#2c7bb6', HL: '#fdae61', LH: '#abd9e9', ns: '#f0f0f0' }

const WEIGHT_OPTIONS = [
  { value: 'knn',      label: 'K-최근접 이웃 (KNN)',    desc: '각 지역에서 가장 가까운 k개 이웃을 인접으로 정의' },
  { value: 'distance', label: '거리 기준 (Distance Band)', desc: '설정한 거리(km) 이내 지역을 모두 인접으로 정의' },
  { value: 'queen',    label: 'Queen 인접',              desc: '변 또는 꼭짓점을 공유하는 모든 인접 지역 포함' },
  { value: 'rook',     label: 'Rook 인접',               desc: '변(선분)을 공유하는 인접 지역만 포함 (상하좌우)' },
  { value: 'bishop',   label: 'Bishop 인접',             desc: '꼭짓점(점)만 공유하는 인접 지역만 포함 (대각선)' },
]

function SummaryBar({ results, statType }) {
  if (!results || results.length === 0) return null
  const palette = statType === 'moran' ? MORAN_COLORS : GISTAR_COLORS
  const counts = {}
  results.forEach((r) => { counts[r.cls] = (counts[r.cls] || 0) + 1 })
  const total = results.length
  const order = statType === 'moran'
    ? ['HH', 'HL', 'LH', 'LL', 'ns']
    : ['hot_99', 'hot_95', 'hot_90', 'ns', 'cold_90', 'cold_95', 'cold_99']
  const labels = statType === 'moran'
    ? { HH: 'HH', HL: 'HL', LH: 'LH', LL: 'LL', ns: 'N/S' }
    : { hot_99: 'H99', hot_95: 'H95', hot_90: 'H90', ns: 'N/S', cold_90: 'C90', cold_95: 'C95', cold_99: 'C99' }

  return (
    <div className="px-4 py-3 border-b border-gray-100">
      <p className="text-xs font-semibold text-gray-500 mb-2">분류 결과 ({total}개 시군구)</p>
      <div className="flex h-4 rounded overflow-hidden w-full mb-2">
        {order.map((key) => {
          const cnt = counts[key] || 0
          if (cnt === 0) return null
          return (
            <div key={key} style={{ width: `${(cnt / total) * 100}%`, backgroundColor: palette[key] }}
              title={`${labels[key]}: ${cnt}개`} />
          )
        })}
      </div>
      <div className="grid grid-cols-2 gap-1">
        {order.map((key) => {
          const cnt = counts[key] || 0
          if (cnt === 0) return null
          return (
            <div key={key} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: palette[key], border: '1px solid #ccc' }} />
              <span className="text-[10px] text-gray-600">{labels[key]}: {cnt}개</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function HotspotPanel({
  year, onYearChange, years,
  variable, onVariableChange,
  statType, onStatTypeChange,
  weightType, onWeightTypeChange,
  k, onKChange,
  distKm, onDistKmChange,
  onRun, loading, results, statInfo, selectedRegion,
}) {
  const currentWeight = WEIGHT_OPTIONS.find((o) => o.value === weightType)

  return (
    <aside className="w-72 min-w-[240px] h-full bg-white border-r border-gray-200 flex flex-col shadow-md z-10 overflow-y-auto">
      {/* 헤더 */}
      <div className="px-5 py-4 bg-indigo-700 text-white flex-shrink-0">
        <h1 className="text-base font-bold leading-tight">핫스팟 분석</h1>
        <p className="text-xs text-indigo-200 mt-0.5">전국 시군구 공간 자기상관</p>
      </div>

      {/* 분석 방법 */}
      <div className="px-4 pt-3 pb-2 border-b border-gray-100 flex-shrink-0">
        <p className="text-xs font-semibold text-gray-500 mb-1.5">분석 방법</p>
        <div className="flex rounded-lg overflow-hidden border border-gray-300 text-sm">
          <button
            className={`flex-1 py-1.5 font-medium transition-colors ${statType === 'gistar' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            onClick={() => onStatTypeChange('gistar')}
          >Getis-Ord Gi*</button>
          <button
            className={`flex-1 py-1.5 font-medium transition-colors border-l border-gray-300 ${statType === 'moran' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            onClick={() => onStatTypeChange('moran')}
          >Local Moran's I</button>
        </div>
        <p className="text-[10px] text-gray-400 mt-1">
          {statType === 'gistar' ? 'Z-score 기반 핫/콜드스팟 탐지' : '클러스터(HH/LL) 및 이상치(HL/LH) 탐지'}
        </p>
      </div>

      {/* 분석 변수 + 연도 */}
      <div className="px-4 py-3 border-b border-gray-100 space-y-2.5 flex-shrink-0">
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">분석 변수</label>
          <div className="flex rounded-lg overflow-hidden border border-gray-300 text-sm">
            <button
              className={`flex-1 py-1.5 font-medium transition-colors ${variable === 'population' ? 'bg-gray-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              onClick={() => onVariableChange('population')}
            >인구 수</button>
            <button
              className={`flex-1 py-1.5 font-medium transition-colors border-l border-gray-300 ${variable === 'density' ? 'bg-gray-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              onClick={() => onVariableChange('density')}
            >인구 밀도</button>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">기준 연도</label>
          <select value={year} onChange={(e) => onYearChange(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
            {years.map((y) => <option key={y} value={y}>{y}년</option>)}
          </select>
        </div>
      </div>

      {/* 공간 가중치 설정 */}
      <div className="px-4 py-3 border-b border-gray-100 space-y-2.5 flex-shrink-0">
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">공간 가중치 유형</label>
          <select value={weightType} onChange={(e) => onWeightTypeChange(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
            {WEIGHT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          {currentWeight && (
            <p className="text-[10px] text-gray-400 mt-1 leading-tight">{currentWeight.desc}</p>
          )}
        </div>

        {/* KNN: k 슬라이더 */}
        {weightType === 'knn' && (
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">
              이웃 수 (k = {k})
            </label>
            <input type="range" min="4" max="16" step="1" value={k}
              onChange={(e) => onKChange(Number(e.target.value))}
              className="w-full accent-indigo-600" />
            <div className="flex justify-between text-[10px] text-gray-400">
              <span>4 (좁음)</span><span>16 (넓음)</span>
            </div>
          </div>
        )}

        {/* Distance: km 입력 */}
        {weightType === 'distance' && (
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">
              거리 임계값 (km)
            </label>
            <div className="flex items-center gap-2">
              <input type="number" min="10" max="200" step="5" value={distKm}
                onChange={(e) => onDistKmChange(Number(e.target.value))}
                className="flex-1 border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
              <span className="text-xs text-gray-500">km</span>
            </div>
            <input type="range" min="10" max="200" step="5" value={distKm}
              onChange={(e) => onDistKmChange(Number(e.target.value))}
              className="w-full mt-1 accent-indigo-600" />
            <div className="flex justify-between text-[10px] text-gray-400">
              <span>10km</span><span>200km</span>
            </div>
          </div>
        )}

        {/* Queen/Rook/Bishop: 설명 */}
        {['queen', 'rook', 'bishop'].includes(weightType) && (
          <div className="bg-indigo-50 rounded-lg p-2 text-[10px] text-indigo-700 leading-relaxed">
            <p className="font-semibold mb-0.5">체스 인접 기준</p>
            <p>Queen = Rook ∪ Bishop (가장 포괄적)</p>
            <p>Rook = 변 공유 (상하좌우 인접)</p>
            <p>Bishop = 꼭짓점 공유 (대각선 인접)</p>
          </div>
        )}

        <button onClick={onRun} disabled={loading}
          className="w-full py-2 rounded-lg font-semibold text-sm transition-colors bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed">
          {loading ? '분석 중…' : '▶ 분석 실행'}
        </button>

        {statInfo && (
          <p className="text-[10px] text-gray-400 text-center leading-snug">
            {statInfo.n}개 시군구 ·{' '}
            {statInfo.weight_type === 'knn' ? `k=${statInfo.k}` :
             statInfo.weight_type === 'distance' ? `${statInfo.dist_km}km` :
             statInfo.weight_type} ·{' '}
            {statInfo.variable === 'density' ? '인구 밀도' : '인구 수'} · {statInfo.year}년
            {statInfo.isolated > 0 && (
              <span className="text-amber-500 ml-1">(고립 {statInfo.isolated}개 지역)</span>
            )}
          </p>
        )}
      </div>

      {/* 요약 */}
      <SummaryBar results={results} statType={statType} />

      {/* 선택 지역 상세 */}
      {selectedRegion && (
        <div className="px-4 py-3 border-b border-gray-100 bg-indigo-50 flex-shrink-0">
          <p className="text-xs text-gray-500 mb-0.5">선택 지역</p>
          <p className="text-sm font-semibold text-gray-800">{selectedRegion.name}</p>
          {selectedRegion.item && (
            <div className="mt-2 space-y-1 text-xs">
              {statType === 'gistar' ? (
                <>
                  <Row label="Z-score" val={selectedRegion.item.z} />
                  <Row label="p-value" val={selectedRegion.item.p} />
                  <Row label="분류" val={selectedRegion.item.cls === 'ns' ? '유의하지 않음' : selectedRegion.item.cls} />
                </>
              ) : (
                <>
                  <Row label="Local I" val={selectedRegion.item.I} />
                  <Row label="Z-score" val={selectedRegion.item.z} />
                  <Row label="공간 지체" val={selectedRegion.item.lag} />
                  <Row label="p-value" val={selectedRegion.item.p} />
                  <Row label="사분면" val={selectedRegion.item.quad} bold />
                </>
              )}
            </div>
          )}
        </div>
      )}

      <div className="px-4 py-2 mt-auto text-xs text-gray-300 border-t border-gray-100 flex-shrink-0">
        공간 가중치 행렬 기반 공간통계
      </div>
    </aside>
  )
}

function Row({ label, val, bold }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-500">{label}</span>
      <span className={bold ? 'font-bold text-indigo-700' : 'font-semibold'}>{val}</span>
    </div>
  )
}
