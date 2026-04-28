import { useTranslation } from "react-i18next";
import { Eye, EyeOff } from "lucide-react";
import { useAppContext } from "../context/AppContext";
import { Spinner } from "../components/Spinner";

export function ForcePasswordChange() {
  const { t } = useTranslation();
  const {
    passwordForm,
    setPasswordForm,
    showPasswordFields,
    togglePasswordField,
    busyActions,
    changeMyPassword,
    logout,
    brandLogoSrc,
  } = useAppContext();

  return (
    <main className="container login-screen">
      <section className="card login-card">
        <header className="login-card-header">
          <img className="login-brand-logo" src={brandLogoSrc} alt="" />
          <h1>{t("forcePasswordChangeTitle")}</h1>
          <p>{t("forcePasswordChangeHelp")}</p>
        </header>
        <div className="profile-password-grid">
          <label className="wide">
            {t("profileCurrentPassword")}
            <div className="password-field">
              <input
                type={showPasswordFields.currentPassword ? "text" : "password"}
                value={passwordForm.currentPassword}
                onChange={(e) =>
                  setPasswordForm((prev) => ({
                    ...prev,
                    currentPassword: e.target.value,
                  }))
                }
              />
              <button
                type="button"
                onClick={() => togglePasswordField("currentPassword")}
              >
                {showPasswordFields.currentPassword ? (
                  <EyeOff size={14} />
                ) : (
                  <Eye size={14} />
                )}
              </button>
            </div>
          </label>
          <label>
            {t("profileNewPassword")}
            <div className="password-field">
              <input
                type={showPasswordFields.newPassword ? "text" : "password"}
                value={passwordForm.newPassword}
                onChange={(e) =>
                  setPasswordForm((prev) => ({
                    ...prev,
                    newPassword: e.target.value,
                  }))
                }
              />
              <button
                type="button"
                onClick={() => togglePasswordField("newPassword")}
              >
                {showPasswordFields.newPassword ? (
                  <EyeOff size={14} />
                ) : (
                  <Eye size={14} />
                )}
              </button>
            </div>
          </label>
          <label>
            {t("profileConfirmPassword")}
            <div className="password-field">
              <input
                type={
                  showPasswordFields.confirmNewPassword ? "text" : "password"
                }
                value={passwordForm.confirmNewPassword}
                onChange={(e) =>
                  setPasswordForm((prev) => ({
                    ...prev,
                    confirmNewPassword: e.target.value,
                  }))
                }
              />
              <button
                type="button"
                onClick={() => togglePasswordField("confirmNewPassword")}
              >
                {showPasswordFields.confirmNewPassword ? (
                  <EyeOff size={14} />
                ) : (
                  <Eye size={14} />
                )}
              </button>
            </div>
          </label>
        </div>
        <div className="detail-header-actions">
          <button
            disabled={busyActions.changePassword}
            onClick={() => void changeMyPassword()}
          >
            {busyActions.changePassword ? (
              <>
                <Spinner size={14} /> {t("loadingChangePassword")}
              </>
            ) : (
              t("profileChangePassword")
            )}
          </button>
          <button type="button" onClick={logout}>
            {t("logout")}
          </button>
        </div>
      </section>
    </main>
  );
}
