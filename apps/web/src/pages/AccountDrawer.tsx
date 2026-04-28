import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { LogOut, Languages, UserCircle, Printer } from "lucide-react";
import { useAppContext } from "../context/AppContext";

export function AccountDrawer() {
  const {
    user,
    accountMenuOpen,
    accountMenuVisible,
    closeAccountMenu,
    guardUnsavedChanges,
    setShowFunctionHub,
    setShowProfilePage,
    setAdminTab,
    showAdminTools,
    currentLang,
    logout,
    i18n,
  } = useAppContext();

  const { t } = useTranslation();
  const drawerRef = useRef<HTMLElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const changeLanguage = async (lang: "de" | "en") => {
    await i18n.changeLanguage(lang);
  };

  // Focus trapping
  useEffect(() => {
    if (!accountMenuOpen) return;

    // Save previously focused element
    previousFocusRef.current = document.activeElement as HTMLElement | null;

    const drawer = drawerRef.current;
    if (!drawer) return;

    // Focus the first focusable element inside the drawer
    const focusableSelector =
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

    const firstFocusable = drawer.querySelector<HTMLElement>(focusableSelector);
    firstFocusable?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        closeAccountMenu();
        return;
      }

      if (e.key !== "Tab") return;

      const focusables = drawer!.querySelectorAll<HTMLElement>(focusableSelector);
      if (focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      // Restore focus when drawer closes
      previousFocusRef.current?.focus();
    };
  }, [accountMenuOpen, closeAccountMenu]);

  if (!accountMenuOpen) return null;

  return (
    <>
      <div
        className={`account-drawer-overlay ${accountMenuVisible ? "open" : "closing"}`}
        onClick={closeAccountMenu}
        aria-hidden="true"
      />
      <aside
        ref={drawerRef}
        className={`account-drawer ${accountMenuVisible ? "open" : "closing"}`}
        role="dialog"
        aria-modal="true"
        aria-label={t("profile")}
      >
        <div className="account-drawer-header">
          <strong>{user?.fullName}</strong>
          <button type="button" onClick={closeAccountMenu}>
            {t("close")}
          </button>
        </div>
        <div className="account-drawer-actions">
          {showAdminTools && (
            <button
              type="button"
              title={t("settings")}
              onClick={() =>
                guardUnsavedChanges(() => {
                  setShowFunctionHub(false);
                  setShowProfilePage(false);
                  setAdminTab("settings");
                  closeAccountMenu();
                })
              }
            >
              <Printer size={14} /> {t("settings")}
            </button>
          )}
          <button
            type="button"
            title={t("profile")}
            onClick={() => {
              setShowProfilePage((prev) => !prev);
              closeAccountMenu();
            }}
          >
            <UserCircle size={14} /> {t("profile")}
          </button>
          <button
            type="button"
            title={t("language")}
            onClick={() => {
              void changeLanguage(currentLang === "de" ? "en" : "de");
              closeAccountMenu();
            }}
          >
            <Languages size={14} /> {currentLang.toUpperCase()}
          </button>
          <button
            type="button"
            title={t("logout")}
            onClick={() => {
              logout();
            }}
          >
            <LogOut size={14} /> {t("logout")}
          </button>
        </div>
      </aside>
    </>
  );
}
