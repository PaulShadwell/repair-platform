import { useTranslation } from "react-i18next";
import { useAppContext, DEFAULT_LOGO_SRC } from "../context/AppContext";

export function SettingsTab() {
  const { t } = useTranslation();
  const {
    isAdmin,
    setAdminTab,
    brandAppName,
    brandLogoSrc,
    brandingDraft,
    setBrandingDraft,
    setBrandLogoFile,
    saveBranding,
    deleteBrandLogo,
    printerProfiles,
    selectedPrinterProfileId,
    onPrinterProfileChange,
    selectedPrinterProfile,
    canGeneratePairCode,
    canManagePrinters,
    busyActions,
    generatePairingCode,
    latestPairingCode,
    currentLang,
    formatPrinterStatus,
    printerStatusBadgeClass,
    formatDisplayDateTime,
  } = useAppContext();

  return (
    <div className="admin-tab-content">
      <div className="detail-header-row">
        <h3>{t("settings")}</h3>
        <button type="button" onClick={() => setAdminTab("none")}>
          {t("close")}
        </button>
      </div>
      {isAdmin && (
        <div className="add-repair-section">
          <h4 className="add-repair-section-title">{t("brandingSection")}</h4>
          <div className="profile-grid">
            <label>
              {t("brandingAppName")}
              <input
                type="text"
                placeholder={brandAppName}
                value={brandingDraft.appName}
                onChange={(e) => setBrandingDraft({ ...brandingDraft, appName: e.target.value })}
              />
            </label>
            <label>
              {t("brandingLogo")}
              <div className="branding-logo-row">
                {brandLogoSrc !== DEFAULT_LOGO_SRC && (
                  <img className="branding-logo-preview" src={brandLogoSrc} alt="" />
                )}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp,image/gif"
                  onChange={(e) => setBrandLogoFile(e.target.files?.[0] ?? null)}
                />
              </div>
            </label>
          </div>
          <div className="add-repair-actions">
            <button onClick={() => void saveBranding()}>
              {t("brandingSave")}
            </button>
            {brandLogoSrc !== DEFAULT_LOGO_SRC && (
              <button
                className="clear-linked-customer-btn"
                onClick={() => void deleteBrandLogo()}
              >
                {t("brandingRemoveLogo")}
              </button>
            )}
          </div>
        </div>
      )}
      <h4 className="add-repair-section-title">{t("printerSection")}</h4>
      <div className="profile-grid">
        <label>
          {t("printerProfile")}
          <select
            value={selectedPrinterProfileId}
            onChange={(event) => onPrinterProfileChange(event.target.value)}
          >
            <option value="">Default</option>
            {printerProfiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {canGeneratePairCode && (
        <button
          type="button"
          disabled={!selectedPrinterProfileId || busyActions.generatePairCode}
          onClick={() => void generatePairingCode(selectedPrinterProfileId)}
        >
          {busyActions.generatePairCode ? t("loadingPairingCode") : t("generatePairingCode")}
        </button>
      )}
      <button
        type="button"
        onClick={() =>
          window.open(
            currentLang === "de" ? "/print-setup-de.html" : "/print-setup.html",
            "_blank",
            "noopener,noreferrer",
          )
        }
      >
        {t("openPrintSetupGuide")}
      </button>
      <p className="field-help">{t("openPrintSetupGuideHelp")}</p>
      {printerProfiles.length === 0 && (
        <p className="field-help">{t("noPrinterProfilesConfigured")}</p>
      )}
      {latestPairingCode && canManagePrinters && (
        <p className="field-help">{t("latestPairingCode", { code: latestPairingCode })}</p>
      )}
      {selectedPrinterProfile && (
        <div className="printer-readiness-row">
          <span>{t("printerReadinessLabel")}</span>
          <span className={printerStatusBadgeClass(selectedPrinterProfile.printerStatus)}>
            {formatPrinterStatus(selectedPrinterProfile.printerStatus)}
          </span>
          <span className="field-help inline-help">
            {t("lastSuccessfulPrintAt", {
              value: formatDisplayDateTime(selectedPrinterProfile.lastSuccessfulPrintAt),
            })}
          </span>
        </div>
      )}
      {selectedPrinterProfileId && selectedPrinterProfile && !selectedPrinterProfile.hasActiveAgent && (
        <p className="field-help">{t("noActivePairedAgent")}</p>
      )}
    </div>
  );
}
