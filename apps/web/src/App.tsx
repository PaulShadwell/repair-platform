import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import "./App.css";
import "./components/ui.css";

import { AppProvider, useAppContext } from "./context/AppContext";
import { SkipToContent } from "./components/SkipToContent";
import { Toast } from "./components/Toast";
import { Modal } from "./components/Modal";

import { LoginPage } from "./pages/LoginPage";
import { ForcePasswordChange } from "./pages/ForcePasswordChange";
import { Header } from "./pages/Header";
import { ProfilePage } from "./pages/ProfilePage";
import { Dashboard } from "./pages/Dashboard";
import { AddRepairForm } from "./pages/AddRepairForm";
import { ManageRepairers } from "./pages/ManageRepairers";
import { CustomersTab } from "./pages/CustomersTab";
import { SettingsTab } from "./pages/SettingsTab";
import { InventoryTab } from "./pages/InventoryTab";
import { SuppliersTab } from "./pages/SuppliersTab";
import { FunctionHub } from "./pages/FunctionHub";
import { RepairList } from "./pages/RepairList";
import { RepairDetail } from "./pages/RepairDetail";
import UserGuide from "./UserGuide";

function AppInner() {
  const { t } = useTranslation();
  const ctx = useAppContext();

  const {
    token,
    mustChangePassword,
    leftPaneWidth,
    isResizing,
    startResizing,
    message,
    messageType,
    showToast,
    showProfilePage,
    adminTab,
    showFunctionHub,
    canUseFunctionHub,
    hideRepairWorkspace,
    isMobile,
    showCsvExportDialog,
    setShowCsvExportDialog,
    csvExportType,
    setCsvExportType,
    busyActions,
    exportCsv,
    showUnsavedDialog,
    setShowUnsavedDialog,
    isAdmin,
    showAdminTools,
    canCreateRepair,
    canManageUsers,
  } = ctx;

  // ---- Unauthenticated: login screen ----
  if (!token) {
    return <LoginPage />;
  }

  // ---- Force password change ----
  if (mustChangePassword) {
    return <ForcePasswordChange />;
  }

  // ---- Main authenticated layout ----
  return (
    <main
      className="container"
      style={{ "--left-pane-width": `${leftPaneWidth}px` } as CSSProperties}
      id="main-content"
    >
      <SkipToContent />
      <Header />

      {/* Toast notification */}
      <Toast
        message={message}
        type={messageType}
        onDismiss={() => showToast("", "success")}
      />

      {/* Profile page */}
      {showProfilePage && <ProfilePage />}

      {/* Admin tabs container */}
      {adminTab !== "none" && (!showFunctionHub || !canUseFunctionHub) && (
        <section className="card admin-tabs-container" aria-label={t("adminSection")}>
          {adminTab === "dashboard" && isAdmin && <Dashboard />}
          {adminTab === "addRepair" && canCreateRepair && <AddRepairForm />}
          {(adminTab === "addRepairer" || adminTab === "manageRepairers") && canManageUsers && (
            <ManageRepairers />
          )}
          {adminTab === "customers" && canCreateRepair && <CustomersTab />}
          {adminTab === "settings" && <SettingsTab />}
          {adminTab === "inventory" && <InventoryTab />}
          {adminTab === "suppliers" && <SuppliersTab />}
          {adminTab === "help" && <UserGuide onClose={() => ctx.setAdminTab("none")} />}
        </section>
      )}

      {/* Function hub (landing page) */}
      {showFunctionHub && <FunctionHub />}

      {/* Repair workspace (list + detail) */}
      {!hideRepairWorkspace && (
        <section className="grid" aria-label={t("repairWorkspace")}>
          <RepairList />
          <div
            className={`grid-resizer ${isResizing ? "active" : ""}`}
            onMouseDown={startResizing}
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize repair list panel"
            tabIndex={0}
          />
          <RepairDetail />
        </section>
      )}

      {/* CSV Export Modal */}
      <Modal
        open={showCsvExportDialog}
        onClose={() => setShowCsvExportDialog(false)}
        title={t("csvExportTitle")}
        actions={
          <>
            <button
              className="btn-primary"
              disabled={busyActions.exportCsv}
              onClick={() => void exportCsv(csvExportType)}
            >
              {busyActions.exportCsv ? t("loadingExportCsv") : t("csvExportDownload")}
            </button>
            <button onClick={() => setShowCsvExportDialog(false)}>{t("cancel")}</button>
          </>
        }
      >
        <div className="csv-export-options">
          <label>
            <input
              type="radio"
              name="csvType"
              checked={csvExportType === "repairs"}
              onChange={() => setCsvExportType("repairs")}
            />
            {t("csvExportRepairs")}
          </label>
          <label>
            <input
              type="radio"
              name="csvType"
              checked={csvExportType === "customers"}
              onChange={() => setCsvExportType("customers")}
            />
            {t("csvExportCustomers")}
          </label>
          <label>
            <input
              type="radio"
              name="csvType"
              checked={csvExportType === "both"}
              onChange={() => setCsvExportType("both")}
            />
            {t("csvExportBoth")}
          </label>
        </div>
      </Modal>

      {/* Unsaved Changes Modal */}
      <Modal
        open={showUnsavedDialog !== null}
        onClose={() => setShowUnsavedDialog(null)}
        title={t("unsavedChangesTitle")}
        closeOnOverlayClick={false}
        actions={
          <div className="modal-actions three-option">
            {showUnsavedDialog?.saveAction && (
              <button
                className="btn-primary"
                onClick={() => {
                  void showUnsavedDialog.saveAction!().then(() => {
                    showUnsavedDialog.action();
                    setShowUnsavedDialog(null);
                  });
                }}
              >
                {t("unsavedSave")}
              </button>
            )}
            <button
              className="btn-danger"
              onClick={() => {
                showUnsavedDialog?.action();
                setShowUnsavedDialog(null);
              }}
            >
              {t("unsavedDiscard")}
            </button>
            <button onClick={() => setShowUnsavedDialog(null)}>
              {t("unsavedGoBack")}
            </button>
          </div>
        }
      >
        <p>{t("unsavedChangesMessage")}</p>
      </Modal>
    </main>
  );
}

function App() {
  return (
    <AppProvider>
      <AppInner />
    </AppProvider>
  );
}

export default App;
