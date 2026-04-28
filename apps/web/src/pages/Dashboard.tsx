import { useTranslation } from "react-i18next";
import { useAppContext } from "../context/AppContext";
import { Skeleton } from "../components/Skeleton";

export function Dashboard() {
  const { t } = useTranslation();
  const {
    metrics,
    formatStatus,
    calculatePercent,
    guardUnsavedChanges,
    setAdminTab,
    setShowFunctionHub,
    loadRepairs,
    sort,
  } = useAppContext();

  return (
    <div className="admin-tab-content">
      <h2>{t("adminDashboard")}</h2>
      {metrics ? (
        <>
          <div className="metric-grid">
            <div>
              <strong>{t("totalLabel")}</strong>
              <span>{metrics.totalRepairs}</span>
            </div>
            <div>
              <strong>{t("openLabel")}</strong>
              <span>{metrics.openRepairs}</span>
            </div>
            <div>
              <strong>{t("completedLabel")}</strong>
              <span>{metrics.completedRepairs}</span>
            </div>
          </div>
          <div className="metric-lists">
            <div className="chart-card">
              <h3>{t("chartStatus")}</h3>
              <div className="bar-chart">
                {(() => {
                  const max = Math.max(
                    ...metrics.statusBreakdown.map((row) => row.count),
                    0,
                  );
                  return metrics.statusBreakdown.map((row) => (
                    <div
                      key={row.status}
                      className="bar-row clickable"
                      onClick={() =>
                        guardUnsavedChanges(() => {
                          setAdminTab("none");
                          setShowFunctionHub(false);
                          const isArchived =
                            row.status === "COMPLETED" ||
                            row.status === "CANCELLED";
                          void loadRepairs(
                            "all",
                            "",
                            1,
                            sort,
                            isArchived ? "archived" : "active",
                            true,
                            { status: row.status },
                          );
                        })
                      }
                    >
                      <span className="bar-label">
                        {formatStatus(row.status)}
                      </span>
                      <div className="bar-track">
                        <div
                          className="bar-fill status"
                          style={{
                            width: `${calculatePercent(row.count, max)}%`,
                          }}
                        />
                      </div>
                      <span className="bar-value">{row.count}</span>
                    </div>
                  ));
                })()}
              </div>
            </div>
            <div className="chart-card">
              <h3>{t("byAssignee")}</h3>
              <div className="bar-chart">
                {(() => {
                  const sorted = [...metrics.assigneeBreakdown]
                    .sort((a, b) => b.count - a.count)
                    .slice(0, 10);
                  const max = Math.max(
                    ...sorted.map((row) => row.count),
                    0,
                  );
                  return sorted.map((row) => (
                    <div
                      key={`${row.assigneeId ?? "none"}-${row.assigneeName}`}
                      className="bar-row"
                    >
                      <span className="bar-label">{row.assigneeName}</span>
                      <div className="bar-track">
                        <div
                          className="bar-fill assignee"
                          style={{
                            width: `${calculatePercent(row.count, max)}%`,
                          }}
                        />
                      </div>
                      <span className="bar-value">{row.count}</span>
                    </div>
                  ));
                })()}
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="metric-grid">
          <div>
            <Skeleton width="4rem" height="1.2em" />
            <Skeleton width="2rem" height="2em" />
          </div>
          <div>
            <Skeleton width="4rem" height="1.2em" />
            <Skeleton width="2rem" height="2em" />
          </div>
          <div>
            <Skeleton width="4rem" height="1.2em" />
            <Skeleton width="2rem" height="2em" />
          </div>
        </div>
      )}
    </div>
  );
}
