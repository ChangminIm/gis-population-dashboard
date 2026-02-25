import { useMemo, useEffect, useRef, useCallback } from 'react'
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet'
import MapExportButton from './MapExportButton'
import MapWatermark from './MapWatermark'

// ─── 색상 설정 ────────────────────────────────────────────────────────────────

const GISTAR_COLORS = {
  hot_99:  { fill: '#b2182b', label: '핫스팟 (p<0.01)', text: '#fff' },
  hot_95:  { fill: '#ef8a62', label: '핫스팟 (p<0.05)', text: '#fff' },
  hot_90:  { fill: '#fddbc7', label: '핫스팟 (p<0.10)', text: '#333' },
  ns:      { fill: '#f0f0f0', label: '유의하지 않음',    text: '#666' },
  cold_90: { fill: '#d1e5f0', label: '콜드스팟 (p<0.10)', text: '#333' },
  cold_95: { fill: '#67a9cf', label: '콜드스팟 (p<0.05)', text: '#fff' },
  cold_99: { fill: '#2166ac', label: '콜드스팟 (p<0.01)', text: '#fff' },
}

const MORAN_COLORS = {
  HH: { fill: '#d7191c', label: 'HH — 고-고 집중',   text: '#fff' },
  LL: { fill: '#2c7bb6', label: 'LL — 저-저 집중',   text: '#fff' },
  HL: { fill: '#fdae61', label: 'HL — 고-저 이상치', text: '#333' },
  LH: { fill: '#abd9e9', label: 'LH — 저-고 이상치', text: '#333' },
  ns: { fill: '#f0f0f0', label: '유의하지 않음',      text: '#666' },
}

// 대한민국 경계 (WGS84)
const KOREA_BOUNDS = [[33.0, 124.5], [38.9, 131.0]]

function getColor(item, statType) {
  const palette = statType === 'moran' ? MORAN_COLORS : GISTAR_COLORS
  return (palette[item?.cls] || palette['ns']).fill
}

// ─── 한국 전체 맞춤 헬퍼 ─────────────────────────────────────────────────────

function FitKoreaBounds({ results, fitRef }) {
  const map = useMap()

  // 분석 결과 도착 시 한국 전체로 맞춤
  useEffect(() => {
    if (results) map.fitBounds(KOREA_BOUNDS, { padding: [10, 10], animate: true })
  }, [results]) // eslint-disable-line

  // 버튼 콜백 등록
  useEffect(() => {
    if (fitRef) fitRef.current = () => map.fitBounds(KOREA_BOUNDS, { padding: [10, 10], animate: true })
  }, [map, fitRef])

  return null
}

// ─── 지도 레이어 ─────────────────────────────────────────────────────────────

function HotspotLayer({ geojson, resultMap, statType, onRegionClick }) {
  const map = useMap()

  const style = (feature) => {
    const code = feature.properties?.adm_cd || ''
    return {
      fillColor: getColor(resultMap[code], statType),
      weight: 0.8,
      color: '#666',
      opacity: 0.8,
      fillOpacity: 0.82,
    }
  }

  if (!geojson) return null

  return (
    <GeoJSON
      key={`${statType}|${Object.keys(resultMap).length}`}
      data={geojson}
      style={style}
      onEachFeature={(feature, layer) => {
        const code = feature.properties?.adm_cd || ''
        const name = feature.properties?.adm_nm || ''
        const item = resultMap[code]
        let tooltip = `<b>${name}</b><br/>`
        if (item) {
          if (statType === 'gistar') {
            tooltip += `Z-score: ${item.z}<br/>p-value: ${item.p}<br/>분류: ${GISTAR_COLORS[item.cls]?.label || '-'}`
          } else {
            tooltip += `Local I: ${item.I}<br/>p-value: ${item.p}<br/>사분면: ${item.quad}<br/>분류: ${MORAN_COLORS[item.cls]?.label || '-'}`
          }
        } else {
          tooltip += '데이터 없음'
        }
        layer.bindTooltip(tooltip, { sticky: true })
        layer.on({
          mouseover(e) { e.target.setStyle({ weight: 2, color: '#222', fillOpacity: 0.95 }); e.target.bringToFront() },
          mouseout(e)  { e.target.setStyle(style(feature)) },
          click()      { onRegionClick && onRegionClick({ code, name, item }); map.fitBounds(layer.getBounds(), { padding: [20, 20] }) },
        })
      }}
    />
  )
}

// ─── 범례 ────────────────────────────────────────────────────────────────────

function HotspotLegend({ statType }) {
  const palette = statType === 'moran' ? MORAN_COLORS : GISTAR_COLORS
  const title   = statType === 'moran' ? "Local Moran's I" : 'Getis-Ord Gi*'

  return (
    <div className="absolute bottom-8 right-4 z-[1000] bg-white rounded-xl shadow-lg p-3 text-xs border border-gray-200 min-w-[190px]">
      <p className="font-bold mb-2 text-gray-700">{title}</p>
      {Object.entries(palette).map(([key, { fill, label }]) => (
        <div key={key} className="flex items-center gap-2 mb-1">
          <div className="w-4 h-4 rounded-sm border border-gray-200 flex-shrink-0" style={{ backgroundColor: fill }} />
          <span className="text-gray-600">{label}</span>
        </div>
      ))}
    </div>
  )
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────

export default function HotspotMap({ geojson, results, statType, onRegionClick }) {
  const fitRef = useRef(null)

  const resultMap = useMemo(() => {
    if (!results) return {}
    return Object.fromEntries(results.map((r) => [r.adm_cd, r]))
  }, [results])

  const handleFitKorea = useCallback(() => fitRef.current?.(), [])

  const exportFilename = `핫스팟_${statType === 'moran' ? 'Moran' : 'GiStar'}`

  return (
    <div id="hotspot-map-container" className="relative w-full h-full">
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
        <FitKoreaBounds results={results} fitRef={fitRef} />
        <HotspotLayer
          geojson={geojson}
          resultMap={resultMap}
          statType={statType}
          onRegionClick={onRegionClick}
        />
      </MapContainer>
      {results && <HotspotLegend statType={statType} />}
      <MapWatermark subtitle="공간 핫스팟 분석" />
      <MapExportButton
        containerId="hotspot-map-container"
        filename={exportFilename}
        onFitKorea={handleFitKorea}
      />
    </div>
  )
}
