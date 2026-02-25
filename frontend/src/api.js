// 개발: Vite proxy (/api → localhost:5000)
// 프로덕션: VITE_API_BASE 환경변수로 백엔드 URL 지정
const BASE = (import.meta.env.VITE_API_BASE || '') + '/api'

export async function fetchPopulation(year, adm_cd = '', low_search = '1') {
  const params = new URLSearchParams({ year, low_search })
  if (adm_cd) params.set('adm_cd', adm_cd)
  const res = await fetch(`${BASE}/population?${params}`)
  if (!res.ok) throw new Error('인구 데이터 요청 실패')
  return res.json()
}

export async function fetchBoundaryGeoJSON(year = '2020', adm_cd = '', low_search = '1') {
  const params = new URLSearchParams({ year, low_search })
  if (adm_cd) params.set('adm_cd', adm_cd)
  const res = await fetch(`${BASE}/geojson/boundary?${params}`)
  if (!res.ok) throw new Error('경계 GeoJSON 요청 실패')
  return res.json()
}

export async function fetchYears() {
  const res = await fetch(`${BASE}/years`)
  if (!res.ok) throw new Error('연도 목록 요청 실패')
  const data = await res.json()
  return data.years
}

export async function fetchHotspot({ year, variable, statType, weightType = 'knn', k = 8, distKm = 50 }) {
  const params = new URLSearchParams({
    year, variable,
    stat_type: statType,
    weight_type: weightType,
    k,
    dist_km: distKm,
  })
  const res = await fetch(`${BASE}/hotspot?${params}`)
  if (!res.ok) throw new Error('핫스팟 분석 요청 실패')
  return res.json()
}
