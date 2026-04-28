import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { UserCircle, Eye, EyeOff } from "lucide-react";
import { useAppContext } from "../context/AppContext";
import { FormField } from "../components/FormField";
import { Spinner } from "../components/Spinner";

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function passwordStrength(pw: string): "weak" | "fair" | "strong" {
  if (pw.length < 6) return "weak";
  const hasUpper = /[A-Z]/.test(pw);
  const hasLower = /[a-z]/.test(pw);
  const hasDigit = /\d/.test(pw);
  const hasSpecial = /[^A-Za-z0-9]/.test(pw);
  const score = [hasUpper, hasLower, hasDigit, hasSpecial].filter(Boolean).length;
  if (pw.length >= 10 && score >= 3) return "strong";
  if (pw.length >= 8 && score >= 2) return "fair";
  return "weak";
}

export function ProfilePage() {
  const { t } = useTranslation();
  const {
    profile,
    profileForm,
    setProfileForm,
    passwordForm,
    setPasswordForm,
    showPasswordFields,
    togglePasswordField,
    busyActions,
    saveMyProfile,
    uploadMyAvatar,
    changeMyPassword,
    profileAvatarUrl,
    setShowProfilePage,
  } = useAppContext();

  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState<Record<string, boolean>>({});

  const emailError = useMemo(() => {
    if (!emailTouched) return undefined;
    if (profileForm.recoveryEmail.trim() && !isValidEmail(profileForm.recoveryEmail)) {
      return t("invalidEmail");
    }
    return undefined;
  }, [emailTouched, profileForm.recoveryEmail, t]);

  const passwordMismatch = useMemo(() => {
    if (!passwordTouched.confirmNewPassword) return undefined;
    if (
      passwordForm.confirmNewPassword &&
      passwordForm.newPassword !== passwordForm.confirmNewPassword
    ) {
      return t("passwordMismatch");
    }
    return undefined;
  }, [passwordTouched.confirmNewPassword, passwordForm.newPassword, passwordForm.confirmNewPassword, t]);

  const strength = useMemo(() => {
    if (!passwordForm.newPassword) return null;
    return passwordStrength(passwordForm.newPassword);
  }, [passwordForm.newPassword]);

  const strengthLabel = useMemo(() => {
    if (!strength) return "";
    const labels: Record<string, string> = {
      weak: t("passwordStrengthWeak"),
      fair: t("passwordStrengthFair"),
      strong: t("passwordStrengthStrong"),
    };
    return labels[strength] ?? strength;
  }, [strength, t]);

  const handlePasswordBlur = useCallback((field: string) => {
    setPasswordTouched((prev) => ({ ...prev, [field]: true }));
  }, []);

  return (
    <section className="card profile-page">
      <div className="profile-page-header">
        <h2>{t("profile")}</h2>
        <div className="profile-page-actions">
          <small>{profile?.username}</small>
          <button type="button" onClick={() => setShowProfilePage(false)}>
            {t("close")}
          </button>
        </div>
      </div>

      <div className="profile-layout">
        <div className="profile-avatar-panel">
          {profileAvatarUrl ? (
            <img
              className="profile-avatar-preview"
              src={profileAvatarUrl}
              alt={t("profileAvatarAlt")}
            />
          ) : (
            <div className="profile-avatar-placeholder">
              <UserCircle size={56} />
            </div>
          )}
          <label className="profile-control">
            {t("profileAvatarLabel")}
            <input
              type="file"
              accept="image/*"
              onChange={(e) => void uploadMyAvatar(e.target.files)}
            />
            <span className="field-help">{t("avatarUploadGuidance")}</span>
          </label>
        </div>

        <div className="profile-form-panel">
          <h3>{t("profileInfoTitle")}</h3>
          <div className="profile-grid">
            <label>
              {t("fullName")}
              <input
                value={profileForm.fullName}
                onChange={(e) =>
                  setProfileForm((prev) => ({ ...prev, fullName: e.target.value }))
                }
              />
            </label>
            <FormField
              label={t("recoveryEmail")}
              error={emailError}
              hint={t("recoveryEmailHelp")}
            >
              <input
                type="email"
                value={profileForm.recoveryEmail}
                onChange={(e) =>
                  setProfileForm((prev) => ({ ...prev, recoveryEmail: e.target.value }))
                }
                onBlur={() => setEmailTouched(true)}
              />
            </FormField>
            <label>
              {t("customerPhone")}
              <input
                value={profileForm.profilePhone}
                onChange={(e) =>
                  setProfileForm((prev) => ({ ...prev, profilePhone: e.target.value }))
                }
              />
            </label>
            <label>
              {t("profileLocation")}
              <input
                value={profileForm.profileLocation}
                onChange={(e) =>
                  setProfileForm((prev) => ({ ...prev, profileLocation: e.target.value }))
                }
              />
            </label>
            <label className="wide">
              {t("profileAboutMe")}
              <textarea
                rows={4}
                value={profileForm.aboutMe}
                onChange={(e) =>
                  setProfileForm((prev) => ({ ...prev, aboutMe: e.target.value }))
                }
              />
            </label>
          </div>
          <button
            disabled={busyActions.saveProfile}
            onClick={() => void saveMyProfile()}
          >
            {busyActions.saveProfile ? (
              <>
                <Spinner size={14} /> {t("loadingProfileSave")}
              </>
            ) : (
              t("profileSave")
            )}
          </button>
        </div>

        <div className="profile-password-panel">
          <h3>{t("profilePasswordTitle")}</h3>
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
            <FormField
              label={t("profileNewPassword")}
              hint={strength ? strengthLabel : undefined}
            >
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
                  onBlur={() => handlePasswordBlur("newPassword")}
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
            </FormField>
            <FormField
              label={t("profileConfirmPassword")}
              error={passwordMismatch}
            >
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
                  onBlur={() => handlePasswordBlur("confirmNewPassword")}
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
            </FormField>
          </div>
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
        </div>
      </div>
    </section>
  );
}
