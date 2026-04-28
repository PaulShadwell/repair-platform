import { useTranslation } from "react-i18next";
import {
  Home,
  Plus,
  ClipboardList,
  Users,
  HelpCircle,
  BarChart3,
  MoreHorizontal,
  List,
} from "lucide-react";
import { useAppContext } from "../context/AppContext";

interface NavItem {
  key: string;
  label: string;
  icon: React.ReactNode;
  action: () => void;
  isActive: boolean;
}

export function MobileNav() {
  const { t } = useTranslation();
  const ctx = useAppContext();
  const {
    isMobile,
    user,
    adminTab,
    showFunctionHub,
    setShowFunctionHub,
    setAdminTab,
    setMobileMenuOpen,
    mobileMenuOpen,
  } = ctx;

  if (!isMobile || !user) return null;

  const isRepairer =
    user.roles.includes("REPAIRER") &&
    !user.roles.includes("ADMIN") &&
    !user.roles.includes("SUPERVISOR") &&
    !user.roles.includes("POS_USER");

  const isPosOnly =
    user.roles.includes("POS_USER") &&
    !user.roles.includes("ADMIN") &&
    !user.roles.includes("SUPERVISOR");

  // Determine if we're on the "home" / function hub view
  const isHome = showFunctionHub && adminTab === "none";
  const isRepairList = !showFunctionHub && adminTab === "none";

  function goHome() {
    setAdminTab("none");
    setShowFunctionHub(true);
  }

  function goRepairs() {
    setAdminTab("none");
    setShowFunctionHub(false);
  }

  function goAddRepair() {
    setShowFunctionHub(false);
    setAdminTab("addRepair");
  }

  function goCustomers() {
    setShowFunctionHub(false);
    setAdminTab("customers");
  }

  function goDashboard() {
    setShowFunctionHub(false);
    setAdminTab("dashboard");
  }

  function goHelp() {
    setShowFunctionHub(false);
    setAdminTab("help");
  }

  function toggleMore() {
    setMobileMenuOpen(!mobileMenuOpen);
  }

  let items: NavItem[];

  if (isRepairer) {
    items = [
      {
        key: "repairs",
        label: t("myRepairs", "My Repairs"),
        icon: <ClipboardList />,
        action: goRepairs,
        isActive: isRepairList,
      },
      {
        key: "help",
        label: t("help", "Help"),
        icon: <HelpCircle />,
        action: goHelp,
        isActive: adminTab === "help",
      },
    ];
  } else if (isPosOnly) {
    items = [
      {
        key: "home",
        label: t("home", "Home"),
        icon: <Home />,
        action: goHome,
        isActive: isHome,
      },
      {
        key: "addRepair",
        label: t("addRepair", "Add Repair"),
        icon: <Plus />,
        action: goAddRepair,
        isActive: adminTab === "addRepair",
      },
      {
        key: "repairs",
        label: t("allRepairs", "All Repairs"),
        icon: <List />,
        action: goRepairs,
        isActive: isRepairList,
      },
      {
        key: "customers",
        label: t("customers", "Customers"),
        icon: <Users />,
        action: goCustomers,
        isActive: adminTab === "customers",
      },
      {
        key: "help",
        label: t("help", "Help"),
        icon: <HelpCircle />,
        action: goHelp,
        isActive: adminTab === "help",
      },
    ];
  } else {
    // ADMIN or SUPERVISOR
    items = [
      {
        key: "home",
        label: t("home", "Home"),
        icon: <Home />,
        action: goHome,
        isActive: isHome,
      },
      {
        key: "addRepair",
        label: t("addRepair", "Add Repair"),
        icon: <Plus />,
        action: goAddRepair,
        isActive: adminTab === "addRepair",
      },
      {
        key: "repairs",
        label: t("allRepairs", "All Repairs"),
        icon: <List />,
        action: goRepairs,
        isActive: isRepairList,
      },
      {
        key: "dashboard",
        label: t("dashboard", "Dashboard"),
        icon: <BarChart3 />,
        action: goDashboard,
        isActive: adminTab === "dashboard",
      },
      {
        key: "more",
        label: t("more", "More"),
        icon: <MoreHorizontal />,
        action: toggleMore,
        isActive: mobileMenuOpen,
      },
    ];
  }

  return (
    <nav className="mobile-bottom-nav" aria-label={t("mobileNavigation", "Navigation")}>
      {items.map((item) => (
        <button
          key={item.key}
          className={`mobile-nav-item${item.isActive ? " active" : ""}`}
          onClick={item.action}
          aria-current={item.isActive ? "page" : undefined}
        >
          {item.icon}
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
