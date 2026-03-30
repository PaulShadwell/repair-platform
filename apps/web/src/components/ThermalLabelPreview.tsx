import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { X, Printer } from "lucide-react";
import QRCode from "qrcode";
import type { Repair } from "../types";

type Props = {
  repair: Repair;
  onClose: () => void;
};

function formatDate(input: string | null, locale: string): string {
  if (!input) return "";
  const d = new Date(input);
  if (Number.isNaN(d.valueOf())) return "";
  return d.toLocaleDateString(locale);
}

function boolBox(value: boolean | null): string {
  return value ? "[x]" : "[ ]";
}

export function ThermalLabelPreview({ repair, onClose }: Props) {
  const { t, i18n } = useTranslation();
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const dateLocale = i18n.language.startsWith("en") ? "en-GB" : "de-CH";
  const publicUrl = useMemo(
    () => `${window.location.origin}/repairs/${encodeURIComponent(repair.publicRef)}`,
    [repair.publicRef],
  );

  useEffect(() => {
    void QRCode.toDataURL(publicUrl, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 220,
    }).then(setQrDataUrl);
  }, [publicUrl]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div className="thermal-modal-overlay" onClick={onClose}>
      <div className="thermal-modal" onClick={(e) => e.stopPropagation()}>
        <div className="thermal-modal-header">
          <h3>{t("thermalPreviewTitle")}</h3>
          <button type="button" className="thermal-modal-close" onClick={onClose} aria-label={t("close")}>
            <X size={20} />
          </button>
        </div>
        <p className="preview-note">{t("thermalPreviewNote")}</p>
        <div className="thermal-preview" id="thermal-preview">
          <div className="row two-col top-row">
            <div className="cell left">{t("thermalRepair")}</div>
            <div className="cell right large">{repair.repairNumber ?? repair.publicRef}</div>
          </div>

          <div className="row two-col qr-row">
            <div className="cell left" />
            <div className="cell right qr-cell">
              {qrDataUrl ? <img src={qrDataUrl} alt={t("thermalRepairQrAlt")} /> : <span>{t("thermalGeneratingQr")}</span>}
            </div>
          </div>

          <div className="row two-col">
            <div className="cell left strong">{t("thermalDate")}</div>
            <div className="cell right">{formatDate(repair.createdDate, dateLocale)}</div>
          </div>
          <div className="row two-col">
            <div className="cell left strong">{t("product")}</div>
            <div className="cell right">{repair.itemName ?? ""}</div>
          </div>
          <div className="row two-col">
            <div className="cell left strong">{t("problem")}</div>
            <div className="cell right">{repair.problemDescription ?? ""}</div>
          </div>
          <div className="row two-col">
            <div className="cell left strong">{t("thermalTechnician")}</div>
            <div className="cell right">{repair.assignedToUser?.fullName ?? ""}</div>
          </div>
          <div className="row two-col">
            <div className="cell left strong">{t("thermalDateDoneFix")}</div>
            <div className="cell right">{formatDate(repair.completedAt, dateLocale)} {repair.fixDescription ?? ""}</div>
          </div>
          <div className="row two-col">
            <div className="cell left strong">{t("thermalSuccessful")}</div>
            <div className="cell right">
              {repair.outcome === "YES" ? t("yes") : repair.outcome === "PARTIAL" ? t("partial") : repair.outcome === "NO" ? t("no") : "-"}
            </div>
          </div>
          <div className="row two-col">
            <div className="cell left strong">{t("thermalSafetyTestDone")}</div>
            <div className="cell right">{boolBox(repair.safetyTested)}</div>
          </div>

          <div className="row">
            <div className="cell full ref">{t("reference")}: {repair.publicRef}</div>
          </div>
        </div>
        <div className="preview-actions">
          <button onClick={() => window.print()}>
            <Printer size={14} /> {t("browserPrintPreview")}
          </button>
        </div>
      </div>
    </div>
  );
}
