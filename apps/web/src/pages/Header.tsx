import { useTranslation } from "react-i18next";
import {
  Home,
  Menu,
  X,
  FileDown,
  Package,
  HelpCircle,
  UserCircle,
} from "lucide-react";
import { useAppContext } from "../context/AppContext";
import { AccountDrawer } from "./AccountDrawer";

// ---------------------------------------------------------------------------
// Helper: determine the "active" key for aria-current
// ---------------------------------------------------------------------------
function getActiveKey(
  adminTab: string,
  showFunctionHub: boolean,
  viewMode: string,
  scope: string,
): string {
  if (showFunctionHub) return "home";
  if (adminTab !== "none") return adminTab;
  if (viewMode === "archived") return "archived";
  return scope; // "my" | "all"
}

export function Header() {
  const {
    // Branding
    brandLogoSrc,
    brandAppName,
    // User
    user,
    profileAvatarUrl,
    // Menu / drawer
    toggleAccountMenu,
    // Mobile
    isMobile,
    mobileMenuOpen,
    setMobileMenuOpen,
    closeMobileMenu,
    // Tabs
    adminTab,
    setAdminTab,
    showFunctionHub,
    setShowFunctionHub,
    viewMode,
    scope,
    searchText,
    sort,
    // Permissions
    isAdmin,
    isSupervisor,
    canCreateRepair,
    canManageUsers,
    canViewArchivedItems,
    canUseFunctionHub,
    // Actions
    guardUnsavedChanges,
    loadRepairs,
    setShowCsvExportDialog,
    busyActions,
  } = useAppContext();

  const { t } = useTranslation();

  const activeKey = getActiveKey(adminTab, showFunctionHub, viewMode, scope);
  const mobileMenuId = "mobile-nav-menu";

  // Build the list of navigation items based on role / permissions
  type NavItem = {
    key: string;
    label: string;
    icon?: React.ReactNode;
    visible: boolean;
    isActive: boolean;
    disabled?: boolean;
    onClick: () => void;
  };

  const navItems: NavItem[] = [
    // Home (Function Hub)
    {
      key: "home",
      label: t("home"),
      icon: <Home size={14} />,
      visible: canUseFunctionHub,
      isActive: activeKey === "home",
      onClick: () =>
        guardUnsavedChanges(() => {
          setAdminTab("none");
          setShowFunctionHub(true);
          closeMobileMenu();
        }),
    },
    // My Repairs (visible to all roles)
    {
      key: "my",
      label: t("myRepairs"),
      visible: true,
      isActive: activeKey === "my",
      onClick: () =>
        guardUnsavedChanges(() => {
          setAdminTab("none");
          setShowFunctionHub(false);
          void loadRepairs("my", searchText, 1, sort, "active", true, {});
          closeMobileMenu();
        }),
    },
    // All Repairs (everyone except pure REPAIRER without extra permissions)
    {
      key: "all",
      label: t("allRepairs"),
      visible: true,
      isActive: activeKey === "all",
      onClick: () =>
        guardUnsavedChanges(() => {
          setAdminTab("none");
          setShowFunctionHub(false);
          void loadRepairs("all", searchText, 1, sort, "active", true, {});
          closeMobileMenu();
        }),
    },
    // Archived Items (repairers see their own; others see all)
    {
      key: "archived",
      label: t("archivedItems"),
      visible: canViewArchivedItems,
      isActive: activeKey === "archived",
      onClick: () =>
        guardUnsavedChanges(() => {
          setAdminTab("none");
          setShowFunctionHub(false);
          void loadRepairs(canCreateRepair ? "all" : "my", searchText, 1, sort, "archived", true, {});
          closeMobileMenu();
        }),
    },
    // Dashboard (Admin only)
    {
      key: "dashboard",
      label: t("adminDashboard"),
      visible: isAdmin,
      isActive: activeKey === "dashboard",
      onClick: () =>
        guardUnsavedChanges(() => {
          setShowFunctionHub(false);
          setAdminTab("dashboard");
          closeMobileMenu();
        }),
    },
    // Add Repair
    {
      key: "addRepair",
      label: t("adminAddRepair"),
      visible: canCreateRepair,
      isActive: activeKey === "addRepair",
      onClick: () =>
        guardUnsavedChanges(() => {
          setShowFunctionHub(false);
          setAdminTab("addRepair");
          closeMobileMenu();
        }),
    },
    // Manage Users
    {
      key: "manageRepairers",
      label: t("manageUsers"),
      visible: canManageUsers,
      isActive: activeKey === "manageRepairers" || activeKey === "addRepairer",
      onClick: () =>
        guardUnsavedChanges(() => {
          setShowFunctionHub(false);
          setAdminTab("manageRepairers");
          closeMobileMenu();
        }),
    },
    // Customers
    {
      key: "customers",
      label: t("adminCustomers"),
      visible: canCreateRepair,
      isActive: activeKey === "customers",
      onClick: () =>
        guardUnsavedChanges(() => {
          setShowFunctionHub(false);
          setAdminTab("customers");
          closeMobileMenu();
        }),
    },
    // Inventory (Admin only)
    {
      key: "inventory",
      label: t("inventorySection"),
      icon: <Package size={14} />,
      visible: isAdmin,
      isActive: activeKey === "inventory",
      onClick: () =>
        guardUnsavedChanges(() => {
          setShowFunctionHub(false);
          setAdminTab("inventory");
          closeMobileMenu();
        }),
    },
    // Suppliers (Admin only)
    {
      key: "suppliers",
      label: t("suppliersSection"),
      visible: isAdmin,
      isActive: activeKey === "suppliers",
      onClick: () =>
        guardUnsavedChanges(() => {
          setShowFunctionHub(false);
          setAdminTab("suppliers");
          closeMobileMenu();
        }),
    },
    // Export CSV (Admin only)
    {
      key: "exportCsv",
      label: busyActions.exportCsv ? t("loadingExportCsv") : t("exportCsv"),
      icon: <FileDown size={14} />,
      visible: isAdmin,
      isActive: false,
      disabled: busyActions.exportCsv,
      onClick: () => setShowCsvExportDialog(true),
    },
    // Analytics (Admin / Supervisor)
    {
      key: "analytics",
      label: t("analyticsSection"),
      visible: isAdmin || isSupervisor,
      isActive: activeKey === "analytics",
      onClick: () =>
        guardUnsavedChanges(() => {
          setShowFunctionHub(false);
          setAdminTab("analytics");
          closeMobileMenu();
        }),
    },
    // Feedback (visible to all roles)
    {
      key: "feedback",
      label: t("feedbackSection"),
      visible: true,
      isActive: activeKey === "feedback",
      onClick: () =>
        guardUnsavedChanges(() => {
          setShowFunctionHub(false);
          setAdminTab("feedback");
          closeMobileMenu();
        }),
    },
    // Help (visible to all roles)
    {
      key: "help",
      label: t("helpButton"),
      icon: <HelpCircle size={14} />,
      visible: true,
      isActive: activeKey === "help",
      onClick: () =>
        guardUnsavedChanges(() => {
          setShowFunctionHub(false);
          setAdminTab("help");
          closeMobileMenu();
        }),
    },
  ];

  const visibleNavItems = navItems.filter((item) => item.visible);

  return (
    <header className="header">
      <div className="header-top">
        {/* Brand */}
        <div className="header-brand">
          <img className="header-brand-logo" src={brandLogoSrc} alt="" />
          <h1>{brandAppName}</h1>
        </div>

        {/* User avatar / account menu trigger */}
        <button
          type="button"
          className="header-user-trigger"
          onClick={toggleAccountMenu}
          title={t("profile")}
        >
          <div className="header-user-block">
            <div className="header-user-avatar">
              {profileAvatarUrl ? (
                <img src={profileAvatarUrl} alt={t("profileAvatarAlt")} />
              ) : (
                <UserCircle size={30} />
              )}
            </div>
            <div className="header-user-meta">
              <p>{user?.fullName}</p>
              <small>({user?.username})</small>
            </div>
          </div>
        </button>

        {/* Account drawer (extracted component) */}
        <AccountDrawer />
      </div>

      {/* Mobile hamburger */}
      {isMobile && (
        <button
          className="mobile-menu-toggle"
          title={mobileMenuOpen ? t("close") : t("menu")}
          onClick={() => setMobileMenuOpen((prev) => !prev)}
          aria-expanded={mobileMenuOpen}
          aria-controls={mobileMenuId}
        >
          {mobileMenuOpen ? <X size={16} /> : <Menu size={16} />}
        </button>
      )}

      {/* Navigation tabs */}
      {(!showFunctionHub || !canUseFunctionHub) && (
        <nav
          id={mobileMenuId}
          className={`header-actions ${isMobile ? "mobile-actions" : ""} ${mobileMenuOpen ? "open" : ""}`}
          role="navigation"
          aria-label={t("mainNavigation") ?? "Main navigation"}
        >
          {visibleNavItems.map((item) => (
            <button
              key={item.key}
              className={item.isActive ? "active" : ""}
              title={item.label}
              disabled={item.disabled}
              onClick={item.onClick}
              aria-current={item.isActive ? "page" : undefined}
            >
              {item.icon} {item.label}
            </button>
          ))}
        </nav>
      )}
    </header>
  );
}
