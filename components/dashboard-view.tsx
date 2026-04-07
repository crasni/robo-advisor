"use client";
import Link from "next/link";
import type { CSSProperties } from "react";
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
import type { IndicatorKey, MnavRecord, RangeOption, TreasuryEvent } from "@/lib/types";
import {
  formatCompactNumber,
  formatCurrency,
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
  colorVar: string;
  toneVar: string;
  accessor: (row: MnavRecord) => number;
  format: (value: number) => string;
};

type ChartPoint = MnavRecord & {
  normalized: Record<IndicatorKey, number>;
};

const DEFAULT_INDICATORS: IndicatorKey[] = ["mnav", "btcPrice", "stockPrice"];

const indicators: IndicatorDefinition[] = [
  {
    key: "mnav",
    label: "mNAV",
    colorVar: "var(--series-mnav)",
    toneVar: "var(--series-mnav-soft)",
    accessor: (row) => row.mnav,
    format: (value) => `${value.toFixed(2)}x`,
  },
  {
    key: "btcPrice",
    label: "BTC",
    colorVar: "var(--series-btc)",
    toneVar: "var(--series-btc-soft)",
    accessor: (row) => row.btcPrice,
    format: formatCurrency,
  },
  {
    key: "stockPrice",
    label: "MSTR",
    colorVar: "var(--series-mstr)",
    toneVar: "var(--series-mstr-soft)",
    accessor: (row) => row.stockPrice,
    format: formatCurrency,
  },
  {
    key: "btcHoldings",
    label: "BTC Held",
    colorVar: "var(--series-holdings)",
    toneVar: "var(--series-holdings-soft)",
    accessor: (row) => row.btcHoldings,
    format: formatLargeNumber,
  },
];

function getFilteredSeries(data: MnavRecord[], selected: RangeOption | undefined) {
  if (!selected || selected.days === null) return data;
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
  if (!active || !payload?.length || !label) return null;

  const row = payload[0]?.payload;
  if (!row) return null;

  return (
    <div className="tooltip-panel">
      <p className="tooltip-date">{formatDate(label)}</p>
      <dl className="tooltip-grid">
        {indicators
          .filter((indicator) => selectedIndicators.includes(indicator.key))
          .map((indicator) => (
            <div
              key={indicator.key}
              className="tooltip-series-row"
              style={
                {
                  "--tooltip-accent": indicator.colorVar,
                  "--tooltip-accent-soft": indicator.toneVar,
                } as CSSProperties
              }
            >
              <dt>{indicator.label}</dt>
              <dd>{indicator.format(indicator.accessor(row))}</dd>
            </div>
          ))}
      </dl>
    </div>
  );
}

export function DashboardView({ data, ranges, events }: DashboardViewProps) {
  const [activeRange, setActiveRange] = useState<RangeOption["value"]>("1Y");
  const [selectedIndicators, setSelectedIndicators] = useState<IndicatorKey[]>(DEFAULT_INDICATORS);
  const [isIndicatorMenuOpen, setIsIndicatorMenuOpen] = useState(false);
  const [showTooltipDetails, setShowTooltipDetails] = useState(true);

  const filtered = useMemo(() => {
    const selected = ranges.find((range) => range.value === activeRange);
    return getFilteredSeries(data, selected);
  }, [activeRange, data, ranges]);

  const chartData = useMemo(() => buildChartSeries(filtered), [filtered]);
  const latest = filtered.at(-1) ?? null;
  const first = filtered[0] ?? null;

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
      <header className="dashboard-header-bar">
        <div className="dashboard-header-main">
          <h1>Strategy mNAV</h1>
        </div>
        <div className="dashboard-header-actions">
          <p className="topbar-meta">{latest ? `Last trading close ${formatDate(latest.date)}` : "No data"}</p>
          <Link className="nav-link dashboard-back-link" href="/" title="Back to landing">
            Landing
          </Link>
        </div>
      </header>

      <section className="dashboard-workspace dashboard-workspace-terminal">
        <section className="viewer-panel viewer-panel-terminal">
          <div className="instrument-bar">
            <div className="instrument-heading">
              <p>Strategy / mNAV</p>
              <strong>{latest ? `${latest.mnav.toFixed(2)}x` : "N/A"}</strong>
              <span>{latest && first ? `${formatPercent(latest.mnav / first.mnav - 1)} in selected range` : "N/A"}</span>
            </div>
            <div className="instrument-strip">
              <article>
                <span>BTC</span>
                <strong>{latest ? formatCurrency(latest.btcPrice) : "N/A"}</strong>
              </article>
              <article>
                <span>MSTR</span>
                <strong>{latest ? formatCurrency(latest.stockPrice) : "N/A"}</strong>
              </article>
              <article>
                <span>BTC Held</span>
                <strong>{latest ? formatCompactNumber(latest.btcHoldings) : "N/A"}</strong>
              </article>
            </div>
          </div>

          <div className="chart-toolbar">
            <div className="range-row range-row-terminal" role="tablist" aria-label="Time range selection">
              {ranges.map((range) => (
                <button
                  key={range.value}
                  type="button"
                  data-active={range.value === activeRange}
                  onClick={() => setActiveRange(range.value)}
                  title={`View ${range.label}`}
                >
                  {range.label}
                </button>
              ))}
            </div>
            <div className="chart-toolbar-actions">
              <div className="topbar-menu-shell chart-toolbar-menu-shell">
                <button
                  type="button"
                  className="topbar-menu-button"
                  aria-label="Dashboard controls"
                  aria-expanded={isIndicatorMenuOpen}
                  title="Chart controls"
                  onClick={() => setIsIndicatorMenuOpen((current) => !current)}
                >
                  <span />
                  <span />
                  <span />
                </button>
                {isIndicatorMenuOpen ? (
                  <div className="indicator-menu-panel" role="menu" aria-label="Dashboard controls">
                    <div className="indicator-menu-group">
                      <p className="indicator-menu-label">Visible indicators</p>
                      {indicators.map((indicator) => (
                        <button
                          key={indicator.key}
                          type="button"
                          className="indicator-menu-item"
                          data-active={selectedIndicators.includes(indicator.key)}
                          onClick={() => handleIndicatorToggle(indicator.key)}
                          aria-pressed={selectedIndicators.includes(indicator.key)}
                          title={`Toggle ${indicator.label}`}
                        >
                          <span style={{ backgroundColor: indicator.colorVar }} aria-hidden="true" />
                          {indicator.label}
                        </button>
                      ))}
                    </div>

                    <div className="indicator-menu-divider" />

                    <div className="indicator-menu-group">
                      <p className="indicator-menu-label">Workspace</p>
                      <button
                        type="button"
                        className="indicator-menu-item indicator-menu-item-utility"
                        data-active={showTooltipDetails}
                        onClick={() => setShowTooltipDetails((current) => !current)}
                        aria-pressed={showTooltipDetails}
                        title="Show or hide the chart detail box on hover"
                      >
                        <span className="indicator-menu-glyph">◫</span>
                        Detail box
                      </button>
                      <button
                        type="button"
                        className="indicator-menu-item indicator-menu-item-utility"
                        onClick={() => setSelectedIndicators(DEFAULT_INDICATORS)}
                        title="Reset visible indicators to the default chart view"
                      >
                        <span className="indicator-menu-glyph">↺</span>
                        Reset view
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="viewer-chart-frame viewer-chart-frame-terminal">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 16, right: 18, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="rgba(117, 130, 145, 0.18)" vertical={true} />
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
                  orientation="right"
                  stroke="rgba(112, 121, 134, 0.9)"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `${value.toFixed(0)}`}
                  width={54}
                />
                {showTooltipDetails ? (
                  <Tooltip content={<IndicatorTooltip selectedIndicators={selectedIndicators} />} />
                ) : null}
                {indicators
                  .filter((indicator) => selectedIndicators.includes(indicator.key))
                  .map((indicator) => (
                    <Line
                      key={indicator.key}
                      type="monotone"
                      dataKey={`normalized.${indicator.key}`}
                      stroke={indicator.colorVar}
                      strokeWidth={indicator.key === "mnav" ? 3 : 2}
                      dot={false}
                      activeDot={{
                        r: 4,
                        strokeWidth: 0,
                        fill: indicator.colorVar,
                      }}
                    />
                  ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="viewer-foot viewer-foot-terminal">
            <p className="chart-meta">Indexed to the first visible session at 100</p>
            <p className="chart-meta">{latest ? `BTC held ${formatCompactNumber(latest.btcHoldings)}` : "N/A"}</p>
          </div>
        </section>

        <aside className="dashboard-side-rail dashboard-side-rail-terminal">
          <section className="rail-panel rail-panel-continuous">
            <section className="rail-section rail-section-card">
              <div className="rail-section-head">
                <h3 className="rail-heading-accent">Watchlist</h3>
              </div>
              <div className="watchlist-table">
                <div className="watchlist-head">
                  <span>Series</span>
                  <span>Last</span>
                </div>
                {[
                  { label: "mNAV", value: latest ? `${latest.mnav.toFixed(2)}x` : "N/A" },
                  { label: "BTC", value: latest ? formatCurrency(latest.btcPrice) : "N/A" },
                  { label: "MSTR", value: latest ? formatCurrency(latest.stockPrice) : "N/A" },
                  { label: "BTC Held", value: latest ? formatCompactNumber(latest.btcHoldings) : "N/A" },
                ].map((row) => (
                  <article
                    key={row.label}
                    className="watchlist-row"
                    title={`${row.label}: ${row.value}`}
                    style={
                      (
                        row.label === "mNAV"
                          ? { "--watch-accent": "var(--series-mnav)" }
                          : row.label === "BTC"
                            ? { "--watch-accent": "var(--series-btc)" }
                            : row.label === "MSTR"
                              ? { "--watch-accent": "var(--series-mstr)" }
                              : { "--watch-accent": "var(--series-holdings)" }
                      ) as CSSProperties
                    }
                  >
                    <strong>{row.label}</strong>
                    <span>{row.value}</span>
                  </article>
                ))}
              </div>
            </section>

            <section className="rail-section rail-section-card">
              <div className="rail-section-head">
                <h3 className="rail-heading-muted">Notes</h3>
              </div>
              <div className="rail-note-list">
                <article className="rail-note-row">
                  <strong>Share count</strong>
                  <p>{latest ? formatCompactNumber(latest.sharesOutstanding) : "N/A"}</p>
                </article>
                <article className="rail-note-row">
                  <strong>Method</strong>
                  <p>Split-adjusted shares, carried holdings</p>
                </article>
                <article className="rail-note-row">
                  <strong>Range move</strong>
                  <p>{latest && first ? formatPercent(latest.mnav / first.mnav - 1) : "N/A"}</p>
                </article>
              </div>
            </section>
          </section>
        </aside>
      </section>
    </main>
  );
}
