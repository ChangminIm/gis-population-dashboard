import { useEffect, useState, useCallback } from 'react'
import MapView from './components/MapView'
import Sidebar from './components/Sidebar'
import HotspotMap from './components/HotspotMap'
import HotspotPanel from './components/HotspotPanel'
import { fetchPopulation, fetchBoundaryGeoJSON, fetchYears, fetchHotspot } from './api'

const DEFAULT_YEARS = ['2015','2016','2017','2018','2019','2020','2021','2022','2023']

// ─── 인구 통계 훅 ─────────────────────────────────────────────────────────────
function usePopStats(years) {
  const [year, setYear] = useState('2023')
  const [selectedSido, setSelectedSido] = useState('')
  const [viewMode, setViewMode] = useState('population')
  const [geojson, setGeojson] = useState(null)
  const [populationMap, setPopulationMap] = useState({})
  const [densityMap, setDensityMap] = useState({})
  const [totalPop, setTotalPop] = useState(0)
  const [loading, setLoading] = useState(false)
  const [selectedRegion, setSelectedRegion] = useState(null)
  const [chartData, setChartData] = useState([])
  const [error, setError] = useState(null)

  const loadData = useCallback(async (y, sido) => {
    setLoading(true); setError(null)
    setSelectedRegion(null); setChartData([])
    try {
      const [geoData, popData] = await Promise.all([
        fetchBoundaryGeoJSON(y, sido, '1'),
        fetchPopulation(y, sido, '1'),
      ])
      if (geoData.errCd !== undefined && geoData.errCd !== 0) throw new Error(geoData.errMsg)
      setGeojson(geoData)
      if (popData.errCd !== undefined && popData.errCd !== 0) throw new Error(popData.errMsg)
      const popMap = {}, denMap = {}; let total = 0
      ;(popData.result || []).forEach((item) => {
        const code = item.adm_cd || ''; if (!code) return
        popMap[code] = parseInt(item.tot_ppltn || '0', 10)
        denMap[code] = parseFloat(item.ppltn_dnsty || '0')
        total += popMap[code]
      })
      setPopulationMap(popMap); setDensityMap(denMap); setTotalPop(total)
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }, [])

  useEffect(() => { loadData(year, selectedSido) }, [year, selectedSido, loadData])

  const handleRegionClick = useCallback(async (region) => {
    if (region.code.length <= 2 && !selectedSido) { setSelectedSido(region.code); return }
    setSelectedRegion(region)
    try {
      const results = await Promise.all(years.map(async (y) => {
        const data = await fetchPopulation(y, region.code, '0')
        const r = data.result || []
        return {
          year: y,
          pop: r.reduce((s, i) => s + parseInt(i.tot_ppltn || '0', 10), 0),
          density: r.length > 0 ? parseFloat(r[0].ppltn_dnsty || '0') : 0,
        }
      }))
      setChartData(results)
    } catch { setChartData([]) }
  }, [years, selectedSido])

  return {
    year, setYear, selectedSido,
    onSidoChange: (v) => { setSelectedSido(v); setSelectedRegion(null); setChartData([]) },
    onBackToNational: () => { setSelectedSido(''); setSelectedRegion(null); setChartData([]) },
    viewMode, setViewMode,
    geojson, populationMap, densityMap, totalPop,
    loading, error, selectedRegion, chartData,
    handleRegionClick,
  }
}

// ─── 핫스팟 분석 훅 ───────────────────────────────────────────────────────────
function useHotspot(years) {
  const [year, setYear] = useState('2023')
  const [variable, setVariable] = useState('population')
  const [statType, setStatType] = useState('gistar')
  const [weightType, setWeightType] = useState('knn')
  const [k, setK] = useState(8)
  const [distKm, setDistKm] = useState(50)
  const [geojson, setGeojson] = useState(null)
  const [results, setResults] = useState(null)
  const [statInfo, setStatInfo] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [selectedRegion, setSelectedRegion] = useState(null)

  const runAnalysis = useCallback(async () => {
    setLoading(true); setError(null); setSelectedRegion(null)
    try {
      const geoPromises = ['11','21','22','23','24','25','26','29','31','32','33','34','35','36','37','38','39']
        .map((sido) => fetchBoundaryGeoJSON(year, sido, '1'))
      const geoResults = await Promise.all(geoPromises)
      const allFeatures = geoResults.flatMap((g) => g.features || [])
      setGeojson({ type: 'FeatureCollection', features: allFeatures })

      const data = await fetchHotspot({ year, variable, statType, weightType, k, distKm })
      if (data.error) throw new Error(data.error)
      setResults(data.result)
      setStatInfo({
        n: data.n, k: data.k, dist_km: data.dist_km,
        variable: data.variable, weight_type: data.weight_type,
        isolated: data.isolated ?? 0, year,
      })
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }, [year, variable, statType, weightType, k, distKm])

  return {
    year, setYear, variable, setVariable,
    statType, setStatType,
    weightType, setWeightType,
    k, setK, distKm, setDistKm,
    geojson, results, statInfo,
    loading, error, selectedRegion,
    onRegionClick: (r) => setSelectedRegion(r),
    runAnalysis,
  }
}

// ─── 메인 앱 ─────────────────────────────────────────────────────────────────
export default function App() {
  const [activeTab, setActiveTab] = useState('population')
  const [years, setYears] = useState(DEFAULT_YEARS)
  useEffect(() => { fetchYears().then(setYears).catch(() => {}) }, [])

  const pop = usePopStats(years)
  const hot = useHotspot(years)

  const activeMap = pop.viewMode === 'density' ? pop.densityMap : pop.populationMap

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden">
      {/* 탭 헤더 */}
      <div className="flex bg-gray-800 text-sm z-20 flex-shrink-0">
        <button
          onClick={() => setActiveTab('population')}
          className={`px-5 py-2.5 font-semibold transition-colors ${activeTab === 'population' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}
        >
          📊 인구 통계
        </button>
        <button
          onClick={() => setActiveTab('hotspot')}
          className={`px-5 py-2.5 font-semibold transition-colors ${activeTab === 'hotspot' ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}
        >
          🔥 핫스팟 분석
        </button>
      </div>

      {/* 콘텐츠 영역 */}
      <div className="flex flex-1 overflow-hidden">
        {activeTab === 'population' ? (
          <>
            <Sidebar
              year={pop.year} onYearChange={pop.setYear} years={years}
              selectedSido={pop.selectedSido}
              onSidoChange={pop.onSidoChange}
              onBackToNational={pop.onBackToNational}
              viewMode={pop.viewMode} onViewModeChange={pop.setViewMode}
              selectedRegion={pop.selectedRegion}
              populationMap={pop.populationMap} densityMap={pop.densityMap}
              chartData={pop.chartData} loading={pop.loading} totalPop={pop.totalPop}
            />
            <main className="flex-1 relative">
              {pop.loading && <LoadingOverlay text="데이터 로딩 중…" />}
              {pop.error && <ErrorBanner msg={pop.error} />}
              <MapView
                geojson={pop.geojson} activeMap={activeMap}
                viewMode={pop.viewMode} onRegionClick={pop.handleRegionClick}
              />
            </main>
          </>
        ) : (
          <>
            <HotspotPanel
              year={hot.year} onYearChange={hot.setYear} years={years}
              variable={hot.variable} onVariableChange={hot.setVariable}
              statType={hot.statType} onStatTypeChange={hot.setStatType}
              weightType={hot.weightType} onWeightTypeChange={hot.setWeightType}
              k={hot.k} onKChange={hot.setK}
              distKm={hot.distKm} onDistKmChange={hot.setDistKm}
              onRun={hot.runAnalysis} loading={hot.loading}
              results={hot.results} statInfo={hot.statInfo}
              selectedRegion={hot.selectedRegion}
            />
            <main className="flex-1 relative">
              {hot.loading && <LoadingOverlay text="공간 통계 분석 중… (30~60초 소요)" />}
              {hot.error && <ErrorBanner msg={hot.error} />}
              {!hot.results && !hot.loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-10">
                  <div className="text-center text-gray-400">
                    <p className="text-4xl mb-3">🗺️</p>
                    <p className="text-base font-medium">좌측 패널에서 옵션을 설정하고</p>
                    <p className="text-base font-medium">「▶ 분석 실행」 버튼을 클릭하세요</p>
                    <p className="text-xs mt-2 text-gray-300">전국 250여 개 시군구 분석 · 30~60초 소요</p>
                  </div>
                </div>
              )}
              <HotspotMap
                geojson={hot.geojson} results={hot.results}
                statType={hot.statType} onRegionClick={hot.onRegionClick}
              />
            </main>
          </>
        )}
      </div>
    </div>
  )
}

function LoadingOverlay({ text }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-white/70 z-[2000]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-600">{text}</p>
      </div>
    </div>
  )
}

function ErrorBanner({ msg }) {
  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[2000] bg-red-100 border border-red-300 text-red-700 px-4 py-2 rounded-lg text-sm shadow max-w-sm text-center">
      오류: {msg}
    </div>
  )
}
