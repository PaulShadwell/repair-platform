import { useTranslation } from "react-i18next";
import { FileDown } from "lucide-react";
import { useAppContext } from "../context/AppContext";

export function FunctionHub() {
  const { t } = useTranslation();
  const {
    isAdmin,
    canCreateRepair,
    canManageUsers,
    canViewArchivedItems,
    guardUnsavedChanges,
    setAdminTab,
    setShowFunctionHub,
    loadRepairs,
    searchText,
    sort,
    busyActions,
    setShowCsvExportDialog,
  } = useAppContext();

  return (
    <section className="card function-hub-card">
      <h2>{t("functionHubTitle")}</h2>
      <p className="field-help">{t("functionHubSubtitle")}</p>
      <div className="function-hub-actions">
        <button
          type="button"
          onClick={() =>
            guardUnsavedChanges(() => {
              void loadRepairs("all", searchText, 1, sort, "active", true, {});
              setAdminTab("none");
              setShowFunctionHub(false);
            })
          }
        >
          {t("allRepairs")}
        </button>
        {canViewArchivedItems && (
          <button
            type="button"
            onClick={() =>
              guardUnsavedChanges(() => {
                void loadRepairs("all", searchText, 1, sort, "archived", true, {});
                setAdminTab("none");
                setShowFunctionHub(false);
              })
            }
          >
            {t("archivedItems")}
          </button>
        )}
        {isAdmin && (
          <button
            type="button"
            onClick={() =>
              guardUnsavedChanges(() => {
                setAdminTab("dashboard");
                setShowFunctionHub(false);
              })
            }
          >
            {t("adminDashboard")}
          </button>
        )}
        {canCreateRepair && (
          <button
            type="button"
            onClick={() =>
              guardUnsavedChanges(() => {
                setAdminTab("addRepair");
                setShowFunctionHub(false);
              })
            }
          >
            {t("createRepair")}
          </button>
        )}
        {canManageUsers && (
          <button
            type="button"
            onClick={() =>
              guardUnsavedChanges(() => {
                setAdminTab("manageRepairers");
                setShowFunctionHub(false);
              })
            }
          >
            {t("manageUsers")}
          </button>
        )}
        <button
          type="button"
          onClick={() =>
            guardUnsavedChanges(() => {
              void loadRepairs("all", searchText, 1, sort, "active", true, {
                status: "READY_FOR_PICKUP",
                notified: true,
              });
              setAdminTab("none");
              setShowFunctionHub(false);
            })
          }
        >
          {t("homeReadyForPickup")}
        </button>
        <button
          type="button"
          onClick={() =>
            guardUnsavedChanges(() => {
              void loadRepairs("all", searchText, 1, sort, "active", true, {
                status: "NOTIFY_CUSTOMER",
              });
              setAdminTab("none");
              setShowFunctionHub(false);
            })
          }
        >
          {t("homeNotifyCustomer")}
        </button>
        {isAdmin && (
          <button
            type="button"
            disabled={busyActions.exportCsv}
            onClick={() => setShowCsvExportDialog(true)}
          >
            <FileDown size={14} />{" "}
            {busyActions.exportCsv ? t("loadingExportCsv") : t("exportCsv")}
          </button>
        )}
      </div>
    </section>
  );
}
