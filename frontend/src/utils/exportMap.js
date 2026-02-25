import html2canvas from 'html2canvas'

/**
 * 지도 컨테이너를 PNG로 내보내기
 * @param {string} containerId  - 캡처할 div의 id
 * @param {string} filename     - 저장 파일명 (확장자 제외)
 * @param {number} dpi          - 출력 해상도 (기본 300)
 */
export async function exportMapAsPng(containerId, filename = 'map', dpi = 300) {
  const el = document.getElementById(containerId)
  if (!el) throw new Error('Map container not found: ' + containerId)

  const scale = dpi / 96

  const canvas = await html2canvas(el, {
    scale,
    useCORS: true,
    allowTaint: false,
    backgroundColor: '#f5f3ee',
    logging: false,
    imageTimeout: 20000,
    // leaflet attribution/zoom 컨트롤은 캡처에서 제외
    ignoreElements: (node) =>
      node.classList?.contains('leaflet-control-zoom') ||
      node.classList?.contains('leaflet-control-attribution'),
  })

  // DPI 메타데이터를 PNG pHYs 청크에 삽입
  const pxPerMeter = Math.round((dpi / 25.4) * 1000)
  const pngBlob = await setPngDpi(canvas, pxPerMeter)

  const url = URL.createObjectURL(pngBlob)
  const link = document.createElement('a')
  link.download = `${filename}_${dpi}dpi.png`
  link.href = url
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Canvas → PNG Blob, pHYs 청크에 DPI 메타데이터 삽입
 */
async function setPngDpi(canvas, pxPerMeter) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      blob.arrayBuffer().then((buf) => {
        const view = new DataView(buf)
        const pHYs = buildPhysChunk(pxPerMeter)
        // IHDR 청크 다음(33바이트)에 pHYs 삽입
        const out = new Uint8Array(buf.byteLength + pHYs.byteLength)
        out.set(new Uint8Array(buf, 0, 33))
        out.set(new Uint8Array(pHYs), 33)
        out.set(new Uint8Array(buf, 33), 33 + pHYs.byteLength)
        resolve(new Blob([out], { type: 'image/png' }))
      })
    }, 'image/png', 1.0)
  })
}

function buildPhysChunk(pxPerMeter) {
  // pHYs chunk: length(4) + 'pHYs'(4) + x(4) + y(4) + unit(1) + CRC(4) = 21 bytes
  const chunk = new ArrayBuffer(21)
  const view = new DataView(chunk)
  view.setUint32(0, 9, false)                                  // data length = 9
  view.setUint8(4, 0x70); view.setUint8(5, 0x48)              // 'p','H'
  view.setUint8(6, 0x59); view.setUint8(7, 0x73)              // 'Y','s'
  view.setUint32(8, pxPerMeter, false)                         // x pixels per unit
  view.setUint32(12, pxPerMeter, false)                        // y pixels per unit
  view.setUint8(16, 1)                                         // unit = metre
  const crc = crc32(new Uint8Array(chunk, 4, 13))
  view.setInt32(17, crc, false)
  return chunk
}

// CRC-32 (PNG spec)
function crc32(buf) {
  const table = makeCrcTable()
  let crc = 0xffffffff
  for (const b of buf) crc = (crc >>> 8) ^ table[(crc ^ b) & 0xff]
  return (crc ^ 0xffffffff) | 0
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
