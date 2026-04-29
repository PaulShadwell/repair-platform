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
  ArrowLeft,
  Pencil,
  Printer,
  Save,
  X,
  UserPlus,
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
    loadRepairs,
    searchText,
    sort,
    scope,
    mobileView,
    setMobileView,
    selectedRepair,
    isEditingRepairWork,
    setIsEditingRepairWork,
    isEditingRepairIntake,
    setIsEditingRepairIntake,
    canEditRepairWork,
    canEditCustomerIntake,
    canPrintFromDetail,
    canAssignRepairs,
    busyActions,
    printLabel,
    saveRepairWork,
    saveRepairIntake,
    intakeHasUnsavedChanges,
    workHasUnsavedChanges,
  } = ctx;

  if (!isMobile || !user) return null;

  const isDetailView = mobileView === "detail" && selectedRepair != null;

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

  function goMyRepairs() {
    setAdminTab("none");
    setShowFunctionHub(false);
    void loadRepairs("my", searchText, 1, sort, "active", true, {});
  }

  function goAllRepairs() {
    setAdminTab("none");
    setShowFunctionHub(false);
    void loadRepairs("all", searchText, 1, sort, "active", true, {});
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
        action: goMyRepairs,
        isActive: isRepairList && scope === "my",
      },
      {
        key: "allRepairs",
        label: t("allRepairs", "All Repairs"),
        icon: <List />,
        action: goAllRepairs,
        isActive: isRepairList && scope === "all",
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
        action: goAllRepairs,
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
        action: goAllRepairs,
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

  // ── Contextual repair detail nav ──
  if (isDetailView) {
    const isEditing = isEditingRepairIntake || isEditingRepairWork;
    const hasChanges = intakeHasUnsavedChanges || workHasUnsavedChanges;

    const detailItems: NavItem[] = [
      {
        key: "back",
        label: t("backToList", "Back"),
        icon: <ArrowLeft />,
        action: () => setMobileView("list"),
        isActive: false,
      },
    ];

    if (isEditing) {
      // Show save/cancel when editing
      detailItems.push({
        key: "save",
        label: t("save", "Save"),
        icon: <Save />,
        action: () => {
          if (isEditingRepairIntake) void saveRepairIntake(selectedRepair!.id);
          if (isEditingRepairWork) void saveRepairWork(selectedRepair!.id);
        },
        isActive: hasChanges,
      });
      detailItems.push({
        key: "cancel",
        label: t("cancel", "Cancel"),
        icon: <X />,
        action: () => {
          setIsEditingRepairIntake(false);
          setIsEditingRepairWork(false);
        },
        isActive: false,
      });
    } else {
      // Show edit / assign / print actions
      const canEditWork = canEditRepairWork(selectedRepair!);
      if (canEditCustomerIntake || canEditWork) {
        detailItems.push({
          key: "edit",
          label: t("edit", "Edit"),
          icon: <Pencil />,
          action: () => {
            if (canEditWork) setIsEditingRepairWork(true);
            else if (canEditCustomerIntake) setIsEditingRepairIntake(true);
          },
          isActive: false,
        });
      }
      if (canAssignRepairs) {
        detailItems.push({
          key: "assign",
          label: t("assign", "Assign"),
          icon: <UserPlus />,
          action: () => {
            // Scroll to the assign dropdown in the detail header
            document.querySelector(".detail-assign-select")?.scrollIntoView({ behavior: "smooth" });
            (document.querySelector(".detail-assign-select") as HTMLSelectElement)?.focus();
          },
          isActive: false,
        });
      }
      if (canPrintFromDetail) {
        detailItems.push({
          key: "print",
          label: busyActions.printLabel ? t("printing", "Printing…") : t("printLabel", "Print"),
          icon: <Printer />,
          action: () => void printLabel(selectedRepair!.id),
          isActive: false,
        });
      }
    }

    return (
      <nav className="mobile-bottom-nav mobile-detail-actions" aria-label={t("repairActions", "Repair Actions")}>
        {detailItems.map((item) => (
          <button
            key={item.key}
            className={`mobile-nav-item${item.isActive ? " active" : ""}`}
            onClick={item.action}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    );
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
