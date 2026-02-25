import { useMemo, useEffect, useRef, useCallback } from 'react'
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet'
import MapExportButton from './MapExportButton'

// YlOrRd 7단계 색상
const COLORS = ['#ffffb2', '#fed976', '#feb24c', '#fd8d3c', '#fc4e2a', '#e31a1c', '#b10026']
const NO_DATA_COLOR = '#d0d0d0'

// 대한민국 경계 (WGS84)
const KOREA_BOUNDS = [[33.0, 124.5], [38.9, 131.0]]

// ─── Jenks Natural Breaks ────────────────────────────────────────────────────

function jenksBreaks(data, numClasses) {
  const sorted = [...data].filter((v) => v > 0).sort((a, b) => a - b)
  const n = sorted.length
  if (n === 0) return []
  if (n <= numClasses) return sorted

  const mat1 = Array.from({ length: n + 1 }, () => new Array(numClasses + 1).fill(0))
  const mat2 = Array.from({ length: n + 1 }, () => new Array(numClasses + 1).fill(Infinity))

  for (let i = 1; i <= numClasses; i++) { mat1[1][i] = 1; mat2[1][i] = 0 }

  for (let l = 2; l <= n; l++) {
    let s1 = 0, s2 = 0, w = 0
    for (let m = 1; m <= l; m++) {
      const val = sorted[l - m]
      w++; s2 += val * val; s1 += val
      const v = s2 - (s1 * s1) / w
      const i4 = l - m
      if (i4 !== 0) {
        for (let j = 2; j <= numClasses; j++) {
          if (mat2[l][j] >= v + mat2[i4][j - 1]) {
            mat1[l][j] = l - m + 1
            mat2[l][j] = v + mat2[i4][j - 1]
          }
        }
      }
    }
    mat1[l][1] = 1
    mat2[l][1] = s2 - (s1 * s1) / w
  }

  const breaks = new Array(numClasses)
  breaks[numClasses - 1] = sorted[n - 1]
  let k = n
  for (let j = numClasses; j >= 2; j--) {
    const id = mat1[k][j] - 2
    breaks[j - 2] = sorted[id]
    k = mat1[k][j] - 1
  }
  return breaks
}

function getColor(value, breaks) {
  if (!value || value <= 0 || breaks.length === 0) return NO_DATA_COLOR
  for (let i = 0; i < breaks.length; i++) {
    if (value <= breaks[i]) return COLORS[i]
  }
  return COLORS[COLORS.length - 1]
}

function formatValue(value, viewMode) {
  if (!value || value <= 0) return '데이터 없음'
  if (viewMode === 'density') return `${value.toLocaleString()} 명/㎢`
  return `${value.toLocaleString()} 명`
}

// ─── 한국 전체 맞춤 헬퍼 ─────────────────────────────────────────────────────

function FitKoreaBounds({ geojson, fitRef }) {
  const map = useMap()
  // geojson 변경 시 한국 전체로 리셋
  useEffect(() => {
    if (geojson) map.fitBounds(KOREA_BOUNDS, { padding: [10, 10], animate: true })
  }, [geojson]) // eslint-disable-line

  // 버튼 콜백 등록
  useEffect(() => {
    if (fitRef) fitRef.current = () => map.fitBounds(KOREA_BOUNDS, { padding: [10, 10], animate: true })
  }, [map, fitRef])

  return null
}

// ─── GeoJSON 레이어 ───────────────────────────────────────────────────────────

function GeoJSONLayer({ geojson, activeMap, breaks, viewMode, onRegionClick }) {
  const map = useMap()

  const style = (feature) => {
    const code = feature.properties?.adm_cd || ''
    const value = activeMap[code] || 0
    return { fillColor: getColor(value, breaks), weight: 1, opacity: 1, color: '#555', fillOpacity: 0.8 }
  }

  if (!geojson) return null

  return (
    <GeoJSON
      key={`${JSON.stringify(Object.keys(activeMap))}|${viewMode}`}
      data={geojson}
      style={style}
      onEachFeature={(feature, layer) => {
        const code = feature.properties?.adm_cd || ''
        const name = feature.properties?.adm_nm || ''
        const value = activeMap[code]
        layer.bindTooltip(
          `<b>${name}</b><br/>${formatValue(value, viewMode)}`,
          { sticky: true, className: 'leaflet-tooltip-custom' },
        )
        layer.on({
          mouseover(e) { e.target.setStyle({ weight: 2.5, color: '#222', fillOpacity: 0.95 }); e.target.bringToFront() },
          mouseout(e)  { e.target.setStyle(style(feature)) },
          click()      { onRegionClick({ code, name, value }); map.fitBounds(layer.getBounds(), { padding: [20, 20] }) },
        })
      }}
    />
  )
}

// ─── 범례 ─────────────────────────────────────────────────────────────────────

function Legend({ breaks, viewMode }) {
  if (!breaks || breaks.length === 0) return null
  const label = viewMode === 'density' ? '인구 밀도 (명/㎢)' : '인구 수 (명)'

  const formatBreak = (v) => {
    if (viewMode === 'density') return v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0)
    if (v >= 100_000_000) return `${(v / 100_000_000).toFixed(1)}억`
    if (v >= 10_000) return `${Math.round(v / 10_000)}만`
    return v.toLocaleString()
  }

  const classes = breaks.map((upper, i) => ({
    color: COLORS[i],
    label: `${formatBreak(i === 0 ? 0 : breaks[i - 1])} ~ ${formatBreak(upper)}`,
  }))
  classes.push({ color: COLORS[COLORS.length - 1], label: `${formatBreak(breaks[breaks.length - 1])} 초과` })

  return (
    <div className="absolute bottom-8 right-4 z-[1000] bg-white rounded-xl shadow-lg p-3 text-xs border border-gray-200">
      <p className="font-bold mb-2 text-gray-700 text-[11px]">{label}</p>
      <div className="flex items-center gap-1.5 mb-1.5 text-gray-400 text-[10px]">
        <div className="w-4 h-4 rounded-sm border border-gray-200" style={{ backgroundColor: NO_DATA_COLOR }} />
        <span>데이터 없음</span>
      </div>
      {classes.map((c, i) => (
        <div key={i} className="flex items-center gap-1.5 mb-1">
          <div className="w-4 h-4 rounded-sm border border-gray-200" style={{ backgroundColor: c.color }} />
          <span className="text-gray-600">{c.label}</span>
        </div>
      ))}
    </div>
  )
}

// ─── 메인 ────────────────────────────────────────────────────────────────────

export default function MapView({ geojson, activeMap, viewMode, onRegionClick }) {
  const fitRef = useRef(null)

  const breaks = useMemo(() => {
    const values = Object.values(activeMap).filter((v) => v > 0)
    if (values.length === 0) return []
    return jenksBreaks(values, COLORS.length - 1)
  }, [activeMap])

  const handleFitKorea = useCallback(() => fitRef.current?.(), [])

  const exportFilename = `인구통계_${viewMode === 'density' ? '밀도' : '인구수'}`

  return (
    <div id="pop-map-container" className="relative w-full h-full">
      <MapContainer
        bounds={KOREA_BOUNDS}
        boundsOptions={{ padding: [10, 10] }}
        className="w-full h-full"
      >
        {/* CartoDB Positron - CORS 지원, 통계지도에 최적화된 깔끔한 배경 */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
          maxZoom={19}
        />
        <FitKoreaBounds geojson={geojson} fitRef={fitRef} />
        <GeoJSONLayer
          geojson={geojson}
          activeMap={activeMap}
          breaks={breaks}
          viewMode={viewMode}
          onRegionClick={onRegionClick}
        />
      </MapContainer>
      <Legend breaks={breaks} viewMode={viewMode} />
      <MapExportButton
        containerId="pop-map-container"
        filename={exportFilename}
        onFitKorea={handleFitKorea}
      />
    </div>
  )
}
