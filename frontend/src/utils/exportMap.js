/**
 * A4 세로 PNG 직접 생성 (Leaflet DOM 캡처 없이 GeoJSON → Canvas 직접 렌더링)
 *
 * @param {object} opts
 *   geojson        - GeoJSON FeatureCollection (WGS84)
 *   colorFn        - (properties) => '#rrggbb'  // 피처별 채우기 색상
 *   title          - 지도 제목
 *   subtitle       - 부제 (선택)
 *   legendEntries  - [{ color, label }]
 *   filename       - 저장 파일명 (확장자 제외)
 *   dpi            - 출력 DPI (96 | 150 | 300)
 */
export async function generateA4Png({
  geojson,
  colorFn,
  title,
  subtitle = '',
  legendEntries = [],
  filename = 'map',
  dpi = 300,
}) {
  const sc = dpi / 96 // scale factor (300dpi = 3.125x)

  // ── A4 캔버스 ────────────────────────────────────────────────────
  const W = r(794 * sc)
  const H = r(1123 * sc)
  const cvs = document.createElement('canvas')
  cvs.width = W
  cvs.height = H
  const ctx = cvs.getContext('2d')

  // 배경
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, W, H)

  // ── 레이아웃 상수 (A4 1x 기준 px, sc 배율 적용) ──────────────────
  const m = r(36 * sc)          // 외곽 여백
  const inner = W - 2 * m       // 내부 가용 너비

  const HEADER_H  = r(72 * sc)
  const DIVIDER   = r(1  * sc)
  const MAP_PAD   = r(12 * sc)
  const LEGEND_H  = r(150 * sc) // 범례 영역 높이
  const FOOTER_H  = r(60 * sc)

  const MAP_TOP   = HEADER_H + MAP_PAD
  const MAP_BOT   = H - FOOTER_H - r(8 * sc) - LEGEND_H - r(8 * sc)
  const MAP_H     = MAP_BOT - MAP_TOP
  const LEGEND_TOP = MAP_BOT + r(8 * sc)
  const FOOTER_TOP = H - FOOTER_H

  // ── Mercator 투영 설정 (대한민국) ─────────────────────────────────
  const minLon = 124.2, maxLon = 131.3
  const minLat = 32.8,  maxLat = 39.1

  function merc(lon, lat) {
    const x = lon * Math.PI / 180
    const y = Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360))
    return [x, y]
  }

  const [minMx, minMy] = merc(minLon, minLat)
  const [maxMx, maxMy] = merc(maxLon, maxLat)
  const mercW = maxMx - minMx
  const mercH = maxMy - minMy

  // 가용 맵 영역에 종횡비 유지하며 최대로 맞춤
  const dataRatio = mercW / mercH
  const areaRatio = inner / MAP_H
  let mapDrawW, mapDrawH, mapOffX, mapOffY

  if (areaRatio > dataRatio) {
    mapDrawH = MAP_H
    mapDrawW = MAP_H * dataRatio
    mapOffX  = m + (inner - mapDrawW) / 2
    mapOffY  = MAP_TOP
  } else {
    mapDrawW = inner
    mapDrawH = inner / dataRatio
    mapOffX  = m
    mapOffY  = MAP_TOP + (MAP_H - mapDrawH) / 2
  }

  function project(lon, lat) {
    const [mx, my] = merc(lon, lat)
    const px = (mx - minMx) / mercW * mapDrawW + mapOffX
    const py = (1 - (my - minMy) / mercH) * mapDrawH + mapOffY
    return [px, py]
  }

  // ── 지도 배경 (바다) ──────────────────────────────────────────────
  ctx.fillStyle = '#d8eaf4'
  roundRect(ctx, mapOffX, mapOffY, mapDrawW, mapDrawH, r(4 * sc))
  ctx.fill()

  // ── GeoJSON 피처 렌더링 ───────────────────────────────────────────
  if (geojson?.features) {
    for (const feat of geojson.features) {
      const fill = colorFn(feat.properties)
      drawFeature(ctx, feat.geometry, project, fill, r(0.6 * sc))
    }
  }

  // 지도 테두리
  ctx.strokeStyle = '#aac8dc'
  ctx.lineWidth   = r(sc)
  roundRect(ctx, mapOffX, mapOffY, mapDrawW, mapDrawH, r(4 * sc))
  ctx.stroke()

  // ── 헤더 ─────────────────────────────────────────────────────────
  ctx.fillStyle = '#1e3a5f'
  ctx.font      = `bold ${r(22 * sc)}px sans-serif`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(title, m, r(24 * sc))

  if (subtitle) {
    ctx.fillStyle = '#6b7280'
    ctx.font      = `${r(13 * sc)}px sans-serif`
    ctx.fillText(subtitle, m, r(52 * sc))
  }

  // 헤더 구분선
  ctx.strokeStyle = '#e5e7eb'
  ctx.lineWidth   = DIVIDER
  ctx.beginPath()
  ctx.moveTo(m, HEADER_H)
  ctx.lineTo(W - m, HEADER_H)
  ctx.stroke()

  // ── 범례 ─────────────────────────────────────────────────────────
  drawLegend(ctx, legendEntries, m, LEGEND_TOP, inner, LEGEND_H, sc)

  // ── 푸터 ─────────────────────────────────────────────────────────
  ctx.strokeStyle = '#e5e7eb'
  ctx.lineWidth   = DIVIDER
  ctx.beginPath()
  ctx.moveTo(m, FOOTER_TOP)
  ctx.lineTo(W - m, FOOTER_TOP)
  ctx.stroke()

  const fy = FOOTER_TOP + r(16 * sc)
  ctx.textBaseline = 'top'

  ctx.fillStyle = '#1e3a5f'
  ctx.font      = `bold ${r(12 * sc)}px sans-serif`
  ctx.textAlign = 'left'
  ctx.fillText('국립공주대학교 지리학과  임 창 민', m, fy)

  ctx.fillStyle = '#9ca3af'
  ctx.font      = `${r(10 * sc)}px sans-serif`
  ctx.fillText(
    'Dept. of Geography · Kongju National University · All rights reserved',
    m, fy + r(18 * sc),
  )

  ctx.textAlign = 'right'
  ctx.fillStyle = '#d1d5db'
  ctx.fillText(`A4 Portrait · ${dpi} DPI`, W - m, fy + r(4 * sc))

  // ── PNG 다운로드 (pHYs DPI 메타데이터 포함) ───────────────────────
  const pxPerMeter = Math.round((dpi / 25.4) * 1000)
  const blob = await canvasToPngWithDpi(cvs, pxPerMeter)
  const url  = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.download = `${filename}_A4_${dpi}dpi.png`
  link.href = url
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// ── 헬퍼: 숫자 반올림 ──────────────────────────────────────────────────────
function r(n) { return Math.round(n) }

// ── 헬퍼: 둥근 직사각형 경로 ──────────────────────────────────────────────
function roundRect(ctx, x, y, w, h, radius) {
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + w - radius, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius)
  ctx.lineTo(x + w, y + h - radius)
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h)
  ctx.lineTo(x + radius, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius)
  ctx.lineTo(x, y + radius)
  ctx.quadraticCurveTo(x, y, x + radius, y)
  ctx.closePath()
}

// ── 헬퍼: GeoJSON 피처 렌더링 ─────────────────────────────────────────────
function drawFeature(ctx, geom, project, fillColor, lineWidth) {
  if (!geom) return

  function drawRing(ring) {
    if (ring.length < 2) return
    const [x0, y0] = project(ring[0][0], ring[0][1])
    ctx.moveTo(x0, y0)
    for (let i = 1; i < ring.length; i++) {
      const [x, y] = project(ring[i][0], ring[i][1])
      ctx.lineTo(x, y)
    }
    ctx.closePath()
  }

  ctx.beginPath()
  if (geom.type === 'Polygon') {
    for (const ring of geom.coordinates) drawRing(ring)
  } else if (geom.type === 'MultiPolygon') {
    for (const poly of geom.coordinates)
      for (const ring of poly) drawRing(ring)
  }

  ctx.fillStyle   = fillColor
  ctx.fill('evenodd')
  ctx.strokeStyle = 'rgba(80,80,80,0.55)'
  ctx.lineWidth   = lineWidth
  ctx.stroke()
}

// ── 헬퍼: 범례 렌더링 ─────────────────────────────────────────────────────
function drawLegend(ctx, entries, x, y, w, h, sc) {
  if (!entries?.length) return

  const cols    = Math.min(4, Math.ceil(entries.length / 2))
  const rows    = Math.ceil(entries.length / cols)
  const colW    = Math.floor(w / cols)
  const rowH    = Math.floor((h - r(4 * sc)) / rows)
  const boxSize = r(13 * sc)
  const textSize = r(11 * sc)

  ctx.font      = `${textSize}px sans-serif`
  ctx.textBaseline = 'middle'

  entries.forEach((entry, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    const ex  = x + col * colW
    const ey  = y + row * rowH + rowH / 2

    // 색상 박스
    ctx.fillStyle   = entry.color
    ctx.fillRect(ex, ey - boxSize / 2, boxSize, boxSize)
    ctx.strokeStyle = '#cccccc'
    ctx.lineWidth   = r(0.5 * sc)
    ctx.strokeRect(ex, ey - boxSize / 2, boxSize, boxSize)

    // 텍스트
    ctx.fillStyle  = '#374151'
    ctx.textAlign  = 'left'
    ctx.fillText(entry.label, ex + boxSize + r(5 * sc), ey)
  })
}

// ── 헬퍼: Canvas → PNG Blob (pHYs DPI 메타데이터 삽입) ────────────────────
async function canvasToPngWithDpi(canvas, pxPerMeter) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      blob.arrayBuffer().then((buf) => {
        const pHYs   = buildPhysChunk(pxPerMeter)
        const out    = new Uint8Array(buf.byteLength + pHYs.byteLength)
        out.set(new Uint8Array(buf, 0, 33))
        out.set(new Uint8Array(pHYs), 33)
        out.set(new Uint8Array(buf, 33), 33 + pHYs.byteLength)
        resolve(new Blob([out], { type: 'image/png' }))
      })
    }, 'image/png', 1.0)
  })
}

function buildPhysChunk(pxPerMeter) {
  const chunk = new ArrayBuffer(21)
  const view  = new DataView(chunk)
  view.setUint32(0, 9, false)
  view.setUint8(4, 0x70); view.setUint8(5, 0x48)
  view.setUint8(6, 0x59); view.setUint8(7, 0x73)
  view.setUint32(8, pxPerMeter, false)
  view.setUint32(12, pxPerMeter, false)
  view.setUint8(16, 1)
  view.setInt32(17, crc32(new Uint8Array(chunk, 4, 13)), false)
  return chunk
}

function crc32(buf) {
  const t = makeCrcTable()
  let c = 0xffffffff
  for (const b of buf) c = (c >>> 8) ^ t[(c ^ b) & 0xff]
  return (c ^ 0xffffffff) | 0
}

function makeCrcTable() {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
}
