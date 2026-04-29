import { useEffect, useMemo, useRef, useState } from "react";
import { Spinner } from "../components/Spinner";
import { Skeleton } from "../components/Skeleton";
import {
  Pencil,
  Printer,
  FileText,
  Trash2,
  Plus,
  Save,
  Upload,
  Receipt,
  X,
  ClipboardList,
  Wrench,
  Package,
  Camera,
  History,
} from "lucide-react";
import { ThermalLabelPreview } from "../components/ThermalLabelPreview";
import { useAppContext } from "../context/AppContext";
import type { InventoryItem } from "../types";
import { api } from "../api";

// ---------------------------------------------------------------------------
// Tab types
// ---------------------------------------------------------------------------
type DetailTab = "details" | "work" | "parts" | "photos" | "history";

// ---------------------------------------------------------------------------
// MaterialAddRow (tightly coupled to RepairDetail)
// ---------------------------------------------------------------------------
function MaterialAddRow({
  inventoryItems,
  onLoadInventory,
  onAdd,
}: {
  inventoryItems: InventoryItem[];
  onLoadInventory: () => void;
  onAdd: (data: {
    inventoryItemId?: string | null;
    description: string;
    quantity: number;
    unitCost: number;
    billedToCustomer: boolean;
    notes?: string;
  }) => void;
}) {
  const { t } = useAppContext();
  const [open, setOpen] = useState(false);
  const [desc, setDesc] = useState("");
  const [qty, setQty] = useState(1);
  const [cost, setCost] = useState(0);
  const [billed, setBilled] = useState(false);
  const [notes, setNotes] = useState("");
  const [invItemId, setInvItemId] = useState<string>("");

  useEffect(() => {
    if (open && inventoryItems.length === 0) onLoadInventory();
  }, [open]);

  function handleSelectInventory(id: string) {
    setInvItemId(id);
    if (id) {
      const item = inventoryItems.find((i) => i.id === id);
      if (item) {
        setDesc(item.name);
        setCost(item.unitCost != null ? Number(item.unitCost) : 0);
      }
    }
  }

  function handleSubmit() {
    if (!desc.trim()) return;
    onAdd({
      inventoryItemId: invItemId || null,
      description: desc.trim(),
      quantity: qty,
      unitCost: cost,
      billedToCustomer: billed,
      notes: notes.trim() || undefined,
    });
    setOpen(false);
    setDesc("");
    setQty(1);
    setCost(0);
    setBilled(false);
    setNotes("");
    setInvItemId("");
  }

  if (!open) {
    return (
      <button type="button" className="add-material-btn" onClick={() => setOpen(true)}>
        <Plus size={14} /> {t("addMaterial")}
      </button>
    );
  }

  return (
    <div className="material-add-form">
      <label>
        {t("materialSelectFromInventory")}
        <select value={invItemId} onChange={(e) => handleSelectInventory(e.target.value)}>
          <option value="">{t("materialCustomItem")}</option>
          {inventoryItems
            .filter((i) => i.isActive)
            .map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
                {item.sku ? ` (${item.sku})` : ""} — CHF{" "}
                {item.unitCost != null ? Number(item.unitCost).toFixed(2) : "0.00"}
              </option>
            ))}
        </select>
      </label>
      <label>
        {t("materialDescription")} *
        <input type="text" value={desc} onChange={(e) => setDesc(e.target.value)} />
      </label>
      <label>
        {t("materialQty")}
        <input type="number" min="0" step="0.001" value={qty} onChange={(e) => setQty(Number(e.target.value))} />
      </label>
      <label>
        {t("materialUnitCost")}
        <input type="number" min="0" step="0.01" value={cost} onChange={(e) => setCost(Number(e.target.value))} />
      </label>
      <label className="checkbox-label">
        <input type="checkbox" checked={billed} onChange={(e) => setBilled(e.target.checked)} />
        {t("materialBilled")}
      </label>
      <label>
        {t("materialNotes")}
        <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>
      <div className="inline-edit-actions">
        <button type="button" onClick={handleSubmit}>
          <Save size={14} /> {t("save")}
        </button>
        <button type="button" onClick={() => setOpen(false)}>
          {t("cancel")}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Email validation helper
// ---------------------------------------------------------------------------
function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

// ---------------------------------------------------------------------------
// RepairDetail
// ---------------------------------------------------------------------------
export function RepairDetail() {
  const {
    t,
    selectedRepair,
    isMobile,
    mobileView,
    assignees,
    canAssignRepairs,
    canPrintFromDetail,
    canToggleLabelSimulation,
    isAdmin,
    canEditCustomerIntake,
    canManageMaterials,
    canManagePhotos,
    busyActions,
    isEditingRepairIntake,
    setIsEditingRepairIntake,
    isEditingRepairWork,
    setIsEditingRepairWork,
    repairIntakeForm,
    setRepairIntakeForm,
    repairWorkForm,
    setRepairWorkForm,
    showThermalPreview,
    setShowThermalPreview,
    setShowUnsavedDialog,
    translatedContent,
    photoPreviewUrls,
    repairMaterials,
    isLoadingMaterials,
    repairChangeHistory,
    isLoadingRepairHistory,
    inventoryItems,
    intakeHasUnsavedChanges,
    workHasUnsavedChanges,
    updateAssignment,
    printLabel,
    printRepairA4,
    deleteRepair,
    saveRepairIntake,
    saveRepairWork,
    uploadPhotos,
    removePhoto,
    addRepairMaterial,
    updateRepairMaterial,
    deleteRepairMaterial,
    uploadMaterialReceipt,
    removeMaterialReceipt,
    loadInventoryItems,
    formatRepairRef,
    formatCustomerFullName,
    formatStatus,
    formatDisplayDate,
    formatDisplayDateTime,
    formatArticleType,
    formatChangeType,
    formatTelHref,
    renderExpandableValue,
    intakeEditHint,
    outcomeEditHint,
    canEditRepairWork,
  } = useAppContext();

  // -- Active tab --
  const [activeTab, setActiveTab] = useState<DetailTab>("details");

  // -- Local validation state --
  const [emailError, setEmailError] = useState<string | null>(null);

  // Reset tab when a different repair is selected (ref-based, no effect)
  const prevRepairIdRef = useRef<string | null>(null);
  if (selectedRepair?.id !== prevRepairIdRef.current) {
    prevRepairIdRef.current = selectedRepair?.id ?? null;
    if (activeTab !== "details") setActiveTab("details");
    if (emailError !== null) setEmailError(null);
  }

  // -- Inline email validation --
  function handleEmailChange(value: string) {
    setRepairIntakeForm((prev) => ({ ...prev, email: value }));
    if (value && !isValidEmail(value)) {
      setEmailError(t("invalidEmail") ?? "Invalid email format");
    } else {
      setEmailError(null);
    }
  }

  // -- Outcome warning (derived, no state) --
  const outcomeWarning = useMemo(() => {
    if (repairWorkForm.status === "COMPLETED" && !repairWorkForm.outcome) {
      return t("outcomeRequiredWarning") ?? "Setting status to Completed without an outcome.";
    }
    return null;
  }, [repairWorkForm.status, repairWorkForm.outcome, t]);

  const ARTICLE_TYPE_OPTIONS = [
    "Assortment",
    "Textile",
    "Electronics",
    "Electrical",
    "Wood",
    "Other",
  ] as const;

  if (!selectedRepair) {
    return (
      <section className={`card detail ${isMobile && mobileView === "list" ? "mobile-hidden" : ""}`}>
        <p>{t("selectRepairPrompt")}</p>
      </section>
    );
  }

  // -- Timeline rendering --
  const timelineSteps = [
    { key: "NEW", label: t("timelineNew") },
    { key: "IN_PROGRESS", label: t("timelineInProgress") },
    { key: "READY_FOR_PICKUP", label: t("timelineReady") },
    { key: "COMPLETED", label: t("timelineCompleted") },
  ];
  const statusOrder = ["NEW", "IN_PROGRESS", "WAITING_PARTS", "NOTIFY_CUSTOMER", "READY_FOR_PICKUP", "COMPLETED"];
  const currentIdx = statusOrder.indexOf(selectedRepair.status);
  const isCancelled = selectedRepair.status === "CANCELLED";

  // -- Tab definitions with counts --
  const tabs: { key: DetailTab; label: string; icon: React.ReactNode; count?: number }[] = [
    { key: "details", label: t("tabDetails", "Details"), icon: <ClipboardList size={14} /> },
    { key: "work", label: t("tabWork", "Work"), icon: <Wrench size={14} /> },
    { key: "parts", label: t("tabParts", "Parts"), icon: <Package size={14} />, count: repairMaterials.length },
    { key: "photos", label: t("tabPhotos", "Photos"), icon: <Camera size={14} />, count: selectedRepair.photos.length },
    { key: "history", label: t("tabHistory", "History"), icon: <History size={14} />, count: repairChangeHistory.length },
  ];

  return (
    <article
      className={`card detail detail-tabbed ${isMobile && mobileView === "list" ? "mobile-hidden" : ""}`}
      aria-label={t("repairDetail")}
    >
      {/* ================================================================== */}
      {/* STICKY HEADER                                                       */}
      {/* ================================================================== */}
      <div className="detail-sticky-header">
        {/* Top row: title + actions */}
        <div className="detail-header-row">
          <div className="detail-header-info">
            <h2>{formatRepairRef(selectedRepair)}</h2>
            <span className="detail-header-item">{selectedRepair.itemName ?? t("noProduct")}</span>
            <span className="detail-header-sep">·</span>
            <span className="detail-header-customer">{formatCustomerFullName(selectedRepair)}</span>
          </div>
          <div className="detail-header-actions">
            {assignees.length > 0 && canAssignRepairs && (
              <select
                className="detail-assign-select"
                value=""
                aria-label={t("assignToRepairer")}
                onChange={(e) => {
                  if (e.target.value) void updateAssignment(selectedRepair.id, e.target.value);
                }}
              >
                <option value="" disabled>
                  {t("assignToRepairer")}
                </option>
                {assignees.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.fullName}
                  </option>
                ))}
              </select>
            )}
            {canPrintFromDetail && (
              <button
                disabled={busyActions.printLabel}
                onClick={() => void printLabel(selectedRepair.id)}
                aria-label={t("printLabel")}
              >
                <Printer size={14} /> {busyActions.printLabel ? t("loadingPrintLabel") : t("printLabel")}
              </button>
            )}
            <button type="button" onClick={() => printRepairA4(selectedRepair)} aria-label={t("printA4")}>
              <FileText size={14} /> {t("printA4")}
            </button>
            {canToggleLabelSimulation && (
              <button type="button" onClick={() => setShowThermalPreview((prev) => !prev)}>
                {showThermalPreview ? t("hideSimulationLabel") : t("showSimulationLabel")}
              </button>
            )}
            {isAdmin && (
              <button
                className="button-danger"
                disabled={busyActions.deleteRepair}
                onClick={() => void deleteRepair(selectedRepair.id)}
                aria-label={t("deleteRepair")}
              >
                <Trash2 size={14} /> {busyActions.deleteRepair ? t("loadingDeleteRepair") : t("deleteRepair")}
              </button>
            )}
          </div>
        </div>

        {/* Meta chips */}
        <div className="detail-meta-chips">
          <span className="detail-chip">
            <strong>{t("assigned")}:</strong> {selectedRepair.assignedToUser?.fullName ?? t("unassigned")}
          </span>
          <span className="detail-chip">
            <strong>{t("customerNotified")}:</strong> {selectedRepair.notified ? t("yes") : t("no")}
          </span>
          <span className="detail-chip">
            <strong>{t("status")}:</strong> {formatStatus(selectedRepair.status, selectedRepair.notified ?? false)}
          </span>
        </div>

        {/* Compact timeline */}
        <div className={`repair-timeline compact${isCancelled ? " cancelled" : ""}`}>
          {timelineSteps.map((step, i) => {
            const stepIdx = statusOrder.indexOf(step.key);
            const isActive =
              step.key === selectedRepair.status ||
              (selectedRepair.status === "WAITING_PARTS" && step.key === "IN_PROGRESS") ||
              (selectedRepair.status === "NOTIFY_CUSTOMER" && step.key === "IN_PROGRESS");
            const isDone = !isCancelled && currentIdx > stepIdx;
            return (
              <div key={step.key} className={`timeline-step${isDone ? " done" : ""}${isActive ? " active" : ""}`}>
                <div className="timeline-dot">
                  {isDone ? (
                    <span className="timeline-check">&#10003;</span>
                  ) : (
                    <span className="timeline-num">{i + 1}</span>
                  )}
                </div>
                {i < timelineSteps.length - 1 && <div className={`timeline-line${isDone ? " done" : ""}`} />}
                <span className="timeline-label">{step.label}</span>
              </div>
            );
          })}
          {(selectedRepair.status === "WAITING_PARTS" || selectedRepair.status === "NOTIFY_CUSTOMER") && (
            <span className="timeline-substatus">
              {formatStatus(selectedRepair.status, selectedRepair.notified ?? false)}
            </span>
          )}
          {isCancelled && <span className="timeline-substatus cancelled">{t("statusCancelled")}</span>}
        </div>
      </div>

      {/* ================================================================== */}
      {/* TAB BAR                                                             */}
      {/* ================================================================== */}
      <nav className="detail-tab-bar" role="tablist" aria-label={t("repairDetail")}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={activeTab === tab.key}
            className={`detail-tab${activeTab === tab.key ? " active" : ""}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {tab.count != null && tab.count > 0 && (
              <span className="detail-tab-badge">{tab.count}</span>
            )}
          </button>
        ))}
      </nav>

      {/* ================================================================== */}
      {/* TAB CONTENT                                                         */}
      {/* ================================================================== */}
      <div className="detail-tab-content">

        {/* ── Details Tab ── */}
        {activeTab === "details" && (
          <section aria-label={t("tabDetails", "Details")}>
            <div className="section-header-row">
              <h3>{t("customerIntake")}</h3>
              {canEditCustomerIntake && !isEditingRepairIntake && (
                <button
                  type="button"
                  onClick={() => setIsEditingRepairIntake(true)}
                  aria-label={t("editCustomerIntake")}
                >
                  <Pencil size={14} /> {t("editCustomerIntake")}
                </button>
              )}
            </div>
            <p className="section-hint">{intakeEditHint()}</p>

            {isEditingRepairIntake ? (
              <>
                <h4 className="intake-subsection-title">{t("sectionCustomerDetails")}</h4>
                <div className="intake-edit-grid">
                  <label>
                    {t("customerFirstName")}
                    <input
                      value={repairIntakeForm.firstName}
                      onChange={(e) => setRepairIntakeForm((prev) => ({ ...prev, firstName: e.target.value }))}
                    />
                  </label>
                  <label>
                    {t("customerLastName")}
                    <input
                      value={repairIntakeForm.lastName}
                      onChange={(e) => setRepairIntakeForm((prev) => ({ ...prev, lastName: e.target.value }))}
                    />
                  </label>
                  <label className="wide">
                    {t("customerStreetAddress")}
                    <input
                      value={repairIntakeForm.streetAddress}
                      onChange={(e) => setRepairIntakeForm((prev) => ({ ...prev, streetAddress: e.target.value }))}
                    />
                  </label>
                  <label>
                    {t("customerCity")}
                    <input
                      value={repairIntakeForm.city}
                      onChange={(e) => setRepairIntakeForm((prev) => ({ ...prev, city: e.target.value }))}
                    />
                  </label>
                  <label>
                    {t("customerEmail")}
                    <input
                      type="email"
                      value={repairIntakeForm.email}
                      onChange={(e) => handleEmailChange(e.target.value)}
                      aria-invalid={emailError ? "true" : undefined}
                      aria-describedby={emailError ? "email-error" : undefined}
                    />
                    {emailError && (
                      <span id="email-error" className="field-error" role="alert">
                        {emailError}
                      </span>
                    )}
                  </label>
                  <label>
                    {t("customerPhone")}
                    <input
                      value={repairIntakeForm.phone}
                      onChange={(e) => setRepairIntakeForm((prev) => ({ ...prev, phone: e.target.value }))}
                    />
                  </label>
                </div>
                <h4 className="intake-subsection-title">{t("sectionRepairDetails")}</h4>
                <div className="intake-edit-grid">
                  <label>
                    {t("articleType")}
                    <select
                      value={repairIntakeForm.productType}
                      onChange={(e) => setRepairIntakeForm((prev) => ({ ...prev, productType: e.target.value }))}
                    >
                      <option value="">-</option>
                      {ARTICLE_TYPE_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {t(`articleTypeOption.${option}`)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {t("dateBroughtIn")}
                    <input
                      type="date"
                      value={repairIntakeForm.createdDate}
                      onChange={(e) => setRepairIntakeForm((prev) => ({ ...prev, createdDate: e.target.value }))}
                    />
                  </label>
                  <label className="wide">
                    {t("itemDescription")}
                    <textarea
                      rows={2}
                      value={repairIntakeForm.itemName}
                      onChange={(e) => setRepairIntakeForm((prev) => ({ ...prev, itemName: e.target.value }))}
                    />
                  </label>
                  <label className="wide">
                    {t("problem")}
                    <textarea
                      rows={3}
                      value={repairIntakeForm.problemDescription}
                      onChange={(e) => setRepairIntakeForm((prev) => ({ ...prev, problemDescription: e.target.value }))}
                    />
                  </label>
                </div>

                {/* Sticky action bar for edit mode */}
                <div className="detail-action-bar">
                  <button disabled={busyActions.saveRepairIntake} onClick={() => void saveRepairIntake(selectedRepair.id)}>
                    <Save size={14} /> {busyActions.saveRepairIntake ? t("loadingSaveCustomerIntake") : t("saveCustomerIntake")}
                  </button>
                  <button
                    type="button"
                    aria-label={t("cancelEdit")}
                    onClick={() => {
                      if (intakeHasUnsavedChanges) {
                        setShowUnsavedDialog({
                          action: () => setIsEditingRepairIntake(false),
                          saveAction: () => saveRepairIntake(selectedRepair.id),
                        });
                        return;
                      }
                      setIsEditingRepairIntake(false);
                    }}
                  >
                    {t("cancelEdit")}
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Customer card */}
                <div className="customer-summary-card">
                  <div className="customer-summary-name">{formatCustomerFullName(selectedRepair)}</div>
                  <div className="customer-summary-row">
                    {selectedRepair.streetAddress && (
                      <span>{selectedRepair.streetAddress}</span>
                    )}
                    {selectedRepair.city && <span>{selectedRepair.city}</span>}
                  </div>
                  <div className="customer-summary-row">
                    {selectedRepair.email && (
                      <a href={`mailto:${selectedRepair.email}`} className="customer-contact-link">
                        {selectedRepair.email}
                      </a>
                    )}
                    {(() => {
                      const phoneHref = formatTelHref(selectedRepair.phone);
                      if (!phoneHref || !selectedRepair.phone) return null;
                      return (
                        <a href={phoneHref} className="customer-contact-link">
                          {selectedRepair.phone}
                        </a>
                      );
                    })()}
                  </div>
                </div>

                {/* Repair item details */}
                <h4 className="intake-subsection-title">{t("sectionRepairDetails")}</h4>
                <dl className="detail-grid">
                  <div>
                    <dt>{t("articleType")}</dt>
                    <dd>{formatArticleType(selectedRepair.productType)}</dd>
                  </div>
                  <div>
                    <dt>{t("dateBroughtIn")}</dt>
                    <dd>{formatDisplayDate(selectedRepair.createdDate)}</dd>
                  </div>
                  <div className="wide">
                    <dt>{t("itemDescription")}</dt>
                    <dd>
                      {selectedRepair.itemName ?? "-"}
                      {translatedContent?.itemName && (
                        <span className="translation-inline">EN: {translatedContent.itemName}</span>
                      )}
                    </dd>
                  </div>
                  <div className="wide">
                    <dt>{t("problem")}</dt>
                    <dd>
                      {renderExpandableValue("problemDescription", selectedRepair.problemDescription)}
                      {translatedContent?.problemDescription && (
                        <span className="translation-inline">EN: {translatedContent.problemDescription}</span>
                      )}
                    </dd>
                  </div>
                </dl>
              </>
            )}
          </section>
        )}

        {/* ── Work Tab ── */}
        {activeTab === "work" && (
          <section aria-label={t("tabWork", "Work")}>
            <div className="section-header-row">
              <h3>{t("repairOutcomeSection")}</h3>
              {canEditRepairWork(selectedRepair) && !isEditingRepairWork && (
                <button
                  type="button"
                  onClick={() => setIsEditingRepairWork(true)}
                  aria-label={t("editRepairWork")}
                >
                  <Pencil size={14} /> {t("editRepairWork")}
                </button>
              )}
            </div>
            <p className="section-hint">{outcomeEditHint()}</p>

            {isEditingRepairWork ? (
              <>
                <div className="repair-outcome-edit-grid">
                  <label>
                    {t("status")}
                    <select
                      value={repairWorkForm.status}
                      onChange={(e) =>
                        setRepairWorkForm((prev) => ({
                          ...prev,
                          status: e.target.value as
                            | "IN_PROGRESS"
                            | "WAITING_PARTS"
                            | "NOTIFY_CUSTOMER"
                            | "READY_FOR_PICKUP"
                            | "COMPLETED"
                            | "CANCELLED",
                        }))
                      }
                    >
                      <option value="IN_PROGRESS">{t("statusInProgress")}</option>
                      <option value="WAITING_PARTS">{t("statusWaitingParts")}</option>
                      <option value="NOTIFY_CUSTOMER">{t("statusNotifyCustomer")}</option>
                      <option value="READY_FOR_PICKUP">{t("statusReadyForPickup")}</option>
                      <option value="COMPLETED">{t("statusCompleted")}</option>
                      <option value="CANCELLED">{t("statusCancelled")}</option>
                    </select>
                  </label>
                  <label>
                    {t("outcome")}
                    <select
                      value={repairWorkForm.outcome}
                      onChange={(e) =>
                        setRepairWorkForm((prev) => ({
                          ...prev,
                          outcome: e.target.value as "" | "YES" | "PARTIAL" | "NO",
                        }))
                      }
                    >
                      <option value="">{t("unknown")}</option>
                      <option value="YES">{t("yes")}</option>
                      <option value="PARTIAL">{t("partial")}</option>
                      <option value="NO">{t("no")}</option>
                    </select>
                    {outcomeWarning && (
                      <span className="field-warning" role="alert">
                        {outcomeWarning}
                      </span>
                    )}
                  </label>
                  <label>
                    {t("lastUpdate")}
                    <input value={formatDisplayDateTime(selectedRepair.updatedAt)} readOnly />
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={repairWorkForm.safetyTested === true}
                      onChange={(e) =>
                        setRepairWorkForm((prev) => ({
                          ...prev,
                          safetyTested: e.target.checked,
                        }))
                      }
                    />
                    {t("safetyTest")}
                  </label>
                  <label className="wide">
                    {t("fix")}
                    <textarea
                      rows={3}
                      value={repairWorkForm.fixDescription}
                      onChange={(e) => setRepairWorkForm((prev) => ({ ...prev, fixDescription: e.target.value }))}
                    />
                  </label>
                  <label className="wide">
                    {t("material")}
                    <textarea
                      rows={3}
                      value={repairWorkForm.material}
                      onChange={(e) => setRepairWorkForm((prev) => ({ ...prev, material: e.target.value }))}
                    />
                  </label>
                  <label className="wide">
                    {t("remarks")}
                    <textarea
                      rows={4}
                      value={repairWorkForm.technicianNotes}
                      onChange={(e) => setRepairWorkForm((prev) => ({ ...prev, technicianNotes: e.target.value }))}
                    />
                  </label>
                </div>

                {/* Sticky action bar for edit mode */}
                <div className="detail-action-bar">
                  <button disabled={busyActions.saveRepairWork} onClick={() => void saveRepairWork(selectedRepair.id)}>
                    <Save size={14} /> {busyActions.saveRepairWork ? t("loadingSaveRepairWork") : t("saveRepairWork")}
                  </button>
                  <button
                    type="button"
                    aria-label={t("cancelEdit")}
                    onClick={() => {
                      if (workHasUnsavedChanges) {
                        setShowUnsavedDialog({
                          action: () => setIsEditingRepairWork(false),
                          saveAction: () => saveRepairWork(selectedRepair.id),
                        });
                        return;
                      }
                      setIsEditingRepairWork(false);
                    }}
                  >
                    {t("cancelEdit")}
                  </button>
                </div>
              </>
            ) : (
              <dl className="detail-grid">
                <div>
                  <dt>{t("lastUpdate")}</dt>
                  <dd>{formatDisplayDateTime(selectedRepair.updatedAt)}</dd>
                </div>
                <div>
                  <dt>{t("outcome")}</dt>
                  <dd>
                    {selectedRepair.outcome === "YES"
                      ? t("yes")
                      : selectedRepair.outcome === "PARTIAL"
                        ? t("partial")
                        : selectedRepair.outcome === "NO"
                          ? t("no")
                          : t("unknown")}
                  </dd>
                </div>
                <div>
                  <dt>{t("safetyTest")}</dt>
                  <dd>
                    {selectedRepair.safetyTested === null
                      ? t("unknown")
                      : selectedRepair.safetyTested
                        ? t("yes")
                        : t("no")}
                  </dd>
                </div>
                <div className="wide">
                  <dt>{t("fix")}</dt>
                  <dd>{renderExpandableValue("fixDescription", selectedRepair.fixDescription)}</dd>
                </div>
                <div className="wide">
                  <dt>{t("material")}</dt>
                  <dd>{renderExpandableValue("material", selectedRepair.material)}</dd>
                </div>
                <div className="wide">
                  <dt>{t("remarks")}</dt>
                  <dd>{renderExpandableValue("technicianNotes", selectedRepair.technicianNotes)}</dd>
                </div>
              </dl>
            )}
          </section>
        )}

        {/* ── Parts Tab ── */}
        {activeTab === "parts" && (
          <section aria-label={t("tabParts", "Parts")}>
            <h3>{t("materialsSection")}</h3>

            {isLoadingMaterials ? (
              <div aria-busy="true">
                <Skeleton width="100%" height="1.2em" count={4} />
              </div>
            ) : (
              <>
                {repairMaterials.length === 0 ? (
                  <p className="field-help">{t("materialNoItems")}</p>
                ) : (
                  <>
                    <table className="materials-table">
                      <thead>
                        <tr>
                          <th>{t("materialDescription")}</th>
                          <th>{t("materialQty")}</th>
                          <th>{t("materialUnitCost")}</th>
                          <th>{t("materialTotalCost")}</th>
                          <th title={t("materialBilledTooltip")}>{t("materialBilled")} &#9432;</th>
                          <th>{t("materialReceipt")}</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {repairMaterials.map((mat) => (
                          <tr key={mat.id}>
                            <td>
                              <span>{mat.description}</span>
                              {mat.inventoryItem && (
                                <span className="field-help">
                                  {" "}
                                  ({mat.inventoryItem.sku ?? mat.inventoryItem.name})
                                </span>
                              )}
                              {mat.notes && <span className="field-help mat-notes">{mat.notes}</span>}
                            </td>
                            <td>{Number(mat.quantity)}</td>
                            <td>{Number(mat.unitCost).toFixed(2)}</td>
                            <td>
                              <strong>{Number(mat.totalCost).toFixed(2)}</strong>
                            </td>
                            <td>
                              <input
                                type="checkbox"
                                checked={mat.billedToCustomer}
                                disabled={!canManageMaterials}
                                onChange={(e) =>
                                  void updateRepairMaterial(selectedRepair.id, mat.id, {
                                    billedToCustomer: e.target.checked,
                                  })
                                }
                              />
                            </td>
                            <td>
                              {mat.receiptStorageKey ? (
                                <span className="receipt-actions">
                                  <a
                                    href={`${api.defaults.baseURL}/repairs/${selectedRepair.id}/materials/${mat.id}/receipt`}
                                    target="_blank"
                                    rel="noreferrer"
                                    title={t("materialViewReceipt")}
                                  >
                                    <Receipt size={14} />
                                  </a>
                                  {canManageMaterials && (
                                    <button
                                      type="button"
                                      className="icon-btn"
                                      title={t("materialRemoveReceipt")}
                                      onClick={() => void removeMaterialReceipt(selectedRepair.id, mat.id)}
                                    >
                                      <X size={12} />
                                    </button>
                                  )}
                                </span>
                              ) : canManageMaterials ? (
                                <label className="receipt-upload-label" title={t("materialUploadReceipt")}>
                                  <Upload size={14} />
                                  <input
                                    type="file"
                                    accept="image/*,.pdf"
                                    className="hidden-input"
                                    onChange={(e) => {
                                      const f = e.target.files?.[0];
                                      if (f) void uploadMaterialReceipt(selectedRepair.id, mat.id, f);
                                      e.target.value = "";
                                    }}
                                  />
                                </label>
                              ) : (
                                <span>-</span>
                              )}
                            </td>
                            <td>
                              {canManageMaterials && (
                                <button
                                  type="button"
                                  className="icon-btn"
                                  title={t("delete")}
                                  aria-label={t("delete")}
                                  onClick={() => void deleteRepairMaterial(selectedRepair.id, mat.id)}
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {(() => {
                      const totalMat = repairMaterials.reduce((sum, m) => sum + Number(m.totalCost), 0);
                      const totalBilled = repairMaterials
                        .filter((m) => m.billedToCustomer)
                        .reduce((sum, m) => sum + Number(m.totalCost), 0);
                      const pct = totalMat > 0 ? Math.round((totalBilled / totalMat) * 100) : 0;
                      return (
                        <div className="material-cost-summary">
                          <span>
                            {t("materialTotalMaterialCost")}: <strong>CHF {totalMat.toFixed(2)}</strong>
                          </span>
                          <span>
                            {t("materialTotalBilled")}: <strong>CHF {totalBilled.toFixed(2)}</strong>
                          </span>
                          <span className="billed-pct">{t("materialBilledPercent", { percent: pct })}</span>
                        </div>
                      );
                    })()}
                  </>
                )}
                {canManageMaterials && (
                  <MaterialAddRow
                    inventoryItems={inventoryItems}
                    onLoadInventory={() => void loadInventoryItems()}
                    onAdd={(data) => void addRepairMaterial(selectedRepair.id, data)}
                  />
                )}
              </>
            )}
          </section>
        )}

        {/* ── Photos Tab ── */}
        {activeTab === "photos" && (
          <section aria-label={t("tabPhotos", "Photos")}>
            <div className="photos-section-header">
              <h3>
                {t("photos")} ({selectedRepair.photos.length})
              </h3>
              {canManagePhotos && (
                <span className="photo-upload-group">
                  <label className="photo-upload-btn">
                    <Plus size={14} /> {t("addPhotos")}
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={(e) => void uploadPhotos(selectedRepair.id, e.target.files)}
                      hidden
                    />
                  </label>
                  <span className="photo-info-tip" title={t("photoRequirements")}>
                    &#9432;
                  </span>
                </span>
              )}
            </div>

            {selectedRepair.photos.length === 0 ? (
              <p className="field-help">{t("noPhotos")}</p>
            ) : (
              <div className="photo-grid" aria-label={t("photos")}>
                {selectedRepair.photos.map((photo) => (
                  <div key={photo.id} className="photo-card">
                    <div className="photo-card-image">
                      {photoPreviewUrls[photo.id] ? (
                        <a href={photoPreviewUrls[photo.id]} target="_blank" rel="noreferrer">
                          <img src={photoPreviewUrls[photo.id]} alt={photo.caption || ""} />
                        </a>
                      ) : (
                        <span className="photo-loading">
                          <Spinner size={24} label={t("loading")} />
                        </span>
                      )}
                      {canManagePhotos && (
                        <button
                          type="button"
                          className="photo-delete-btn"
                          title={t("delete")}
                          aria-label={t("delete")}
                          onClick={() => void removePhoto(selectedRepair.id, photo.id)}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      className="photo-caption-input"
                      placeholder={t("photoCaption")}
                      defaultValue={photo.caption ?? ""}
                      onBlur={(e) => {
                        const val = e.target.value.trim();
                        if (val !== (photo.caption ?? "")) {
                          void api.patch(`/repairs/${selectedRepair.id}/photos/${photo.id}`, { caption: val });
                        }
                      }}
                    />
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── History Tab ── */}
        {activeTab === "history" && (
          <section aria-label={t("tabHistory", "History")}>
            <h3>{t("repairChangeHistoryTitle")}</h3>

            {isLoadingRepairHistory ? (
              <div aria-busy="true">
                <Skeleton width="100%" height="1.2em" count={3} />
              </div>
            ) : repairChangeHistory.length === 0 ? (
              <p className="field-help">{t("repairChangeHistoryEmpty")}</p>
            ) : (
              <ul className="repair-history-list">
                {repairChangeHistory.map((entry) => (
                  <li key={entry.id}>
                    <strong>{formatChangeType(entry.changeType)}</strong>{" "}
                    <span className="field-help">
                      {formatDisplayDateTime(entry.createdAt)} -{" "}
                      {entry.changedBy?.fullName ?? entry.changedBy?.username ?? t("unknown")}
                    </span>
                    {entry.changeType === "ASSIGNMENT" ? (
                      <div className="field-help">
                        {t("historyAssignmentFrom", {
                          from: (entry.previousData?.assignedToName as string) || t("unassigned"),
                        })}
                        {" → "}
                        {t("historyAssignmentTo", {
                          to: (entry.nextData?.assignedToName as string) || t("unassigned"),
                        })}
                      </div>
                    ) : (
                      entry.changedFields.length > 0 && (
                        <div className="field-help">
                          {t("repairChangeFieldsLabel")}: {entry.changedFields.join(", ")}
                        </div>
                      )
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>

      {/* ---- Thermal label preview ---- */}
      {showThermalPreview && (
        <ThermalLabelPreview repair={selectedRepair} onClose={() => setShowThermalPreview(false)} />
      )}
    </article>
  );
}
