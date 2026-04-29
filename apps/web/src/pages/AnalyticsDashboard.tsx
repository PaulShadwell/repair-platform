import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  BarChart3,
  TrendingUp,
  Clock,
  CheckCircle,
  Activity,
} from "lucide-react";
import { api } from "../api";
import { useAppContext } from "../context/AppContext";
import type { AnalyticsOverview, AnalyticsTrend } from "../types";

export function AnalyticsDashboard() {
  const { t } = useTranslation();
  const { formatStatus } = useAppContext();

  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [trends, setTrends] = useState<AnalyticsTrend[]>([]);
  const [loading, setLoading] = useState(true);
  const [trendDays, setTrendDays] = useState(30);

  const loadData = useCallback(async () => {
    try {
      const [ovRes, trRes] = await Promise.all([
        api.get("/analytics/overview"),
        api.get("/analytics/trends", { params: { days: trendDays } }),
      ]);
      setOverview(ovRes.data.overview);
      setTrends(trRes.data.trends);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [trendDays]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  if (loading) {
    return (
      <section className="analytics-dashboard">
        <h2>{t("analyticsDashboard")}</h2>
        <p>{t("loading")}</p>
      </section>
    );
  }

  if (!overview) {
    return (
      <section className="analytics-dashboard">
        <h2>{t("analyticsDashboard")}</h2>
        <p>{t("analyticsNoData")}</p>
      </section>
    );
  }

  const avgDays = overview.avgResolutionHours != null
    ? (overview.avgResolutionHours / 24).toFixed(1)
    : null;

  // Find max value for trend chart scaling
  const maxTrend = Math.max(1, ...trends.map((t) => Math.max(t.created, t.completed)));

  return (
    <section className="analytics-dashboard">
      <h2>{t("analyticsDashboard")}</h2>

      {/* ── KPI Cards ── */}
      <div className="analytics-kpi-grid">
        <div className="analytics-kpi-card">
          <div className="kpi-icon"><BarChart3 size={20} /></div>
          <div className="kpi-value">{overview.totalRepairs}</div>
          <div className="kpi-label">{t("analyticsTotal")}</div>
        </div>
        <div className="analytics-kpi-card">
          <div className="kpi-icon"><TrendingUp size={20} /></div>
          <div className="kpi-value">{overview.repairsLast30}</div>
          <div className="kpi-label">{t("analyticsLast30")}</div>
        </div>
        <div className="analytics-kpi-card">
          <div className="kpi-icon"><Activity size={20} /></div>
          <div className="kpi-value">{overview.repairsLast7}</div>
          <div className="kpi-label">{t("analyticsLast7")}</div>
        </div>
        <div className="analytics-kpi-card">
          <div className="kpi-icon"><CheckCircle size={20} /></div>
          <div className="kpi-value">{overview.completedLast30}</div>
          <div className="kpi-label">{t("analyticsCompleted30")}</div>
        </div>
        <div className="analytics-kpi-card">
          <div className="kpi-icon"><Clock size={20} /></div>
          <div className="kpi-value">{avgDays ?? "—"}</div>
          <div className="kpi-label">{t("analyticsAvgResolution")} ({t("analyticsDays")})</div>
        </div>
      </div>

      {/* ── Trends Chart ── */}
      <div className="analytics-section card">
        <div className="analytics-section-header">
          <h3>{t("analyticsTrendsChart")}</h3>
          <select
            value={trendDays}
            onChange={(e) => setTrendDays(Number(e.target.value))}
            className="analytics-period-select"
          >
            <option value={7}>7 {t("analyticsDays")}</option>
            <option value={30}>30 {t("analyticsDays")}</option>
            <option value={60}>60 {t("analyticsDays")}</option>
            <option value={90}>90 {t("analyticsDays")}</option>
          </select>
        </div>
        <div className="analytics-chart-legend">
          <span className="legend-item"><span className="legend-dot created" /> {t("analyticsRepairsCreated")}</span>
          <span className="legend-item"><span className="legend-dot completed" /> {t("analyticsRepairsCompleted")}</span>
        </div>
        <div className="analytics-bar-chart">
          {trends.map((day) => (
            <div key={day.day} className="chart-day" title={`${day.day}: ${day.created} created, ${day.completed} completed`}>
              <div className="chart-bars">
                <div
                  className="chart-bar created"
                  style={{ height: `${(day.created / maxTrend) * 100}%` }}
                />
                <div
                  className="chart-bar completed"
                  style={{ height: `${(day.completed / maxTrend) * 100}%` }}
                />
              </div>
              {trends.length <= 14 && (
                <span className="chart-label">{day.day.slice(5)}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="analytics-grid-2col">
        {/* ── Status Breakdown ── */}
        <div className="analytics-section card">
          <h3>{t("analyticsStatusBreakdown")}</h3>
          <div className="analytics-breakdown-list">
            {overview.statusBreakdown.map((row) => {
              const pct = overview.totalRepairs > 0
                ? ((row.count / overview.totalRepairs) * 100).toFixed(1)
                : "0";
              return (
                <div key={row.status} className="breakdown-row">
                  <span className="breakdown-label">{formatStatus(row.status, false)}</span>
                  <div className="breakdown-bar-track">
                    <div
                      className="breakdown-bar-fill status"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="breakdown-value">{row.count} ({pct}%)</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Assignee Workload ── */}
        <div className="analytics-section card">
          <h3>{t("analyticsAssigneeWorkload")}</h3>
          <div className="analytics-breakdown-list">
            {overview.assigneeWorkload.length === 0 ? (
              <p className="muted">{t("analyticsNoData")}</p>
            ) : (
              overview.assigneeWorkload.map((row) => {
                const maxCount = Math.max(1, ...overview.assigneeWorkload.map((r) => r.activeCount));
                const pct = ((row.activeCount / maxCount) * 100).toFixed(1);
                return (
                  <div key={row.assigneeId ?? "unassigned"} className="breakdown-row">
                    <span className="breakdown-label">{row.assigneeName}</span>
                    <div className="breakdown-bar-track">
                      <div
                        className="breakdown-bar-fill assignee"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="breakdown-value">{row.activeCount}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── Outcome Breakdown ── */}
        <div className="analytics-section card">
          <h3>{t("analyticsOutcomeBreakdown")}</h3>
          <div className="analytics-breakdown-list">
            {overview.outcomeBreakdown.length === 0 ? (
              <p className="muted">{t("analyticsNoData")}</p>
            ) : (
              overview.outcomeBreakdown.map((row) => {
                const total = overview.outcomeBreakdown.reduce((s, r) => s + r.count, 0);
                const pct = total > 0 ? ((row.count / total) * 100).toFixed(1) : "0";
                return (
                  <div key={row.outcome ?? "none"} className="breakdown-row">
                    <span className="breakdown-label">{row.outcome ?? "—"}</span>
                    <div className="breakdown-bar-track">
                      <div className="breakdown-bar-fill outcome" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="breakdown-value">{row.count} ({pct}%)</span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── Article Types ── */}
        <div className="analytics-section card">
          <h3>{t("analyticsArticleTypes")}</h3>
          <div className="analytics-breakdown-list">
            {overview.articleTypeBreakdown.length === 0 ? (
              <p className="muted">{t("analyticsNoData")}</p>
            ) : (
              overview.articleTypeBreakdown.map((row) => {
                const maxCount = Math.max(1, ...overview.articleTypeBreakdown.map((r) => r.count));
                const pct = ((row.count / maxCount) * 100).toFixed(1);
                return (
                  <div key={row.type} className="breakdown-row">
                    <span className="breakdown-label">{row.type}</span>
                    <div className="breakdown-bar-track">
                      <div className="breakdown-bar-fill article" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="breakdown-value">{row.count}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
