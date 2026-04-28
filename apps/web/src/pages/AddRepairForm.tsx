import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import { useAppContext, ARTICLE_TYPE_OPTIONS } from "../context/AppContext";
import { FormField } from "../components/FormField";
import { Spinner } from "../components/Spinner";

type FieldErrors = Record<string, string>;

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function AddRepairForm() {
  const { t } = useTranslation();
  const {
    newRepair,
    setNewRepair,
    busyActions,
    createRepair,
    resetNewRepairForm,
    assignees,
    canAssignRepairs,
    isLoadingCustomerHistory,
    hasQueriedCustomerHistory,
    customerHistoryMatches,
    applyCustomerFromHistory,
    clearLinkedCustomer,
    formatCustomerFullName,
    formatRepairRef,
    formatStatus,
  } = useAppContext();

  const [errors, setErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const validate = useCallback(
    (field: string, value: string): string => {
      if (
        ["firstName", "lastName", "phone", "productType", "itemName", "problemDescription"].includes(field) &&
        !value.trim()
      ) {
        return t("fieldRequired");
      }
      if (field === "email" && value.trim() && !isValidEmail(value)) {
        return t("invalidEmail");
      }
      return "";
    },
    [t],
  );

  const handleBlur = useCallback(
    (field: string) => {
      setTouched((prev) => ({ ...prev, [field]: true }));
      const value = (newRepair as Record<string, string>)[field] ?? "";
      const error = validate(field, value);
      setErrors((prev) => ({ ...prev, [field]: error }));
    },
    [newRepair, validate],
  );

  const handleChange = useCallback(
    (field: string, value: string) => {
      setNewRepair((prev) => ({ ...prev, [field]: value }));
      if (touched[field]) {
        const error = validate(field, value);
        setErrors((prev) => ({ ...prev, [field]: error }));
      }
    },
    [setNewRepair, touched, validate],
  );

  const handleSubmit = useCallback(() => {
    const requiredFields = ["firstName", "lastName", "phone", "productType", "itemName", "problemDescription"];
    const newErrors: FieldErrors = {};
    const newTouched: Record<string, boolean> = {};
    for (const field of requiredFields) {
      newTouched[field] = true;
      const value = (newRepair as Record<string, string>)[field] ?? "";
      const error = validate(field, value);
      if (error) newErrors[field] = error;
    }
    // Also validate email if provided
    if (newRepair.email.trim()) {
      newTouched["email"] = true;
      const emailError = validate("email", newRepair.email);
      if (emailError) newErrors["email"] = emailError;
    }
    setTouched((prev) => ({ ...prev, ...newTouched }));
    setErrors((prev) => ({ ...prev, ...newErrors }));
    if (Object.values(newErrors).some(Boolean)) return;
    void createRepair();
  }, [newRepair, validate, createRepair]);

  return (
    <div className="admin-tab-content">
      <h3>{t("addRepair")}</h3>
      <div className="add-repair-section">
        <h4 className="add-repair-section-title">{t("sectionCustomerDetails")}</h4>
        <div className="add-repair-grid">
          <FormField
            label={t("customerFirstName")}
            required
            error={touched.firstName ? errors.firstName : undefined}
          >
            <input
              value={newRepair.firstName}
              onChange={(e) => handleChange("firstName", e.target.value)}
              onBlur={() => handleBlur("firstName")}
            />
          </FormField>
          <FormField
            label={t("customerLastName")}
            required
            error={touched.lastName ? errors.lastName : undefined}
          >
            <input
              value={newRepair.lastName}
              onChange={(e) => handleChange("lastName", e.target.value)}
              onBlur={() => handleBlur("lastName")}
            />
          </FormField>
          <FormField label={t("customerStreetAddress")} wide>
            <input
              value={newRepair.streetAddress}
              onChange={(e) => setNewRepair((prev) => ({ ...prev, streetAddress: e.target.value }))}
            />
          </FormField>
          <FormField label={t("customerCity")}>
            <input
              value={newRepair.city}
              onChange={(e) => setNewRepair((prev) => ({ ...prev, city: e.target.value }))}
            />
          </FormField>
          <FormField
            label={t("customerEmail")}
            error={touched.email ? errors.email : undefined}
          >
            <input
              type="email"
              value={newRepair.email}
              onChange={(e) => handleChange("email", e.target.value)}
              onBlur={() => handleBlur("email")}
            />
          </FormField>
          <FormField
            label={t("customerPhone")}
            required
            error={touched.phone ? errors.phone : undefined}
          >
            <input
              value={newRepair.phone}
              onChange={(e) => handleChange("phone", e.target.value)}
              onBlur={() => handleBlur("phone")}
            />
          </FormField>
          {newRepair.customerId.trim() !== "" && (
            <div className="add-repair-clear-link">
              <button type="button" className="clear-linked-customer-btn" onClick={clearLinkedCustomer}>
                {t("clearLinkedCustomer")}
              </button>
            </div>
          )}
        </div>
        {(isLoadingCustomerHistory || hasQueriedCustomerHistory) && (
          <div className="detail-section add-repair-history">
            <h4>{t("customerHistoryTitle")}</h4>
            {isLoadingCustomerHistory ? (
              <p className="field-help">{t("loading")}</p>
            ) : (
              <>
                <p className="field-help">
                  {t("customerHistoryCount", { count: customerHistoryMatches.length })}
                </p>
                {customerHistoryMatches.length === 0 ? (
                  <p className="field-help">{t("customerHistoryNoMatches")}</p>
                ) : (
                  <>
                    <p className="field-help">{t("customerHistoryTapHint")}</p>
                    <ul className="customer-history-list">
                      {customerHistoryMatches.map((repair) => (
                        <li key={repair.id}>
                          <button
                            type="button"
                            className="customer-history-row"
                            onClick={() => applyCustomerFromHistory(repair)}
                          >
                            <span className="customer-history-name">
                              {formatCustomerFullName(repair)}
                            </span>
                            <span className="customer-history-meta">
                              {formatRepairRef(repair)} · {repair.itemName ?? t("noProduct")} ·{" "}
                              {formatStatus(repair.status, repair.notified)}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>
      <div className="add-repair-section">
        <h4 className="add-repair-section-title">{t("sectionRepairDetails")}</h4>
        <div className="add-repair-grid">
          <FormField
            label={t("articleType")}
            required
            error={touched.productType ? errors.productType : undefined}
          >
            <select
              value={newRepair.productType}
              onChange={(e) => handleChange("productType", e.target.value)}
              onBlur={() => handleBlur("productType")}
            >
              <option value="">-</option>
              {ARTICLE_TYPE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {t(`articleTypeOption.${option}`)}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label={t("dateReceived")}>
            <input
              type="date"
              value={newRepair.createdDate}
              onChange={(e) => setNewRepair((prev) => ({ ...prev, createdDate: e.target.value }))}
            />
          </FormField>
          <FormField
            label={t("itemDescription")}
            required
            wide
            error={touched.itemName ? errors.itemName : undefined}
          >
            <input
              value={newRepair.itemName}
              onChange={(e) => handleChange("itemName", e.target.value)}
              onBlur={() => handleBlur("itemName")}
            />
          </FormField>
          <FormField
            label={t("problem")}
            required
            wide
            error={touched.problemDescription ? errors.problemDescription : undefined}
          >
            <input
              value={newRepair.problemDescription}
              onChange={(e) => handleChange("problemDescription", e.target.value)}
              onBlur={() => handleBlur("problemDescription")}
            />
          </FormField>
          {assignees.length > 0 && canAssignRepairs && (
            <FormField label={t("assigned")}>
              <select
                value={newRepair.assignedToUserId}
                onChange={(e) => setNewRepair((prev) => ({ ...prev, assignedToUserId: e.target.value }))}
              >
                <option value="">{t("unassigned")}</option>
                {assignees.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.fullName}
                  </option>
                ))}
              </select>
            </FormField>
          )}
        </div>
      </div>
      <div className="add-repair-actions">
        <button
          className="add-repair-submit"
          disabled={busyActions.createRepair}
          onClick={handleSubmit}
        >
          {busyActions.createRepair ? (
            <Spinner size={14} />
          ) : (
            <Plus size={14} />
          )}{" "}
          {busyActions.createRepair ? t("loadingCreateRepair") : t("createRepair")}
        </button>
        <button
          type="button"
          className="add-repair-submit"
          onClick={resetNewRepairForm}
        >
          {t("clearForm")}
        </button>
      </div>
    </div>
  );
}
