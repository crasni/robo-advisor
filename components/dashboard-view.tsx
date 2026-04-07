"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { IndicatorKey, MnavRecord, RangeOption, TreasuryEvent } from "@/lib/types";
import {
  formatCompactNumber,
  formatCurrency,
  formatCurrencyCompact,
  formatDate,
  formatLargeNumber,
  formatPercent,
} from "@/lib/format";

type DashboardViewProps = {
  data: MnavRecord[];
  ranges: RangeOption[];
  events: TreasuryEvent[];
};

type IndicatorDefinition = {
  key: IndicatorKey;
  label: string;
  color: string;
  accessor: (row: MnavRecord) => number;
  format: (value: number) => string;
};

type ChartPoint = MnavRecord & {
  normalized: Record<IndicatorKey, number>;
};

const DEFAULT_INDICATORS: IndicatorKey[] = ["mnav", "btcPrice", "stockPrice"];

const indicators: IndicatorDefinition[] = [
  { key: "mnav", label: "mNAV", color: "#ff9a3c", accessor: (row) => row.mnav, format: (value) => `${value.toFixed(2)}x` },
  { key: "btcPrice", label: "BTC", color: "#f6c253", accessor: (row) => row.btcPrice, format: formatCurrency },
  { key: "stockPrice", label: "MSTR", color: "#6ad0ff", accessor: (row) => row.stockPrice, format: formatCurrency },
  { key: "btcNav", label: "BTC NAV", color: "#7ef0c1", accessor: (row) => row.btcNav, format: formatCurrency },
  { key: "btcHoldings", label: "BTC Held", color: "#c7b6ff", accessor: (row) => row.btcHoldings, format: formatLargeNumber },
];

function getFilteredSeries(data: MnavRecord[], selected: RangeOption | undefined) {
  if (!selected || selected.days === null) {
    return data;
  }
  return data.slice(Math.max(data.length - selected.days, 0));
}

function buildChartSeries(data: MnavRecord[]) {
  const base = data[0];
  if (!base) return [];

  return data.map((row) => ({
    ...row,
    normalized: {
      mnav: (row.mnav / base.mnav) * 100,
      btcPrice: (row.btcPrice / base.btcPrice) * 100,
      stockPrice: (row.stockPrice / base.stockPrice) * 100,
      btcNav: (row.btcNav / base.btcNav) * 100,
      btcHoldings: (row.btcHoldings / base.btcHoldings) * 100,
    },
  }));
}

function IndicatorTooltip({
  active,
  payload,
  label,
  selectedIndicators,
}: {
  active?: boolean;
  payload?: Array<{ payload: ChartPoint }>;
  label?: string;
  selectedIndicators: IndicatorKey[];
}) {
  if (!active || !payload?.length || !label) {
    return null;
  }

  const row = payload[0]?.payload;
  if (!row) {
    return null;
  }

  return (
    <div className="tooltip-panel">
      <p className="tooltip-date">{formatDate(label)}</p>
      <dl className="tooltip-grid">
        {indicators
          .filter((indicator) => selectedIndicators.includes(indicator.key))
          .map((indicator) => (
            <div key={indicator.key}>
              <dt>{indicator.label}</dt>
              <dd>{indicator.format(indicator.accessor(row))}</dd>
            </div>
          ))}
        <div>
          <dt>Market Cap</dt>
          <dd>{formatCurrencyCompact(row.marketCap)}</dd>
        </div>
      </dl>
    </div>
  );
}

export function DashboardView({ data, ranges, events }: DashboardViewProps) {
  const [activeRange, setActiveRange] = useState<RangeOption["value"]>("1Y");
  const [selectedIndicators, setSelectedIndicators] = useState<IndicatorKey[]>(DEFAULT_INDICATORS);

  const filtered = useMemo(() => {
    const selected = ranges.find((range) => range.value === activeRange);
    return getFilteredSeries(data, selected);
  }, [activeRange, data, ranges]);

  const chartData = useMemo(() => buildChartSeries(filtered), [filtered]);
  const latest = filtered.at(-1) ?? null;
  const first = filtered[0] ?? null;
  const latestEvent = events.at(-1) ?? null;
  const recentEvents = useMemo(() => [...events].slice(-4).reverse(), [events]);
  const visibleEvents = useMemo(
    () =>
      events
        .map((event) => {
          const point = chartData.find((row) => row.date === event.date);
          if (!point) return null;
          return { date: event.date, yValue: point.normalized.mnav };
        })
        .filter((event): event is { date: string; yValue: number } => Boolean(event)),
    [chartData, events],
  );

  const handleIndicatorToggle = (indicator: IndicatorKey) => {
    setSelectedIndicators((current) => {
      if (current.includes(indicator)) {
        return current.length === 1 ? current : current.filter((item) => item !== indicator);
      }
      return [...current, indicator];
    });
  };

  return (
    <main className="dashboard-shell dashboard-shell-terminal">
      <header className="dashboard-topbar dashboard-topbar-terminal">
        <div>
          <p className="eyebrow">DAT.co mNAV Monitor</p>
          <h1>Strategy workspace</h1>
          <p className="dashboard-intro">
            Chart-first monitor for premium expansion, treasury value, and disclosed balance-sheet moves.
          </p>
        </div>
        <div className="dashboard-actions dashboard-actions-terminal">
          <p className="topbar-meta">{latest ? `Last close ${formatDate(latest.date)}` : "No data"}</p>
          <Link className="primary-link" href="/">
            Back to landing
          </Link>
        </div>
      </header>

      <section className="dashboard-market-strip" aria-label="Latest market strip">
        <article>
          <span>mNAV</span>
          <strong>{latest ? `${latest.mnav.toFixed(2)}x` : "N/A"}</strong>
        </article>
        <article>
          <span>BTC NAV</span>
          <strong>{latest ? formatCurrencyCompact(latest.btcNav) : "N/A"}</strong>
        </article>
        <article>
          <span>Market Cap</span>
          <strong>{latest ? formatCurrencyCompact(latest.marketCap) : "N/A"}</strong>
        </article>
        <article>
          <span>BTC Held</span>
          <strong>{latest ? formatCompactNumber(latest.btcHoldings) : "N/A"}</strong>
        </article>
        <article>
          <span>Range Return</span>
          <strong>{latest && first ? formatPercent(latest.mnav / first.mnav - 1) : "N/A"}</strong>
        </article>
      </section>

      <section className="dashboard-workspace">
        <section className="viewer-panel viewer-panel-terminal">
          <div className="viewer-head viewer-head-terminal">
            <div>
              <p className="section-label">Comparison chart</p>
              <h2>Rebased performance</h2>
            </div>

            <div className="range-row range-row-terminal" role="tablist" aria-label="Time range selection">
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

          <div className="indicator-row indicator-row-terminal" aria-label="Indicator selection">
            {indicators.map((indicator) => (
              <button
                key={indicator.key}
                type="button"
                className="indicator-chip"
                data-active={selectedIndicators.includes(indicator.key)}
                onClick={() => handleIndicatorToggle(indicator.key)}
                aria-pressed={selectedIndicators.includes(indicator.key)}
              >
                <span style={{ backgroundColor: indicator.color }} aria-hidden="true" />
                {indicator.label}
              </button>
            ))}
          </div>

          <div className="viewer-chart-frame viewer-chart-frame-terminal">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid stroke="rgba(117, 130, 145, 0.18)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) =>
                    new Date(value).toLocaleDateString("en-US", { month: "short", year: "2-digit" })
                  }
                  stroke="rgba(112, 121, 134, 0.9)"
                  tickLine={false}
                  axisLine={false}
                  minTickGap={24}
                />
                <YAxis
                  stroke="rgba(112, 121, 134, 0.9)"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `${value.toFixed(0)}`}
                  width={42}
                />
                <Tooltip content={<IndicatorTooltip selectedIndicators={selectedIndicators} />} />
                {visibleEvents.map((event) => (
                  <ReferenceDot
                    key={event.date}
                    x={event.date}
                    y={event.yValue}
                    r={3}
                    fill="rgba(255,255,255,0.92)"
                    stroke="rgba(10,12,16,1)"
                    ifOverflow="extendDomain"
                  />
                ))}
                {indicators
                  .filter((indicator) => selectedIndicators.includes(indicator.key))
                  .map((indicator) => (
                    <Line
                      key={indicator.key}
                      type="monotone"
                      dataKey={`normalized.${indicator.key}`}
                      stroke={indicator.color}
                      strokeWidth={indicator.key === "mnav" ? 3 : 2}
                      dot={false}
                      activeDot={{ r: 4, strokeWidth: 0 }}
                    />
                  ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="viewer-foot viewer-foot-terminal">
            <p className="chart-meta">Indexed to the first visible session at 100</p>
            <p className="chart-meta">{latest && first ? `mNAV move ${formatPercent(latest.mnav / first.mnav - 1)}` : "N/A"}</p>
          </div>
        </section>

        <aside className="dashboard-side-rail">
          <section className="side-card">
            <p className="section-label">Latest close</p>
            <h3>{latest ? formatDate(latest.date) : "N/A"}</h3>
            <dl className="side-stat-list">
              <div>
                <dt>BTC price</dt>
                <dd>{latest ? formatCurrency(latest.btcPrice) : "N/A"}</dd>
              </div>
              <div>
                <dt>MSTR close</dt>
                <dd>{latest ? formatCurrency(latest.stockPrice) : "N/A"}</dd>
              </div>
              <div>
                <dt>Shares assumed</dt>
                <dd>{latest ? formatCompactNumber(latest.sharesOutstanding) : "N/A"}</dd>
              </div>
            </dl>
          </section>

          <section className="side-card">
            <p className="section-label">Treasury timeline</p>
            <h3>{latestEvent ? latestEvent.label : "No events"}</h3>
            <p className="side-note">
              {latestEvent ? `Latest disclosed holding event on ${formatDate(latestEvent.date)}.` : "Treasury event data unavailable."}
            </p>
            <div className="event-list">
              {recentEvents.map((event) => (
                <article key={`${event.date}-${event.btcHoldings}`} className="event-row">
                  <p>{formatDate(event.date)}</p>
                  <strong>{event.label}</strong>
                </article>
              ))}
            </div>
          </section>

          <section className="side-card">
            <p className="section-label">Method note</p>
            <h3>Version 1 assumptions</h3>
            <p className="side-note">
              BTC holdings are carried forward between disclosures and market cap uses a fixed share-count assumption.
            </p>
          </section>
        </aside>
      </section>
    </main>
  );
}
