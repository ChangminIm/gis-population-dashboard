import { useState } from 'react'

const DPI_OPTIONS = [
  { label: '화면 (96)', value: 96 },
  { label: '인쇄 (150)', value: 150 },
  { label: '고해상 (300)', value: 300 },
]

/**
 * 지도 A4 PNG 내보내기 버튼
 * onExport(dpi) : 부모에서 실제 generateA4Png 를 호출
 * onFitKorea   : 한국 전체보기 콜백
 */
export default function MapExportButton({ onExport, onFitKorea }) {
  const [dpi, setDpi] = useState(300)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState(null)

  const handleExport = async () => {
    if (!onExport) return
    setExporting(true)
    setError(null)
    try {
      await onExport(dpi)
    } catch (e) {
      setError(e.message || '내보내기 오류')
      setTimeout(() => setError(null), 4000)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="absolute top-3 right-3 z-[1000] flex flex-col items-end gap-1.5">
      {/* 한국 전체보기 */}
      {onFitKorea && (
        <button
          onClick={onFitKorea}
          title="대한민국 전체 보기"
          className="bg-white rounded-lg shadow border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 flex items-center gap-1.5"
        >
          <span>🗺️</span> 전체 보기
        </button>
      )}

      {/* DPI 선택 + 내보내기 */}
      <div className="flex items-center bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <select
          value={dpi}
          onChange={(e) => setDpi(Number(e.target.value))}
          className="text-xs px-2 py-1.5 border-r border-gray-200 bg-white focus:outline-none text-gray-600 cursor-pointer"
        >
          {DPI_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="text-xs px-2.5 py-1.5 font-medium text-gray-700 hover:bg-gray-50 disabled:text-gray-300 flex items-center gap-1"
        >
          {exporting
            ? <><span className="inline-block animate-spin">⏳</span> 생성 중…</>
            : <><span>📄</span> A4 저장</>
          }
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-xs px-2 py-1 rounded-lg max-w-[220px] text-center">
          {error}
        </div>
      )}
    </div>
  )
}
