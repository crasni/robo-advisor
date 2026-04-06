"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MnavRecord, RangeOption } from "@/lib/types";
import { formatCurrency, formatDate, formatPercent } from "@/lib/format";

type ChartPanelProps = {
  data: MnavRecord[];
  ranges: RangeOption[];
};

export function ChartPanel({ data, ranges }: ChartPanelProps) {
  const [activeRange, setActiveRange] = useState<RangeOption["value"]>("1Y");

  const filtered = useMemo(() => {
    const selected = ranges.find((range) => range.value === activeRange);
    if (!selected || selected.days === null) {
      return data;
    }

    return data.slice(Math.max(data.length - selected.days, 0));
  }, [activeRange, data, ranges]);

  const latest = filtered.at(-1);
  const first = filtered[0];
  const min = filtered.reduce((carry, row) => Math.min(carry, row.mnav), Number.POSITIVE_INFINITY);
  const max = filtered.reduce((carry, row) => Math.max(carry, row.mnav), Number.NEGATIVE_INFINITY);

  return (
    <div className="chart-panel">
      <div className="chart-header">
        <p className="chart-meta">
          Range: <strong>{ranges.find((range) => range.value === activeRange)?.label}</strong>
        </p>
        <div className="range-row" role="tablist" aria-label="Time range selection">
          {ranges.map((range) => (
            <button
              key={range.value}
              type="button"
              data-active={range.value === activeRange}
              onClick={() => setActiveRange(range.value)}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      <div className="chart-frame">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={filtered}>
            <CartesianGrid stroke="rgba(167, 189, 255, 0.08)" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={(value) => new Date(value).toLocaleDateString("en-US", { month: "short", year: "2-digit" })}
              stroke="rgba(156, 169, 186, 0.82)"
              tickLine={false}
              axisLine={false}
              minTickGap={28}
            />
            <YAxis
              stroke="rgba(156, 169, 186, 0.82)"
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `${value.toFixed(1)}x`}
              width={56}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "rgba(8, 15, 27, 0.96)",
                border: "1px solid rgba(167, 189, 255, 0.16)",
                color: "#f7f4ed",
              }}
              formatter={(value: number, name: string) => {
                if (name === "mNAV") return [`${value.toFixed(2)}x`, "mNAV"];
                return [formatCurrency(value), name];
              }}
              labelFormatter={(label) => formatDate(label)}
            />
            <Line
              type="monotone"
              dataKey="mnav"
              stroke="#f6b84c"
              strokeWidth={3}
              dot={false}
              activeDot={{ r: 5, strokeWidth: 0, fill: "#ff7a00" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-footer">
        <div>
          <span className="chart-meta">Latest in range</span>
          <strong>{latest ? `${latest.mnav.toFixed(2)}x` : "N/A"}</strong>
        </div>
        <div>
          <span className="chart-meta">Range low / high</span>
          <strong>{Number.isFinite(min) && Number.isFinite(max) ? `${min.toFixed(2)}x / ${max.toFixed(2)}x` : "N/A"}</strong>
        </div>
        <div>
          <span className="chart-meta">Change across range</span>
          <strong>
            {latest && first ? formatPercent(latest.mnav / first.mnav - 1) : "N/A"}
          </strong>
        </div>
      </div>
    </div>
  );
}
