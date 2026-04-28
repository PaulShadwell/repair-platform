import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppContext } from "../context/AppContext";
import { Spinner } from "../components/Spinner";
import { FormField } from "../components/FormField";
import { Toast } from "../components/Toast";

export function LoginPage() {
  const {
    brandLogoSrc,
    brandAppName,
    showForgotPassword,
    setShowForgotPassword,
    forgotPasswordStep,
    setForgotPasswordStep,
    forgotPasswordForm,
    setForgotPasswordForm,
    message,
    messageType,
    showToast,
    login,
    requestPasswordReset,
    resetPasswordWithToken,
  } = useAppContext();
  const { t } = useTranslation();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validateLoginForm(formData: FormData): boolean {
    const newErrors: Record<string, string> = {};
    const username = formData.get("username") as string;
    const password = formData.get("password") as string;

    if (!username?.trim()) {
      newErrors.username = t("fieldRequired", { field: t("username") });
    }
    if (!password?.trim()) {
      newErrors.password = t("fieldRequired", { field: t("password") });
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    if (!validateLoginForm(formData)) {
      return;
    }

    setIsSubmitting(true);
    try {
      await login(formData);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRequestPasswordReset() {
    setIsResetting(true);
    try {
      await requestPasswordReset();
    } finally {
      setIsResetting(false);
    }
  }

  async function handleResetPasswordWithToken() {
    setIsResetting(true);
    try {
      await resetPasswordWithToken();
    } finally {
      setIsResetting(false);
    }
  }

  return (
    <main className="container login-screen">
      <form
        className="card login-card"
        aria-label={t("login")}
        onSubmit={(event) => void handleLogin(event)}
      >
        <header className="login-card-header">
          <img className="login-brand-logo" src={brandLogoSrc} alt="" />
          <h1>{brandAppName}</h1>
          <p>{t("login")}</p>
        </header>

        <FormField
          label={t("username")}
          required
          error={errors.username}
        >
          <input
            name="username"
            autoComplete="username"
            required
            aria-describedby={errors.username ? "login-username-error" : undefined}
            onChange={() => {
              if (errors.username) {
                setErrors((prev) => ({ ...prev, username: "" }));
              }
            }}
          />
          {errors.username && (
            <span id="login-username-error" role="alert" className="sr-only">
              {errors.username}
            </span>
          )}
        </FormField>

        <FormField
          label={t("password")}
          required
          error={errors.password}
        >
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            aria-describedby={errors.password ? "login-password-error" : undefined}
            onChange={() => {
              if (errors.password) {
                setErrors((prev) => ({ ...prev, password: "" }));
              }
            }}
          />
          {errors.password && (
            <span id="login-password-error" role="alert" className="sr-only">
              {errors.password}
            </span>
          )}
        </FormField>

        <button type="submit" className="login-submit" disabled={isSubmitting}>
          {isSubmitting ? <Spinner size={16} label={t("login")} /> : t("login")}
        </button>

        <button
          type="button"
          className="login-link-button"
          onClick={() => {
            setShowForgotPassword((prev) => !prev);
            setForgotPasswordStep("request");
          }}
        >
          {showForgotPassword ? t("cancelEdit") : t("forgotPassword")}
        </button>

        {showForgotPassword && (
          <div className="forgot-password-panel">
            <label className="login-field">
              <span>{t("username")}</span>
              <input
                value={forgotPasswordForm.username}
                onChange={(event) =>
                  setForgotPasswordForm((prev) => ({ ...prev, username: event.target.value }))
                }
                autoComplete="username"
              />
            </label>

            {forgotPasswordStep === "request" ? (
              <>
                <button
                  type="button"
                  className="login-submit"
                  disabled={isResetting}
                  onClick={() => void handleRequestPasswordReset()}
                >
                  {isResetting ? (
                    <Spinner size={16} label={t("requestResetEmail")} />
                  ) : (
                    t("requestResetEmail")
                  )}
                </button>
                <p className="field-help">{t("forgotPasswordHelp")}</p>
              </>
            ) : (
              <>
                <label className="login-field">
                  <span>{t("resetToken")}</span>
                  <input
                    value={forgotPasswordForm.resetToken}
                    onChange={(event) =>
                      setForgotPasswordForm((prev) => ({ ...prev, resetToken: event.target.value }))
                    }
                  />
                </label>

                <label className="login-field">
                  <span>{t("profileNewPassword")}</span>
                  <input
                    type="password"
                    value={forgotPasswordForm.newPassword}
                    onChange={(event) =>
                      setForgotPasswordForm((prev) => ({ ...prev, newPassword: event.target.value }))
                    }
                    autoComplete="new-password"
                  />
                </label>

                <label className="login-field">
                  <span>{t("profileConfirmPassword")}</span>
                  <input
                    type="password"
                    value={forgotPasswordForm.confirmNewPassword}
                    onChange={(event) =>
                      setForgotPasswordForm((prev) => ({
                        ...prev,
                        confirmNewPassword: event.target.value,
                      }))
                    }
                    autoComplete="new-password"
                  />
                </label>

                <button
                  type="button"
                  className="login-submit"
                  disabled={isResetting}
                  onClick={() => void handleResetPasswordWithToken()}
                >
                  {isResetting ? (
                    <Spinner size={16} label={t("submitPasswordReset")} />
                  ) : (
                    t("submitPasswordReset")
                  )}
                </button>

                <button
                  type="button"
                  className="login-link-button"
                  onClick={() => setForgotPasswordStep("request")}
                >
                  {t("requestResetEmailAgain")}
                </button>

                <p className="field-help">{t("forgotPasswordTokenHelp")}</p>
              </>
            )}
          </div>
        )}

        {message && (
          <p className={`message ${messageType} login-message`} role="alert">
            {message}
          </p>
        )}
      </form>
    </main>
  );
}
