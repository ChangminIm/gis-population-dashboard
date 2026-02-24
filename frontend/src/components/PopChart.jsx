import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'

function formatAxis(value, viewMode) {
  if (viewMode === 'density') {
    return value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value.toFixed(0)
  }
  if (value >= 100_000_000) return `${(value / 100_000_000).toFixed(1)}억`
  if (value >= 10_000) return `${Math.round(value / 10_000)}만`
  return value.toLocaleString()
}

export default function PopChart({ data, regionName, viewMode = 'population' }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm text-center px-2">
        지도에서 지역을 클릭하면<br />연도별 통계가 표시됩니다
      </div>
    )
  }

  const dataKey = viewMode === 'density' ? 'density' : 'pop'
  const barColor = viewMode === 'density' ? '#e31a1c' : '#2c7fb8'
  const unitLabel = viewMode === 'density' ? '명/㎢' : '명'

  return (
    <div className="h-full flex flex-col">
      <p className="text-xs font-semibold text-gray-600 mb-1.5">
        {regionName} — {viewMode === 'density' ? '인구 밀도' : '인구 수'} 추이
      </p>
      <ResponsiveContainer width="100%" height="90%">
        <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="year" tick={{ fontSize: 10 }} />
          <YAxis
            tickFormatter={(v) => formatAxis(v, viewMode)}
            tick={{ fontSize: 10 }}
            width={44}
          />
          <Tooltip
            formatter={(v) => [
              viewMode === 'density'
                ? `${v.toLocaleString()} 명/㎢`
                : `${v.toLocaleString()} 명`,
              viewMode === 'density' ? '인구 밀도' : '인구 수',
            ]}
            labelFormatter={(l) => `${l}년`}
          />
          <Bar dataKey={dataKey} fill={barColor} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
