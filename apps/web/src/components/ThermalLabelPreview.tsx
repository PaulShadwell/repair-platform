import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import QRCode from "qrcode";
import type { Repair } from "../types";

type Props = {
  repair: Repair;
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

export function ThermalLabelPreview({ repair }: Props) {
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

  return (
    <section className="thermal-preview-section">
      <h3>{t("thermalPreviewTitle")}</h3>
      <p className="preview-note">
        {t("thermalPreviewNote")}
      </p>
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
          <div className="cell right">{boolBox(repair.successful)}</div>
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
        <button onClick={() => window.print()}>{t("browserPrintPreview")}</button>
      </div>
    </section>
  );
}
