import { useState } from "react";

export interface LineData {
  label: string;
  data: number[];
  color: string;
}

interface SvgLineChartProps {
  width?: number;
  height?: number;
  lines: LineData[];
  xLabels?: string[];
  yMin?: number;
  yMax?: number;
  highlightX?: number;
  title?: string;
}

const PADDING = { top: 24, right: 24, bottom: 48, left: 56 };

export default function SvgLineChart({
  width = 600,
  height = 300,
  lines,
  xLabels,
  yMin: yMinProp,
  yMax: yMaxProp,
  highlightX,
  title,
}: SvgLineChartProps) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (!lines.length || !lines[0].data.length) return null;

  const dataLen = lines[0].data.length;
  const allValues = lines.flatMap((l) => l.data);
  const rawMin = Math.min(...allValues);
  const rawMax = Math.max(...allValues);
  const padding = (rawMax - rawMin) * 0.1 || 0.1;
  const yMin = yMinProp ?? rawMin - padding;
  const yMax = yMaxProp ?? rawMax + padding;

  const chartW = width - PADDING.left - PADDING.right;
  const chartH = height - PADDING.top - PADDING.bottom;

  const xStep = dataLen > 1 ? chartW / (dataLen - 1) : chartW;
  const toX = (i: number) => PADDING.left + i * xStep;
  const toY = (v: number) =>
    PADDING.top + chartH - ((v - yMin) / (yMax - yMin)) * chartH;

  // Y-axis gridlines
  const yTicks = 5;
  const yTickValues = Array.from(
    { length: yTicks },
    (_, i) => yMin + ((yMax - yMin) / (yTicks - 1)) * i,
  );

  return (
    <div className="relative">
      {title && (
        <p className="text-xs font-medium text-gray-600 mb-2">{title}</p>
      )}
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        style={{ maxWidth: width }}
      >
        {/* Grid lines */}
        {yTickValues.map((v, i) => (
          <g key={i}>
            <line
              x1={PADDING.left}
              y1={toY(v)}
              x2={width - PADDING.right}
              y2={toY(v)}
              stroke="#e5e7eb"
              strokeWidth={1}
            />
            <text
              x={PADDING.left - 8}
              y={toY(v) + 4}
              textAnchor="end"
              className="fill-gray-400"
              fontSize={10}
            >
              {v.toFixed(2)}
            </text>
          </g>
        ))}

        {/* X-axis labels */}
        {Array.from({ length: dataLen }, (_, i) => (
          <text
            key={i}
            x={toX(i)}
            y={height - PADDING.bottom + 20}
            textAnchor="middle"
            className="fill-gray-500"
            fontSize={10}
          >
            {xLabels?.[i] ?? i + 1}
          </text>
        ))}

        {/* Best epoch highlight line */}
        {highlightX != null && (
          <line
            x1={toX(highlightX)}
            y1={PADDING.top}
            x2={toX(highlightX)}
            y2={PADDING.top + chartH}
            stroke="#6366f1"
            strokeWidth={1}
            strokeDasharray="4 3"
          />
        )}

        {/* Lines */}
        {lines.map((line, lineIdx) => {
          const points = line.data
            .map((v, i) => `${toX(i)},${toY(v)}`)
            .join(" ");
          return (
            <g key={lineIdx}>
              <polyline
                points={points}
                fill="none"
                stroke={line.color}
                strokeWidth={2}
              />
              {line.data.map((v, i) => (
                <circle
                  key={i}
                  cx={toX(i)}
                  cy={toY(v)}
                  r={hoverIdx === i ? 5 : 3}
                  fill={line.color}
                  stroke="white"
                  strokeWidth={1.5}
                />
              ))}
            </g>
          );
        })}

        {/* Hover columns (invisible rects for mouse detection) */}
        {Array.from({ length: dataLen }, (_, i) => (
          <rect
            key={i}
            x={toX(i) - xStep / 2}
            y={PADDING.top}
            width={xStep}
            height={chartH}
            fill="transparent"
            onMouseEnter={() => setHoverIdx(i)}
            onMouseLeave={() => setHoverIdx(null)}
          />
        ))}

        {/* Hover tooltip */}
        {hoverIdx != null && (
          <g>
            <line
              x1={toX(hoverIdx)}
              y1={PADDING.top}
              x2={toX(hoverIdx)}
              y2={PADDING.top + chartH}
              stroke="#9ca3af"
              strokeWidth={1}
              strokeDasharray="2 2"
            />
            <rect
              x={toX(hoverIdx) + 8}
              y={PADDING.top}
              width={120}
              height={14 + lines.length * 16}
              rx={4}
              fill="white"
              stroke="#e5e7eb"
              strokeWidth={1}
            />
            <text
              x={toX(hoverIdx) + 14}
              y={PADDING.top + 12}
              fontSize={10}
              className="fill-gray-500"
            >
              {xLabels?.[hoverIdx] ?? `Point ${hoverIdx + 1}`}
            </text>
            {lines.map((line, li) => (
              <text
                key={li}
                x={toX(hoverIdx) + 14}
                y={PADDING.top + 28 + li * 16}
                fontSize={10}
                fill={line.color}
              >
                {line.label}: {line.data[hoverIdx]?.toFixed(3)}
              </text>
            ))}
          </g>
        )}
      </svg>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-2">
        {lines.map((line, i) => (
          <div
            key={i}
            className="flex items-center gap-1.5 text-xs text-gray-600"
          >
            <div
              className="w-3 h-0.5 rounded"
              style={{ backgroundColor: line.color }}
            />
            {line.label}
          </div>
        ))}
        {highlightX != null && (
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <div className="w-3 h-0 border-t border-dashed border-indigo-500" />
            Best epoch
          </div>
        )}
      </div>
    </div>
  );
}
