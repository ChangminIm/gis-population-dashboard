import PopChart from './PopChart'

const SIDO_LIST = [
  { code: '11', name: '서울특별시' },
  { code: '21', name: '부산광역시' },
  { code: '22', name: '대구광역시' },
  { code: '23', name: '인천광역시' },
  { code: '24', name: '광주광역시' },
  { code: '25', name: '대전광역시' },
  { code: '26', name: '울산광역시' },
  { code: '29', name: '세종특별자치시' },
  { code: '31', name: '경기도' },
  { code: '32', name: '강원특별자치도' },
  { code: '33', name: '충청북도' },
  { code: '34', name: '충청남도' },
  { code: '35', name: '전북특별자치도' },
  { code: '36', name: '전라남도' },
  { code: '37', name: '경상북도' },
  { code: '38', name: '경상남도' },
  { code: '39', name: '제주특별자치도' },
]

export default function Sidebar({
  year, onYearChange, years,
  selectedSido, onSidoChange, onBackToNational,
  viewMode, onViewModeChange,
  selectedRegion,
  populationMap, densityMap,
  chartData,
  loading,
  totalPop,
}) {
  const currentSidoName = selectedSido
    ? SIDO_LIST.find((s) => s.code === selectedSido)?.name || selectedSido
    : '전국'

  const regionPop = selectedRegion?.code ? populationMap[selectedRegion.code] : null
  const regionDensity = selectedRegion?.code ? densityMap[selectedRegion.code] : null

  return (
    <aside className="w-72 min-w-[240px] h-full bg-white border-r border-gray-200 flex flex-col shadow-md z-10">
      {/* 헤더 */}
      <div className="px-5 py-4 bg-blue-700 text-white">
        <h1 className="text-base font-bold leading-tight">시군구별 인구 통계</h1>
        <p className="text-xs text-blue-200 mt-0.5">SGIS 오픈플랫폼</p>
      </div>

      {/* 시각화 모드 토글 */}
      <div className="px-4 pt-3 pb-2 border-b border-gray-100">
        <p className="text-xs font-semibold text-gray-500 mb-1.5">시각화 기준</p>
        <div className="flex rounded-lg overflow-hidden border border-gray-300 text-sm">
          <button
            className={`flex-1 py-1.5 font-medium transition-colors ${
              viewMode === 'population'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
            onClick={() => onViewModeChange('population')}
          >
            인구 수
          </button>
          <button
            className={`flex-1 py-1.5 font-medium transition-colors border-l border-gray-300 ${
              viewMode === 'density'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
            onClick={() => onViewModeChange('density')}
          >
            인구 밀도
          </button>
        </div>
        {viewMode === 'density' && (
          <p className="text-[10px] text-gray-400 mt-1 text-center">단위: 명/㎢</p>
        )}
      </div>

      {/* 필터 */}
      <div className="px-4 py-3 border-b border-gray-100 space-y-2.5">
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">기준 연도</label>
          <select
            value={year}
            onChange={(e) => onYearChange(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            {years.map((y) => (
              <option key={y} value={y}>{y}년</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">시도</label>
          <select
            value={selectedSido}
            onChange={(e) => onSidoChange(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            <option value="">전국</option>
            {SIDO_LIST.map((s) => (
              <option key={s.code} value={s.code}>{s.name}</option>
            ))}
          </select>
        </div>

        {selectedSido && (
          <button
            onClick={onBackToNational}
            className="w-full text-xs text-blue-600 border border-blue-300 rounded-md py-1.5 hover:bg-blue-50 transition-colors"
          >
            ← 전국 지도로 돌아가기
          </button>
        )}
      </div>

      {/* 현재 뷰 요약 */}
      <div className="px-4 py-3 border-b border-gray-100">
        <p className="text-xs text-gray-400">{currentSidoName} 총 인구</p>
        <p className="text-xl font-bold text-blue-700 mt-0.5">
          {loading ? '로딩 중…' : totalPop ? `${totalPop.toLocaleString()}명` : '-'}
        </p>
      </div>

      {/* 선택 지역 상세 */}
      {selectedRegion && (
        <div className="px-4 py-3 border-b border-gray-100 bg-amber-50">
          <p className="text-xs text-gray-500 mb-0.5">선택 지역</p>
          <p className="text-sm font-semibold text-gray-800">{selectedRegion.name}</p>

          <div className="mt-2 grid grid-cols-2 gap-2">
            <div className="bg-white rounded-lg p-2 border border-amber-100">
              <p className="text-[10px] text-gray-400">인구 수</p>
              <p className="text-sm font-bold text-blue-600">
                {regionPop ? `${regionPop.toLocaleString()}명` : '-'}
              </p>
            </div>
            <div className="bg-white rounded-lg p-2 border border-amber-100">
              <p className="text-[10px] text-gray-400">인구 밀도</p>
              <p className="text-sm font-bold text-orange-600">
                {regionDensity ? `${regionDensity.toLocaleString()}명/㎢` : '-'}
              </p>
            </div>
          </div>

          {regionPop && totalPop > 0 && (
            <div className="mt-2">
              <div className="flex justify-between text-[10px] text-gray-500 mb-0.5">
                <span>{currentSidoName} 대비 비중</span>
                <span>{((regionPop / totalPop) * 100).toFixed(2)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-1.5">
                <div
                  className="bg-blue-500 h-1.5 rounded-full"
                  style={{ width: `${Math.min((regionPop / totalPop) * 100, 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* 인구 추이 차트 */}
      <div className="px-4 py-3 flex-1 min-h-0">
        <div className="h-full min-h-[160px]">
          <PopChart
            data={chartData}
            regionName={selectedRegion?.name || ''}
            viewMode={viewMode}
          />
        </div>
      </div>

      <div className="px-4 py-2 text-xs text-gray-300 border-t border-gray-100">
        데이터 출처: 통계청 SGIS 오픈플랫폼
      </div>
    </aside>
  )
}
