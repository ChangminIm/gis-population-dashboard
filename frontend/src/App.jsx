import { useEffect, useState, useCallback } from 'react'
import MapView from './components/MapView'
import Sidebar from './components/Sidebar'
import { fetchPopulation, fetchBoundaryGeoJSON, fetchYears } from './api'

const DEFAULT_YEARS = ['2015', '2016', '2017', '2018', '2019', '2020', '2021', '2022', '2023']

export default function App() {
  const [year, setYear] = useState('2023')
  const [years, setYears] = useState(DEFAULT_YEARS)
  const [selectedSido, setSelectedSido] = useState('')
  const [viewMode, setViewMode] = useState('population') // 'population' | 'density'
  const [geojson, setGeojson] = useState(null)
  const [populationMap, setPopulationMap] = useState({})  // adm_cd → 인구 수
  const [densityMap, setDensityMap] = useState({})        // adm_cd → 인구 밀도
  const [totalPop, setTotalPop] = useState(0)
  const [loading, setLoading] = useState(false)
  const [selectedRegion, setSelectedRegion] = useState(null)
  const [chartData, setChartData] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchYears().then(setYears).catch(() => {})
  }, [])

  const loadData = useCallback(async (y, sido) => {
    setLoading(true)
    setError(null)
    setSelectedRegion(null)
    setChartData([])
    try {
      const [geoData, popData] = await Promise.all([
        fetchBoundaryGeoJSON(y, sido, '1'),
        fetchPopulation(y, sido, '1'),
      ])

      if (geoData.errCd !== undefined && geoData.errCd !== 0) {
        throw new Error(geoData.errMsg || 'GeoJSON 오류')
      }
      setGeojson(geoData)

      if (popData.errCd !== undefined && popData.errCd !== 0) {
        throw new Error(popData.errMsg || '인구 데이터 오류')
      }

      const result = popData.result || []
      const popMap = {}
      const denMap = {}
      let total = 0

      result.forEach((item) => {
        const code = item.adm_cd || ''
        if (!code) return
        const pop = parseInt(item.tot_ppltn || '0', 10)
        const density = parseFloat(item.ppltn_dnsty || '0')
        popMap[code] = pop
        denMap[code] = density
        total += pop
      })

      setPopulationMap(popMap)
      setDensityMap(denMap)
      setTotalPop(total)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData(year, selectedSido)
  }, [year, selectedSido, loadData])

  // 지역 클릭 처리
  const handleRegionClick = useCallback(async (region) => {
    const code = region.code
    const isTopLevel = code.length <= 2

    if (isTopLevel && !selectedSido) {
      setSelectedSido(code)
      return
    }

    setSelectedRegion(region)
    try {
      const results = await Promise.all(
        years.map(async (y) => {
          const data = await fetchPopulation(y, code, '0')
          const result = data.result || []
          const pop = result.reduce(
            (sum, item) => sum + parseInt(item.tot_ppltn || '0', 10), 0,
          )
          const density = result.length > 0 ? parseFloat(result[0].ppltn_dnsty || '0') : 0
          return { year: y, pop, density }
        }),
      )
      setChartData(results)
    } catch {
      setChartData([])
    }
  }, [years, selectedSido])

  const handleSidoChange = useCallback((sido) => {
    setSelectedSido(sido)
    setSelectedRegion(null)
    setChartData([])
  }, [])

  const handleBackToNational = useCallback(() => {
    setSelectedSido('')
    setSelectedRegion(null)
    setChartData([])
  }, [])

  // 현재 viewMode에 맞는 데이터 맵
  const activeMap = viewMode === 'density' ? densityMap : populationMap

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gray-100">
      <Sidebar
        year={year}
        onYearChange={setYear}
        years={years}
        selectedSido={selectedSido}
        onSidoChange={handleSidoChange}
        onBackToNational={handleBackToNational}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        selectedRegion={selectedRegion}
        populationMap={populationMap}
        densityMap={densityMap}
        chartData={chartData}
        loading={loading}
        totalPop={totalPop}
      />

      <main className="flex-1 relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/60 z-[2000]">
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-600">데이터 로딩 중…</p>
            </div>
          </div>
        )}
        {error && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[2000] bg-red-100 border border-red-300 text-red-700 px-4 py-2 rounded-lg text-sm shadow">
            오류: {error}
          </div>
        )}
        <MapView
          geojson={geojson}
          activeMap={activeMap}
          viewMode={viewMode}
          onRegionClick={handleRegionClick}
        />
      </main>
    </div>
  )
}
