import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { Languages, Search, LogOut, Printer, Plus, Trash2, ArrowLeft, Menu, X, UserCircle, Pencil, Eye, EyeOff, Home, FileDown, FileText, Save, Power, KeyRound } from "lucide-react";
import "./App.css";
import { api, setApiToken, setUnauthorizedHandler } from "./api";
import type {
  Assignee,
  DashboardMetrics,
  PrinterProfile,
  Repair,
  RepairChangeHistoryEntry,
  RepairerAdmin,
  RepairsPagination,
  RepairsSort,
  UserRoleKey,
  User,
  UserProfile,
} from "./types";
import { ThermalLabelPreview } from "./components/ThermalLabelPreview";

const ROLE_OPTIONS: UserRoleKey[] = ["ADMIN", "SUPERVISOR", "POS_USER", "REPAIRER"];
const ARTICLE_TYPE_OPTIONS = [
  "Assortment",
  "Textile",
  "Electronics",
  "Electrical",
  "Wood",
  "Other",
] as const;
const DEFAULT_LOGO_SRC = "/repair-kafi-logo-v3.png";
const DEFAULT_APP_NAME = "Repair Platform";

function dateInputTodayLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

type BusyAction =
  | "createRepair"
  | "createUser"
  | "saveRoles"
  | "saveRepairIntake"
  | "saveRepairWork"
  | "printLabel"
  | "deleteRepair"
  | "generatePairCode"
  | "saveProfile"
  | "changePassword"
  | "exportCsv";

function App() {
  const [adminTab, setAdminTab] = useState<"none" | "dashboard" | "addRepair" | "addRepairer" | "manageRepairers" | "customers" | "settings">(
    "none",
  );
  const { t, i18n } = useTranslation();
  const [leftPaneWidth, setLeftPaneWidth] = useState<number>(() => {
    const saved = localStorage.getItem("rp_left_pane_width");
    const parsed = saved ? Number(saved) : NaN;
    return Number.isFinite(parsed) ? parsed : 460;
  });
  const [isMobile, setIsMobile] = useState<boolean>(() => window.innerWidth <= 900);
  const [mobileView, setMobileView] = useState<"list" | "detail">("list");
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState<boolean>(false);
  const [accountMenuVisible, setAccountMenuVisible] = useState<boolean>(false);
  const accountMenuCloseTimeoutRef = useRef<number | null>(null);
  const [isResizing, setIsResizing] = useState<boolean>(false);
  const [token, setToken] = useState<string | null>(localStorage.getItem("rp_token"));
  const [user, setUser] = useState<User | null>(null);
  const [showFunctionHub, setShowFunctionHub] = useState<boolean>(false);
  const [showForgotPassword, setShowForgotPassword] = useState<boolean>(false);
  const [forgotPasswordStep, setForgotPasswordStep] = useState<"request" | "reset">("request");
  const [forgotPasswordForm, setForgotPasswordForm] = useState({
    username: "",
    resetToken: "",
    newPassword: "",
    confirmNewPassword: "",
  });
  const [repairs, setRepairs] = useState<Repair[]>([]);
  const [scope, setScope] = useState<"my" | "all">("my");
  const [viewMode, setViewMode] = useState<"active" | "archived">("active");
  const [listFilters, setListFilters] = useState<{ status?: string; notified?: boolean }>({});
  const [searchText, setSearchText] = useState<string>("");
  const [sort, setSort] = useState<RepairsSort>({ sortBy: "updatedAt", sortDir: "desc" });
  const [pagination, setPagination] = useState<RepairsPagination>({
    page: 1,
    pageSize: 25,
    total: 0,
    totalPages: 1,
  });
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [printerProfiles, setPrinterProfiles] = useState<PrinterProfile[]>([]);
  const [selectedPrinterProfileId, setSelectedPrinterProfileId] = useState<string>(
    () => localStorage.getItem("rp_printer_profile_id") ?? "",
  );
  const [latestPairingCode, setLatestPairingCode] = useState<string>("");
  const [repairers, setRepairers] = useState<RepairerAdmin[]>([]);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [selectedRepairId, setSelectedRepairId] = useState<string | null>(null);
  const [message, setMessage] = useState<string>("");
  const [messageType, setMessageType] = useState<"success" | "error" | "info">("success");
  const [showProfilePage, setShowProfilePage] = useState<boolean>(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileAvatarUrl, setProfileAvatarUrl] = useState<string>("");
  const [profileForm, setProfileForm] = useState({
    fullName: "",
    recoveryEmail: "",
    profilePhone: "",
    profileLocation: "",
    aboutMe: "",
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmNewPassword: "",
  });
  const [showPasswordFields, setShowPasswordFields] = useState({
    currentPassword: false,
    newPassword: false,
    confirmNewPassword: false,
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [photoPreviewUrls, setPhotoPreviewUrls] = useState<Record<string, string>>({});
  const [repairWorkForm, setRepairWorkForm] = useState({
    status: "IN_PROGRESS" as "IN_PROGRESS" | "WAITING_PARTS" | "NOTIFY_CUSTOMER" | "READY_FOR_PICKUP" | "COMPLETED" | "CANCELLED",
    outcome: "" as "" | "YES" | "PARTIAL" | "NO",
    successful: null as boolean | null,
    fixDescription: "",
    material: "",
    safetyTested: null as boolean | null,
    technicianNotes: "",
  });
  const [repairIntakeForm, setRepairIntakeForm] = useState({
    productType: "",
    createdDate: "",
    firstName: "",
    lastName: "",
    streetAddress: "",
    city: "",
    email: "",
    phone: "",
    itemName: "",
    problemDescription: "",
  });
  const [isEditingRepairIntake, setIsEditingRepairIntake] = useState<boolean>(false);
  const [isEditingRepairWork, setIsEditingRepairWork] = useState<boolean>(false);
  const [translatedContent, setTranslatedContent] = useState<{
    itemName: string;
    problemDescription: string;
    fixDescription: string;
    technicianNotes: string;
  } | null>(null);
  const [newRepair, setNewRepair] = useState(() => ({
    productType: "",
    createdDate: dateInputTodayLocal(),
    firstName: "",
    lastName: "",
    city: "",
    streetAddress: "",
    email: "",
    phone: "",
    itemName: "",
    problemDescription: "",
    assignedToUserId: "",
    customerId: "",
  }));
  const [newRepairer, setNewRepairer] = useState({
    username: "",
    fullName: "",
    password: "",
    role: "REPAIRER" as UserRoleKey,
  });
  const [roleDrafts, setRoleDrafts] = useState<Record<string, UserRoleKey[]>>({});
  const [showThermalPreview, setShowThermalPreview] = useState<boolean>(false);
  const [expandedDetailFields, setExpandedDetailFields] = useState<Record<string, boolean>>({});
  const [customerHistoryMatches, setCustomerHistoryMatches] = useState<Repair[]>([]);
  const [isLoadingCustomerHistory, setIsLoadingCustomerHistory] = useState<boolean>(false);
  const [hasQueriedCustomerHistory, setHasQueriedCustomerHistory] = useState<boolean>(false);
  const [repairChangeHistory, setRepairChangeHistory] = useState<RepairChangeHistoryEntry[]>([]);
  const [isLoadingRepairHistory, setIsLoadingRepairHistory] = useState<boolean>(false);
  type CustomerListItem = {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    phone: string | null;
    streetAddress: string | null;
    city: string | null;
    repairs: Array<{
      id: string;
      publicRef: string;
      repairNumber: number | null;
      status: string;
      itemName: string | null;
      createdDate: string | null;
      notified: boolean | null;
    }>;
  };
  const [customerList, setCustomerList] = useState<CustomerListItem[]>([]);
  const [customerListTotal, setCustomerListTotal] = useState<number>(0);
  const [customerListPage, setCustomerListPage] = useState<number>(1);
  const [customerListSearch, setCustomerListSearch] = useState<string>("");
  const [isLoadingCustomerList, setIsLoadingCustomerList] = useState<boolean>(false);
  const [expandedCustomerId, setExpandedCustomerId] = useState<string | null>(null);
  const [customerMergeSelection, setCustomerMergeSelection] = useState<Set<string>>(new Set());
  const [isMergingCustomers, setIsMergingCustomers] = useState<boolean>(false);
  const [brandAppName, setBrandAppName] = useState<string>(DEFAULT_APP_NAME);
  const [brandLogoSrc, setBrandLogoSrc] = useState<string>(DEFAULT_LOGO_SRC);
  const [brandingDraft, setBrandingDraft] = useState({ appName: "" });
  const [brandLogoFile, setBrandLogoFile] = useState<File | null>(null);
  const [busyActions, setBusyActions] = useState<Record<BusyAction, boolean>>({
    createRepair: false,
    createUser: false,
    saveRoles: false,
    saveRepairIntake: false,
    saveRepairWork: false,
    printLabel: false,
    deleteRepair: false,
    generatePairCode: false,
    saveProfile: false,
    changePassword: false,
    exportCsv: false,
  });

  const selectedRepair = useMemo(
    () => repairs.find((r) => r.id === selectedRepairId) ?? null,
    [repairs, selectedRepairId],
  );
  const isAdmin = Boolean(user?.roles.includes("ADMIN"));
  const isSupervisor = Boolean(user?.roles.includes("SUPERVISOR"));
  const canManageUsers = isAdmin || isSupervisor;
  const canEditCustomerIntake = isAdmin || isSupervisor;
  const canManagePrinters = Boolean(user?.roles.some((role) => role === "ADMIN" || role === "SUPERVISOR"));
  const canCreateRepair = Boolean(user?.roles.some((role) => role === "ADMIN" || role === "SUPERVISOR" || role === "POS_USER"));
  const canUseFunctionHub = canCreateRepair;
  const canViewArchivedItems = canCreateRepair;
  const canEditRepairFields = Boolean(user?.roles.some((role) => role === "ADMIN" || role === "SUPERVISOR" || role === "REPAIRER"));
  const canEditIntakeFields = canCreateRepair;
  const canEditOutcomeFields = canEditRepairFields;
  const canAssignRepairs = Boolean(user?.roles.some((role) => role === "ADMIN" || role === "SUPERVISOR" || role === "REPAIRER" || role === "POS_USER"));
  const canManagePhotos = canEditIntakeFields || canEditOutcomeFields;
  const canPrintFromDetail = canManagePhotos;
  const canToggleLabelSimulation = canManagePrinters;
  const showAdminTools = viewMode === "active";
  const mustChangePassword = Boolean(user?.mustChangePassword);
  const currentLang = i18n.language.startsWith("en") ? "en" : "de";
  const selectedPrinterProfile = useMemo(
    () => printerProfiles.find((profile) => profile.id === selectedPrinterProfileId) ?? null,
    [printerProfiles, selectedPrinterProfileId],
  );
  const canGeneratePairCode = Boolean(
    selectedPrinterProfileId && (selectedPrinterProfile?.canGeneratePairCode ?? canManagePrinters),
  );
  const hideRepairWorkspace = showFunctionHub || adminTab !== "none";
  const addRepairHasUnsavedChanges =
    adminTab === "addRepair" &&
    Object.values(newRepair).some((value) => String(value).trim().length > 0);
  const addUserHasUnsavedChanges =
    adminTab === "addRepairer" &&
    (newRepairer.username.trim().length > 0 ||
      newRepairer.fullName.trim().length > 0 ||
      newRepairer.password.trim().length > 0 ||
      newRepairer.role !== "REPAIRER");
  const profileHasUnsavedChanges = Boolean(
    showProfilePage &&
      profile &&
      (profileForm.fullName !== (profile.fullName ?? "") ||
        profileForm.recoveryEmail !== (profile.recoveryEmail ?? "") ||
        profileForm.profilePhone !== (profile.profilePhone ?? "") ||
        profileForm.profileLocation !== (profile.profileLocation ?? "") ||
        profileForm.aboutMe !== (profile.aboutMe ?? "")),
  );
  const intakeHasUnsavedChanges = Boolean(
    isEditingRepairIntake &&
      selectedRepair &&
      (repairIntakeForm.productType !== (selectedRepair.productType ?? "") ||
        repairIntakeForm.createdDate !== (selectedRepair.createdDate ? String(selectedRepair.createdDate).slice(0, 10) : "") ||
        repairIntakeForm.firstName !== (selectedRepair.firstName ?? "") ||
        repairIntakeForm.lastName !== (selectedRepair.lastName ?? "") ||
        repairIntakeForm.streetAddress !== (selectedRepair.streetAddress ?? "") ||
        repairIntakeForm.city !== (selectedRepair.city ?? "") ||
        repairIntakeForm.email !== (selectedRepair.email ?? "") ||
        repairIntakeForm.phone !== (selectedRepair.phone ?? "") ||
        repairIntakeForm.itemName !== (selectedRepair.itemName ?? "") ||
        repairIntakeForm.problemDescription !== (selectedRepair.problemDescription ?? "")),
  );
  const currentRepairStatusForForm =
    selectedRepair?.status === "READY_FOR_PICKUP" && !selectedRepair.notified
      ? "NOTIFY_CUSTOMER"
      : selectedRepair?.status === "NEW"
        ? "IN_PROGRESS"
        : selectedRepair?.status ?? "IN_PROGRESS";
  const workHasUnsavedChanges = Boolean(
    isEditingRepairWork &&
      selectedRepair &&
      (repairWorkForm.status !== currentRepairStatusForForm ||
        repairWorkForm.outcome !== (selectedRepair.outcome ?? "") ||
        repairWorkForm.successful !== (selectedRepair.successful ?? null) ||
        repairWorkForm.fixDescription !== (selectedRepair.fixDescription ?? "") ||
        repairWorkForm.material !== (selectedRepair.material ?? "") ||
        repairWorkForm.safetyTested !== (selectedRepair.safetyTested ?? null) ||
        repairWorkForm.technicianNotes !== (selectedRepair.technicianNotes ?? "")),
  );
  const hasUnsavedFormChanges =
    addRepairHasUnsavedChanges ||
    addUserHasUnsavedChanges ||
    profileHasUnsavedChanges ||
    intakeHasUnsavedChanges ||
    workHasUnsavedChanges;

  function onPrinterProfileChange(value: string): void {
    setSelectedPrinterProfileId(value);
    localStorage.setItem("rp_printer_profile_id", value);
    setLatestPairingCode("");
  }

  function isValidEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  function confirmDiscardUnsavedChanges(): boolean {
    if (!hasUnsavedFormChanges) return true;
    return window.confirm(t("unsavedChangesConfirm"));
  }

  function setBusy(action: BusyAction, value: boolean): void {
    setBusyActions((prev) => ({ ...prev, [action]: value }));
  }

  function showToast(text: string, type: "success" | "error" | "info" = "success"): void {
    setMessage(text);
    setMessageType(type);
  }

  function toggleDetailField(fieldKey: string): void {
    setExpandedDetailFields((prev) => ({ ...prev, [fieldKey]: !prev[fieldKey] }));
  }

  function getViewModeFromPath(): "active" | "archived" {
    const path = window.location.pathname.replace(/\/+$/, "");
    return path === "/archived" ? "archived" : "active";
  }

  useEffect(() => {
    return () => {
      if (accountMenuCloseTimeoutRef.current !== null) {
        window.clearTimeout(accountMenuCloseTimeoutRef.current);
        accountMenuCloseTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    api.get<Record<string, string>>("/branding").then((res) => {
      if (res.data.appName) setBrandAppName(res.data.appName);
      if (res.data.logoKey) setBrandLogoSrc(`${api.defaults.baseURL}/branding/logo?_=${Date.now()}`);
    }).catch(() => { /* keep defaults */ });
  }, []);

  useEffect(() => {
    setApiToken(token);
    if (token) {
      localStorage.setItem("rp_token", token);
      void loadMe();
      void loadProfile();
      const modeFromPath = getViewModeFromPath();
      const startScope = modeFromPath === "archived" ? "all" : scope;
      void loadRepairs(startScope, "", 1, sort, modeFromPath).then(() => void loadFromPublicRefPath());
      void loadAssignees();
      void loadPrinters();
    } else {
      localStorage.removeItem("rp_token");
      setUser(null);
      setShowFunctionHub(false);
      setRepairs([]);
      setMetrics(null);
      setRepairers([]);
      setPrinterProfiles([]);
      setProfile(null);
      setShowProfilePage(false);
      setAccountMenuOpen(false);
      setAccountMenuVisible(false);
      setPasswordForm({ currentPassword: "", newPassword: "", confirmNewPassword: "" });
      setShowPasswordFields({ currentPassword: false, newPassword: false, confirmNewPassword: false });
      setProfileForm({ fullName: "", recoveryEmail: "", profilePhone: "", profileLocation: "", aboutMe: "" });
      setProfileAvatarUrl((previousUrl) => {
        if (previousUrl) URL.revokeObjectURL(previousUrl);
        return "";
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (token) return;
    const url = new URL(window.location.href);
    const resetToken = (url.searchParams.get("resetToken") ?? "").trim();
    if (!resetToken) return;
    setShowForgotPassword(true);
    setForgotPasswordStep("reset");
    setForgotPasswordForm((prev) => ({ ...prev, resetToken }));
  }, [token]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setToken(null);
      showToast(t("sessionExpiredPleaseLogin"), "info");
    });
    return () => setUnauthorizedHandler(null);
  }, [t]);

  useEffect(() => {
    if (!token) return;
    const onPopState = () => {
      window.location.reload();
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [token]);

  useEffect(() => {
    if (isAdmin) {
      void loadMetrics();
    } else {
      setMetrics(null);
    }
    if (canManageUsers) {
      void loadRepairers();
    } else {
      setRepairers([]);
      setRoleDrafts({});
    }
  }, [isAdmin, canManageUsers]);

  useEffect(() => {
    if (!showAdminTools) return;
    if (adminTab === "dashboard" && !isAdmin) {
      setAdminTab("none");
      return;
    }
    if ((adminTab === "addRepairer" || adminTab === "manageRepairers") && !canManageUsers) {
      setAdminTab("none");
      return;
    }
    if (adminTab === "addRepair" && !canCreateRepair) {
      setAdminTab("none");
    }
    if (adminTab === "customers" && !isAdmin) {
      setAdminTab("none");
    }
    if (adminTab === "settings" && !showAdminTools) {
      setAdminTab("none");
    }
  }, [adminTab, canCreateRepair, canManageUsers, isAdmin, showAdminTools]);

  useEffect(() => {
    localStorage.setItem("rp_lang", currentLang);
  }, [currentLang]);

  useEffect(() => {
    return () => {
      Object.values(photoPreviewUrls).forEach((url) => URL.revokeObjectURL(url));
    };
  }, [photoPreviewUrls]);

  useEffect(() => {
    return () => {
      if (profileAvatarUrl) URL.revokeObjectURL(profileAvatarUrl);
    };
  }, [profileAvatarUrl]);

  useEffect(() => {
    if (!message) return;
    const timeoutMs = messageType === "error" ? 6000 : 4000;
    const timeoutId = window.setTimeout(() => {
      setMessage("");
    }, timeoutMs);
    return () => window.clearTimeout(timeoutId);
  }, [message, messageType]);

  useEffect(() => {
    if (!hasUnsavedFormChanges) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasUnsavedFormChanges]);

  useEffect(() => {
    if (!selectedRepair) {
      setPhotoPreviewUrls((prev) => {
        Object.values(prev).forEach((url) => URL.revokeObjectURL(url));
        return {};
      });
      setIsEditingRepairWork(false);
      return;
    }

    let cancelled = false;
    const currentRepair = selectedRepair;

    async function loadPreviews(): Promise<void> {
      const nextEntries = await Promise.all(
        currentRepair.photos.map(async (photo) => {
          try {
            const response = await api.get(
              `/repairs/${currentRepair.id}/photos/${photo.id}`,
              { responseType: "blob" },
            );
            return [photo.id, URL.createObjectURL(response.data as Blob)] as const;
          } catch {
            return [photo.id, ""] as const;
          }
        }),
      );

      if (cancelled) {
        nextEntries.forEach(([, url]) => {
          if (url) URL.revokeObjectURL(url);
        });
        return;
      }

      setPhotoPreviewUrls((prev) => {
        Object.values(prev).forEach((url) => URL.revokeObjectURL(url));
        return Object.fromEntries(nextEntries.filter(([, url]) => Boolean(url)));
      });
    }

    void loadPreviews();

    return () => {
      cancelled = true;
    };
  }, [selectedRepair]);

  useEffect(() => {
    const repairId = selectedRepair?.id;
    if (!repairId) {
      setRepairChangeHistory([]);
      return;
    }

    let cancelled = false;
    async function loadRepairHistory(): Promise<void> {
      setIsLoadingRepairHistory(true);
      try {
        const response = await api.get<{ history: RepairChangeHistoryEntry[] }>(`/repairs/${repairId}/history`);
        if (!cancelled) {
          setRepairChangeHistory(response.data.history);
        }
      } catch {
        if (!cancelled) {
          setRepairChangeHistory([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingRepairHistory(false);
        }
      }
    }

    void loadRepairHistory();
    return () => {
      cancelled = true;
    };
  }, [selectedRepair?.id]);

  useEffect(() => {
    if (adminTab !== "addRepair") {
      setCustomerHistoryMatches([]);
      setIsLoadingCustomerHistory(false);
      setHasQueriedCustomerHistory(false);
      return;
    }

    const firstName = newRepair.firstName.trim();
    const lastName = newRepair.lastName.trim();
    const email = newRepair.email.trim();
    const phone = newRepair.phone.trim();
    const hasLookupData = Boolean(
      email ||
        phone ||
        (firstName && lastName) ||
        firstName.length >= 2 ||
        lastName.length >= 2,
    );

    if (!hasLookupData) {
      setCustomerHistoryMatches([]);
      setIsLoadingCustomerHistory(false);
      setHasQueriedCustomerHistory(false);
      return;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(async () => {
      setIsLoadingCustomerHistory(true);
      try {
        const response = await api.get<{ repairs: Repair[] }>("/repairs/customer-history", {
          params: { firstName, lastName, email, phone },
        });
        if (!cancelled) {
          setCustomerHistoryMatches(response.data.repairs);
          setHasQueriedCustomerHistory(true);
        }
      } catch {
        if (!cancelled) {
          setCustomerHistoryMatches([]);
          setHasQueriedCustomerHistory(true);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingCustomerHistory(false);
        }
      }
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [adminTab, newRepair.firstName, newRepair.lastName, newRepair.email, newRepair.phone]);

  useEffect(() => {
    if (adminTab !== "customers") return;
    const timeoutId = window.setTimeout(() => {
      void loadCustomerList(customerListSearch, 1);
    }, customerListSearch ? 300 : 0);
    return () => window.clearTimeout(timeoutId);
  }, [adminTab, customerListSearch]);

  useEffect(() => {
    if (!selectedRepair) {
      setTranslatedContent(null);
      return;
    }
    if (currentLang !== "en") {
      setTranslatedContent(null);
      return;
    }

    const repairId = selectedRepair.id;
    let cancelled = false;
    async function loadTranslation(): Promise<void> {
      try {
        const response = await api.get<{
          translation: {
            itemName: string;
            problemDescription: string;
            fixDescription: string;
            technicianNotes: string;
          };
        }>(`/repairs/${repairId}/translation`, { params: { targetLang: "en" } });
        if (!cancelled) setTranslatedContent(response.data.translation);
      } catch {
        if (!cancelled) setTranslatedContent(null);
      }
    }
    void loadTranslation();
    return () => {
      cancelled = true;
    };
  }, [selectedRepair, currentLang]);

  useEffect(() => {
    if (!selectedRepair) {
      setRepairIntakeForm({
        productType: "",
        createdDate: "",
        firstName: "",
        lastName: "",
        streetAddress: "",
        city: "",
        email: "",
        phone: "",
        itemName: "",
        problemDescription: "",
      });
      setRepairWorkForm({
        status: "IN_PROGRESS",
        outcome: "",
        successful: null,
        fixDescription: "",
        material: "",
        safetyTested: null,
        technicianNotes: "",
      });
      return;
    }
    setRepairIntakeForm({
      productType: selectedRepair.productType ?? "",
      createdDate: selectedRepair.createdDate ? String(selectedRepair.createdDate).slice(0, 10) : "",
      firstName: selectedRepair.firstName ?? "",
      lastName: selectedRepair.lastName ?? "",
      streetAddress: selectedRepair.streetAddress ?? "",
      city: selectedRepair.city ?? "",
      email: selectedRepair.email ?? "",
      phone: selectedRepair.phone ?? "",
      itemName: selectedRepair.itemName ?? "",
      problemDescription: selectedRepair.problemDescription ?? "",
    });
    setRepairWorkForm({
      status:
        selectedRepair.status === "READY_FOR_PICKUP" && !selectedRepair.notified
          ? "NOTIFY_CUSTOMER"
          : selectedRepair.status === "NEW"
            ? "IN_PROGRESS"
            : (selectedRepair.status as "IN_PROGRESS" | "WAITING_PARTS" | "READY_FOR_PICKUP" | "NOTIFY_CUSTOMER" | "COMPLETED" | "CANCELLED"),
      outcome: selectedRepair.outcome ?? "",
      successful: selectedRepair.successful ?? null,
      fixDescription: selectedRepair.fixDescription ?? "",
      material: selectedRepair.material ?? "",
      safetyTested: selectedRepair.safetyTested ?? null,
      technicianNotes: selectedRepair.technicianNotes ?? "",
    });
    setIsEditingRepairIntake(false);
    setIsEditingRepairWork(false);
  }, [selectedRepair]);

  useEffect(() => {
    localStorage.setItem("rp_left_pane_width", String(leftPaneWidth));
  }, [leftPaneWidth]);

  useEffect(() => {
    const onResize = () => {
      const mobile = window.innerWidth <= 900;
      setIsMobile(mobile);
      if (!mobile) {
        setMobileView("list");
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (isMobile && mobileView === "detail" && !selectedRepairId) {
      setMobileView("list");
    }
  }, [isMobile, mobileView, selectedRepairId]);

  useEffect(() => {
    if (!isResizing) return;

    const onMouseMove = (event: MouseEvent) => {
      const minWidth = 360;
      const maxWidth = 700;
      const next = Math.max(minWidth, Math.min(maxWidth, event.clientX - 24));
      setLeftPaneWidth(next);
    };

    const onMouseUp = () => setIsResizing(false);

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [isResizing]);

  function getPublicRefFromPath(): string | null {
    const parts = window.location.pathname.split("/").filter(Boolean);
    if (parts.length === 2 && parts[0] === "repairs") {
      return decodeURIComponent(parts[1]);
    }
    return null;
  }

  async function loadFromPublicRefPath(): Promise<void> {
    const publicRef = getPublicRefFromPath();
    if (!publicRef) return;
    try {
      const response = await api.get<{ repair: Repair }>(`/repairs/by-ref/${publicRef}`);
      setRepairs((prev) => {
        if (prev.some((r) => r.id === response.data.repair.id)) return prev;
        return [response.data.repair, ...prev];
      });
      openRepairDetail(response.data.repair.id);
    } catch {
      setMessage(t("repairNotVisible", { ref: publicRef }));
    }
  }

  async function loadMe(): Promise<void> {
    const response = await api.get<{ user: User }>("/auth/me");
    setUser(response.data.user);
    if (response.data.user.mustChangePassword) {
      setShowProfilePage(true);
    }
    const hasHubRole = response.data.user.roles.some(
      (role) => role === "ADMIN" || role === "SUPERVISOR" || role === "POS_USER",
    );
    setShowFunctionHub(hasHubRole);
  }

  async function loadProfile(): Promise<void> {
    try {
      const response = await api.get<{ profile: UserProfile }>("/profile");
      const nextProfile = response.data.profile;
      setProfile(nextProfile);
      setProfileForm({
        fullName: nextProfile.fullName ?? "",
        recoveryEmail: nextProfile.recoveryEmail ?? "",
        profilePhone: nextProfile.profilePhone ?? "",
        profileLocation: nextProfile.profileLocation ?? "",
        aboutMe: nextProfile.aboutMe ?? "",
      });

      if (nextProfile.hasAvatar) {
        try {
          const avatarResponse = await api.get("/profile/avatar", { responseType: "blob" });
          const nextUrl = URL.createObjectURL(avatarResponse.data as Blob);
          setProfileAvatarUrl((previousUrl) => {
            if (previousUrl) URL.revokeObjectURL(previousUrl);
            return nextUrl;
          });
        } catch {
          setProfileAvatarUrl((previousUrl) => {
            if (previousUrl) URL.revokeObjectURL(previousUrl);
            return "";
          });
        }
      } else {
        setProfileAvatarUrl((previousUrl) => {
          if (previousUrl) URL.revokeObjectURL(previousUrl);
          return "";
        });
      }
    } catch {
      setProfile(null);
    }
  }

  async function loadRepairs(
    nextScope: "my" | "all",
    q: string,
    page: number,
    sortInput: RepairsSort,
    nextViewMode: "active" | "archived",
    syncUrl = false,
    nextFilters: { status?: string; notified?: boolean } = listFilters,
    skipUnsavedChangesGuard = false,
  ): Promise<void> {
    if (!skipUnsavedChangesGuard && !confirmDiscardUnsavedChanges()) {
      return;
    }
    setIsLoading(true);
    try {
      const response = await api.get<{
        repairs: Repair[];
        pagination: RepairsPagination;
        sort: RepairsSort;
      }>("/repairs", {
        params: {
          scope: nextScope,
          q: q || undefined,
          page,
          pageSize: pagination.pageSize,
          sortBy: sortInput.sortBy,
          sortDir: sortInput.sortDir,
          archived: nextViewMode === "archived",
          status: nextFilters.status || undefined,
          notified: nextFilters.notified !== undefined ? String(nextFilters.notified) : undefined,
        },
      });
      setRepairs(response.data.repairs);
      setScope(nextScope);
      setSearchText(q);
      setListFilters(nextFilters);
      setSort(response.data.sort);
      setViewMode(nextViewMode);
      setPagination(response.data.pagination);
      setSelectedRepairId((prev) =>
        prev && response.data.repairs.some((r) => r.id === prev)
          ? prev
          : response.data.repairs[0]?.id ?? null,
      );
      if (syncUrl) {
        const nextPath = nextViewMode === "archived" ? "/archived" : "/";
        if (window.location.pathname !== nextPath) {
          window.history.pushState({}, "", nextPath);
        }
      }
    } catch {
      if (nextViewMode === "archived") {
        setMessage(t("archivedViewAdminOnly"));
        await loadRepairs("all", q, page, sortInput, "active", true, nextFilters, true);
      } else {
        setMessage(t("failedLoadRepairs"));
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function loadAssignees(): Promise<void> {
    try {
      const response = await api.get<{ users: Assignee[] }>("/users");
      setAssignees(response.data.users);
    } catch {
      setAssignees([]);
    }
  }

  async function loadPrinters(): Promise<void> {
    try {
      const response = await api.get<{ printers: PrinterProfile[] }>("/printers");
      setPrinterProfiles(response.data.printers);
      if (
        selectedPrinterProfileId &&
        !response.data.printers.some((profile) => profile.id === selectedPrinterProfileId)
      ) {
        setSelectedPrinterProfileId("");
        localStorage.removeItem("rp_printer_profile_id");
        setLatestPairingCode("");
        return;
      }
      if (!selectedPrinterProfileId && response.data.printers.length === 1) {
        onPrinterProfileChange(response.data.printers[0].id);
      }
    } catch {
      setPrinterProfiles([]);
    }
  }

  async function generatePairingCode(printerProfileId: string): Promise<void> {
    setBusy("generatePairCode", true);
    try {
      const response = await api.post<{
        pairingCode: string;
        expiresAt: string;
        printerName: string;
      }>(`/printers/${printerProfileId}/pair-code`);
      setLatestPairingCode(response.data.pairingCode);
      showToast(t("pairingCodeMessage", {
        printer: response.data.printerName,
        code: response.data.pairingCode,
        expires: formatDisplayDateTime(response.data.expiresAt),
      }));
    } catch (error: unknown) {
      const maybeMessage =
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        typeof (error as { response?: { data?: { message?: unknown } } }).response?.data?.message === "string"
          ? ((error as { response: { data: { message: string } } }).response.data.message)
          : t("failedGeneratePairingCode");
      showToast(maybeMessage, "error");
    } finally {
      setBusy("generatePairCode", false);
    }
  }

  async function loadMetrics(): Promise<void> {
    try {
      const response = await api.get<{ metrics: DashboardMetrics }>("/dashboard/metrics");
      setMetrics(response.data.metrics);
    } catch {
      setMetrics(null);
    }
  }

  async function loadRepairers(): Promise<void> {
    try {
      const response = await api.get<{ users: RepairerAdmin[] }>("/users/repairers");
      setRepairers(response.data.users);
      setRoleDrafts(
        Object.fromEntries(
          response.data.users.map((u) => [u.id, u.roles]),
        ),
      );
    } catch {
      setRepairers([]);
      setRoleDrafts({});
    }
  }

  async function login(formData: FormData): Promise<void> {
    const username = String(formData.get("username") ?? "");
    const password = String(formData.get("password") ?? "");
    try {
      const response = await api.post<{ token: string; user: User }>("/auth/login", { username, password });
      setToken(response.data.token);
      setUser(response.data.user);
      if (response.data.user.mustChangePassword) {
        setShowProfilePage(true);
      }
      const hasHubRole = response.data.user.roles.some(
        (role) => role === "ADMIN" || role === "SUPERVISOR" || role === "POS_USER",
      );
      setShowFunctionHub(hasHubRole);
      setMessage("");
    } catch {
      setMessage(t("loginFailed"));
    }
  }

  async function requestPasswordReset(): Promise<void> {
    if (!forgotPasswordForm.username.trim()) {
      showToast(t("usernameRequired"), "error");
      return;
    }
    try {
      await api.post("/auth/forgot-password", {
        username: forgotPasswordForm.username.trim(),
      });
      showToast(t("forgotPasswordRequestSent"), "info");
      setForgotPasswordStep("reset");
    } catch (error: unknown) {
      const maybeMessage =
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        typeof (error as { response?: { data?: { message?: unknown } } }).response?.data?.message === "string"
          ? ((error as { response: { data: { message: string } } }).response.data.message)
          : t("forgotPasswordFailed");
      showToast(maybeMessage, "error");
    }
  }

  async function resetPasswordWithToken(): Promise<void> {
    if (forgotPasswordForm.newPassword !== forgotPasswordForm.confirmNewPassword) {
      showToast(t("profilePasswordMismatch"), "error");
      return;
    }
    try {
      await api.post("/auth/reset-password", {
        token: forgotPasswordForm.resetToken,
        newPassword: forgotPasswordForm.newPassword,
      });
      setForgotPasswordForm({
        username: "",
        resetToken: "",
        newPassword: "",
        confirmNewPassword: "",
      });
      showToast(t("forgotPasswordSubmitted"), "info");
      setShowForgotPassword(false);
      setForgotPasswordStep("request");
      const url = new URL(window.location.href);
      if (url.searchParams.has("resetToken")) {
        url.searchParams.delete("resetToken");
        window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
      }
    } catch (error: unknown) {
      const maybeMessage =
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        typeof (error as { response?: { data?: { message?: unknown } } }).response?.data?.message === "string"
          ? ((error as { response: { data: { message: string } } }).response.data.message)
          : t("forgotPasswordFailed");
      showToast(maybeMessage, "error");
    }
  }

  async function updateAssignment(repairId: string, assignedToUserId: string): Promise<void> {
    await api.patch(`/repairs/${repairId}`, { assignedToUserId: assignedToUserId || null });
    await loadRepairs(scope, searchText, pagination.page, sort, viewMode, false, listFilters, true);
    if (isAdmin) void loadMetrics();
    setMessage(t("assignmentUpdated"));
  }

  async function uploadPhotos(repairId: string, fileList: FileList | null): Promise<void> {
    if (!fileList || fileList.length === 0) return;
    const formData = new FormData();
    for (const file of Array.from(fileList)) {
      formData.append("photos", file);
    }
    await api.post(`/repairs/${repairId}/photos`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    await loadRepairs(scope, searchText, pagination.page, sort, viewMode, false, listFilters, true);
    setMessage(t("photosUploaded"));
  }

  async function removePhoto(repairId: string, photoId: string): Promise<void> {
    await api.delete(`/repairs/${repairId}/photos/${photoId}`);
    await loadRepairs(scope, searchText, pagination.page, sort, viewMode, false, listFilters, true);
    setMessage(t("photoRemoved"));
  }

  async function deleteRepair(repairId: string): Promise<void> {
    const confirmed = window.confirm(t("deleteRepairConfirm"));
    if (!confirmed) return;
    setBusy("deleteRepair", true);
    try {
      await api.delete(`/repairs/${repairId}`);
      await loadRepairs(scope, searchText, pagination.page, sort, viewMode, false, listFilters, true);
      showToast(t("repairDeleted"));
    } finally {
      setBusy("deleteRepair", false);
    }
  }

  async function saveRepairWork(repairId: string): Promise<void> {
    const selectedStatus = repairWorkForm.status;
    const apiStatus = selectedStatus === "NOTIFY_CUSTOMER" ? "READY_FOR_PICKUP" : selectedStatus;
    const apiNotified =
      selectedStatus === "NOTIFY_CUSTOMER"
        ? false
        : selectedStatus === "READY_FOR_PICKUP"
          ? true
          : null;
    setBusy("saveRepairWork", true);
    try {
      await api.patch(`/repairs/${repairId}/work`, {
        status: apiStatus,
        notified: apiNotified,
        outcome: repairWorkForm.outcome || null,
        successful: repairWorkForm.successful,
        fixDescription: repairWorkForm.fixDescription || null,
        material: repairWorkForm.material || null,
        safetyTested: repairWorkForm.safetyTested,
        technicianNotes: repairWorkForm.technicianNotes || null,
      });
      await loadRepairs(scope, searchText, pagination.page, sort, viewMode, false, listFilters, true);
      showToast(t("repairFieldsSaved"));
      setIsEditingRepairWork(false);
    } finally {
      setBusy("saveRepairWork", false);
    }
  }

  async function setCustomerNotified(repairId: string, notified: boolean): Promise<void> {
    await api.patch<{ repair: Repair }>(`/repairs/${repairId}`, { notified });
    setRepairs((prev) => prev.map((repair) => (repair.id === repairId ? { ...repair, notified } : repair)));
    showToast(
      notified ? t("customerNotifiedUpdatedYes") : t("customerNotifiedUpdatedNo"),
      "info",
    );
  }

  async function printLabel(repairId: string): Promise<void> {
    setBusy("printLabel", true);
    try {
      const response = await api.post<{
        bytes: number;
        spoolPath: string | null;
        queued?: boolean;
      }>(`/repairs/${repairId}/print-label`, {
        dryRun: false,
        printerProfileId: selectedPrinterProfileId || null,
      });
      if (response.data.queued) {
        void loadPrinters();
        showToast(t("labelQueuedToAgent", { bytes: response.data.bytes }), "info");
        return;
      }
      if (response.data.spoolPath) {
        void loadPrinters();
        if (selectedPrinterProfileId && selectedPrinterProfile && !selectedPrinterProfile.hasActiveAgent) {
          showToast(t("labelQueuedNoActiveAgent", { bytes: response.data.bytes }), "info");
          return;
        }
        showToast(t("labelQueued", { bytes: response.data.bytes }), "info");
        return;
      }
      void loadPrinters();
      showToast(t("labelSentToPrinter", { bytes: response.data.bytes }));
    } catch (error: unknown) {
      const maybeMessage =
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        typeof (error as { response?: { data?: { message?: unknown } } }).response?.data?.message === "string"
          ? ((error as { response: { data: { message: string } } }).response.data.message)
          : t("labelPrintingFailed");
      showToast(maybeMessage, "error");
    } finally {
      setBusy("printLabel", false);
    }
  }

  async function createRepair(): Promise<void> {
    if (newRepair.email.trim() && !isValidEmail(newRepair.email.trim())) {
      showToast(t("invalidEmailAddress"), "error");
      return;
    }
    setBusy("createRepair", true);
    try {
      await api.post("/repairs", {
        productType: newRepair.productType || undefined,
        createdDate: newRepair.createdDate ? new Date(newRepair.createdDate).toISOString() : undefined,
        firstName: newRepair.firstName || undefined,
        lastName: newRepair.lastName || undefined,
        city: newRepair.city || undefined,
        streetAddress: newRepair.streetAddress || undefined,
        email: newRepair.email || undefined,
        phone: newRepair.phone || undefined,
        itemName: newRepair.itemName || undefined,
        problemDescription: newRepair.problemDescription || undefined,
        assignedToUserId: newRepair.assignedToUserId || null,
        customerId: newRepair.customerId.trim() || undefined,
      });
      setNewRepair({
        productType: "",
        createdDate: dateInputTodayLocal(),
        firstName: "",
        lastName: "",
        city: "",
        streetAddress: "",
        email: "",
        phone: "",
        itemName: "",
        problemDescription: "",
        assignedToUserId: "",
        customerId: "",
      });
      await loadRepairs(scope, searchText, 1, sort, viewMode, false, listFilters, true);
      if (isAdmin) void loadMetrics();
      showToast(t("repairCreated"));
    } finally {
      setBusy("createRepair", false);
    }
  }

  async function createRepairer(): Promise<void> {
    setBusy("createUser", true);
    try {
      await api.post("/users", {
        username: newRepairer.username,
        fullName: newRepairer.fullName,
        password: newRepairer.password,
        role: newRepairer.role,
      });
      setNewRepairer({ username: "", fullName: "", password: "", role: "REPAIRER" });
      await loadAssignees();
      await loadRepairers();
      showToast(t("userCreated"));
    } finally {
      setBusy("createUser", false);
    }
  }

  async function setRepairerStatus(userId: string, isActive: boolean): Promise<void> {
    await api.patch(`/users/${userId}/status`, { isActive });
    await loadRepairers();
    setMessage(isActive ? t("userActivated") : t("userDeactivated"));
  }

  async function resetRepairerPassword(userId: string): Promise<void> {
    const newPassword = window.prompt(t("passwordPrompt"));
    if (!newPassword) return;
    await api.post(`/users/${userId}/reset-password`, { newPassword });
    showToast(t("passwordResetRequiresChange"), "info");
  }

  async function saveMyProfile(): Promise<void> {
    if (profileForm.recoveryEmail.trim() && !isValidEmail(profileForm.recoveryEmail.trim())) {
      showToast(t("invalidEmailAddress"), "error");
      return;
    }
    setBusy("saveProfile", true);
    try {
      const response = await api.patch<{ profile: UserProfile }>("/profile", {
        fullName: profileForm.fullName,
        recoveryEmail: profileForm.recoveryEmail || null,
        profilePhone: profileForm.profilePhone || null,
        profileLocation: profileForm.profileLocation || null,
        aboutMe: profileForm.aboutMe || null,
      });
      setProfile(response.data.profile);
      setUser((prev) => (prev ? { ...prev, fullName: response.data.profile.fullName } : prev));
      showToast(t("profileSaved"));
    } finally {
      setBusy("saveProfile", false);
    }
  }

  async function uploadMyAvatar(fileList: FileList | null): Promise<void> {
    if (!fileList || fileList.length === 0) return;
    const file = fileList[0];
    const formData = new FormData();
    formData.append("avatar", file);
    await api.post("/profile/avatar", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    await loadProfile();
    showToast(t("avatarUpdated"));
  }

  async function changeMyPassword(): Promise<void> {
    if (passwordForm.newPassword !== passwordForm.confirmNewPassword) {
      showToast(t("profilePasswordMismatch"), "error");
      return;
    }
    setBusy("changePassword", true);
    try {
      await api.post("/profile/change-password", {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordForm({ currentPassword: "", newPassword: "", confirmNewPassword: "" });
      setShowPasswordFields({ currentPassword: false, newPassword: false, confirmNewPassword: false });
      setUser((prev) => (prev ? { ...prev, mustChangePassword: false } : prev));
      showToast(t("profilePasswordChanged"));
    } finally {
      setBusy("changePassword", false);
    }
  }

  function togglePasswordField(field: "currentPassword" | "newPassword" | "confirmNewPassword"): void {
    setShowPasswordFields((prev) => ({ ...prev, [field]: !prev[field] }));
  }

  async function saveUserRoles(userId: string): Promise<void> {
    const roles = roleDrafts[userId] ?? [];
    if (!roles.length) {
      showToast(t("atLeastOneRole"), "error");
      return;
    }
    setBusy("saveRoles", true);
    try {
      await api.patch(`/users/${userId}/roles`, { roles });
      await loadRepairers();
      showToast(t("rolesUpdated"));
    } finally {
      setBusy("saveRoles", false);
    }
  }

  async function saveRepairIntake(repairId: string): Promise<void> {
    if (repairIntakeForm.email.trim() && !isValidEmail(repairIntakeForm.email.trim())) {
      showToast(t("invalidEmailAddress"), "error");
      return;
    }
    setBusy("saveRepairIntake", true);
    try {
      await api.patch(`/repairs/${repairId}`, {
        productType: repairIntakeForm.productType || null,
        createdDate: repairIntakeForm.createdDate
          ? new Date(repairIntakeForm.createdDate).toISOString()
          : null,
        firstName: repairIntakeForm.firstName || null,
        lastName: repairIntakeForm.lastName || null,
        streetAddress: repairIntakeForm.streetAddress || null,
        city: repairIntakeForm.city || null,
        email: repairIntakeForm.email || null,
        phone: repairIntakeForm.phone || null,
        itemName: repairIntakeForm.itemName || null,
        problemDescription: repairIntakeForm.problemDescription || null,
      });
      await loadRepairs(scope, searchText, pagination.page, sort, viewMode, false, listFilters, true);
      showToast(t("customerIntakeSaved"));
      setIsEditingRepairIntake(false);
    } finally {
      setBusy("saveRepairIntake", false);
    }
  }

  function toggleDraftRole(userId: string, role: UserRoleKey): void {
    setRoleDrafts((prev) => {
      const current = prev[userId] ?? [];
      const has = current.includes(role);
      const next = has ? current.filter((r) => r !== role) : [...current, role];
      return {
        ...prev,
        [userId]: next,
      };
    });
  }

  function toggleSort(sortBy: string): void {
    const nextDir: "asc" | "desc" =
      sort.sortBy === sortBy ? (sort.sortDir === "asc" ? "desc" : "asc") : "asc";
    const nextSort = { sortBy, sortDir: nextDir };
    void loadRepairs(scope, searchText, 1, nextSort, viewMode);
  }

  function sortIndicator(sortBy: string): string {
    if (sort.sortBy !== sortBy) return "";
    return sort.sortDir === "asc" ? " ↑" : " ↓";
  }

  function startResizing(): void {
    if (window.innerWidth <= 900) return;
    setIsResizing(true);
  }

  function openRepairDetail(repairId: string): void {
    if (repairId !== selectedRepairId && !confirmDiscardUnsavedChanges()) {
      return;
    }
    setSelectedRepairId(repairId);
    if (isMobile) setMobileView("detail");
  }

  function closeMobileMenu(): void {
    if (isMobile) setMobileMenuOpen(false);
  }

  function openAccountMenu(): void {
    if (accountMenuCloseTimeoutRef.current !== null) {
      window.clearTimeout(accountMenuCloseTimeoutRef.current);
      accountMenuCloseTimeoutRef.current = null;
    }
    setAccountMenuOpen(true);
    window.requestAnimationFrame(() => setAccountMenuVisible(true));
  }

  function closeAccountMenu(): void {
    if (!accountMenuOpen) return;
    setAccountMenuVisible(false);
    if (accountMenuCloseTimeoutRef.current !== null) {
      window.clearTimeout(accountMenuCloseTimeoutRef.current);
    }
    accountMenuCloseTimeoutRef.current = window.setTimeout(() => {
      setAccountMenuOpen(false);
      accountMenuCloseTimeoutRef.current = null;
    }, 220);
  }

  function toggleAccountMenu(): void {
    if (accountMenuOpen && accountMenuVisible) {
      closeAccountMenu();
      return;
    }
    openAccountMenu();
  }

  function handleRepairListKeyNav(event: ReactKeyboardEvent<HTMLElement>): void {
    const target = event.target as HTMLElement;
    const tagName = target.tagName.toLowerCase();
    if (tagName === "input" || tagName === "textarea" || tagName === "select" || tagName === "button") return;
    if (!repairs.length) return;

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const currentIndex = selectedRepairId ? repairs.findIndex((repair) => repair.id === selectedRepairId) : -1;
      const direction = event.key === "ArrowDown" ? 1 : -1;
      const nextIndexRaw = currentIndex === -1 ? 0 : currentIndex + direction;
      const nextIndex = Math.max(0, Math.min(repairs.length - 1, nextIndexRaw));
      setSelectedRepairId(repairs[nextIndex].id);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const fallbackRepairId = repairs[0]?.id;
      const repairId = selectedRepairId ?? fallbackRepairId;
      if (repairId) openRepairDetail(repairId);
    }
  }

  function logout(): void {
    setToken(null);
    setShowFunctionHub(false);
    setShowForgotPassword(false);
    setForgotPasswordStep("request");
    setForgotPasswordForm({
      username: "",
      resetToken: "",
      newPassword: "",
      confirmNewPassword: "",
    });
    closeAccountMenu();
    setMessage("");
  }

  async function changeLanguage(lang: "de" | "en"): Promise<void> {
    await i18n.changeLanguage(lang);
  }

  async function loadCustomerList(search: string, page: number): Promise<void> {
    setIsLoadingCustomerList(true);
    try {
      const response = await api.get<{
        customers: CustomerListItem[];
        pagination: { total: number; page: number; totalPages: number };
      }>("/customers", { params: { search, page, pageSize: 25 } });
      setCustomerList(response.data.customers);
      setCustomerListTotal(response.data.pagination.total);
      setCustomerListPage(response.data.pagination.page);
    } catch {
      setCustomerList([]);
      setCustomerListTotal(0);
    } finally {
      setIsLoadingCustomerList(false);
    }
  }

  async function backfillCustomers(): Promise<void> {
    try {
      const response = await api.post<{ created: number; linked: number }>("/customers/backfill");
      showToast(t("backfillDone", { created: response.data.created, linked: response.data.linked }));
      void loadCustomerList(customerListSearch, 1);
    } catch {
      showToast(t("backfillFailed"), "error");
    }
  }

  async function saveBranding(): Promise<void> {
    try {
      if (brandLogoFile) {
        const arrayBuf = await brandLogoFile.arrayBuffer();
        await api.post("/branding/logo", arrayBuf, {
          headers: { "Content-Type": brandLogoFile.type },
        });
        setBrandLogoSrc(`${api.defaults.baseURL}/branding/logo?_=${Date.now()}`);
        setBrandLogoFile(null);
      }
      if (brandingDraft.appName.trim()) {
        const res = await api.put<Record<string, string>>("/branding", {
          appName: brandingDraft.appName.trim(),
        });
        if (res.data.appName) setBrandAppName(res.data.appName);
      }
      showToast(t("brandingSaved"), "success");
    } catch {
      showToast(t("brandingSaveFailed"), "error");
    }
  }

  async function deleteBrandLogo(): Promise<void> {
    try {
      await api.delete("/branding/logo");
      setBrandLogoSrc(DEFAULT_LOGO_SRC);
      setBrandLogoFile(null);
      showToast(t("brandingLogoRemoved"), "success");
    } catch {
      showToast(t("brandingSaveFailed"), "error");
    }
  }

  async function mergeCustomers(): Promise<void> {
    const ids = Array.from(customerMergeSelection);
    if (ids.length < 2) {
      showToast(t("mergeNeedsTwoOrMore"), "error");
      return;
    }
    const keepId = ids[0];
    const mergeIds = ids.slice(1);
    setIsMergingCustomers(true);
    try {
      await api.post("/customers/merge", { keepId, mergeIds });
      showToast(t("mergeSuccess"));
      setCustomerMergeSelection(new Set());
      void loadCustomerList(customerListSearch, customerListPage);
    } catch {
      showToast(t("mergeFailed"), "error");
    } finally {
      setIsMergingCustomers(false);
    }
  }

  async function exportRepairsCsv(): Promise<void> {
    if (!isAdmin) return;
    setBusy("exportCsv", true);
    try {
      const response = await api.get("/repairs/export/csv", { responseType: "blob" });
      const blob = response.data as Blob;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const today = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.download = `repairs-export-${today}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast(t("csvExportStarted"));
    } catch {
      showToast(t("csvExportFailed"), "error");
    } finally {
      setBusy("exportCsv", false);
    }
  }

  function escapeHtml(value: string): string {
    return value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll("\"", "&quot;")
      .replaceAll("'", "&#039;");
  }

  function printRepairA4(repair: Repair): void {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      showToast(t("a4PrintPopupBlocked"), "error");
      return;
    }
    const rows = [
      [t("reference"), formatRepairRef(repair)],
      [t("status"), formatStatus(repair.status, repair.notified ?? false)],
      [t("articleType"), formatArticleType(repair.productType)],
      [t("dateBroughtIn"), formatDisplayDate(repair.createdDate)],
      [t("fullName"), formatCustomerFullName(repair)],
      [t("customerStreetAddress"), repair.streetAddress ?? "-"],
      [t("customerCity"), repair.city ?? "-"],
      [t("customerEmail"), repair.email ?? "-"],
      [t("customerPhone"), repair.phone ?? "-"],
      [t("itemDescription"), repair.itemName ?? "-"],
      [t("problem"), repair.problemDescription ?? "-"],
      [t("fix"), repair.fixDescription ?? "-"],
      [t("material"), repair.material ?? "-"],
      [t("remarks"), repair.technicianNotes ?? "-"],
      [t("assigned"), repair.assignedToUser?.fullName ?? t("unassigned")],
      [t("lastUpdate"), formatDisplayDateTime(repair.updatedAt)],
    ];
    const rowsHtml = rows
      .map(
        ([label, value]) =>
          `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(String(value))}</td></tr>`,
      )
      .join("");
    const logoUrl = brandLogoSrc.startsWith("http") ? brandLogoSrc : `${window.location.origin}${brandLogoSrc}`;

    printWindow.document.write(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(t("a4PrintTitle"))}</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 24px; color: #111; }
      .brand { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
      .brand img { width: 92px; height: auto; border-radius: 8px; }
      h1 { margin: 0 0 8px; font-size: 22px; }
      p { margin: 0 0 16px; color: #444; }
      table { width: 100%; border-collapse: collapse; }
      th, td { text-align: left; vertical-align: top; border: 1px solid #d0d0d0; padding: 8px; }
      th { width: 28%; background: #f5f5f5; }
      @media print { body { margin: 10mm; } }
    </style>
  </head>
  <body>
    <div class="brand">
      <img src="${escapeHtml(logoUrl)}" alt="Repair Kafi logo" />
      <h1>${escapeHtml(t("repairDetail"))}</h1>
    </div>
    <p>${escapeHtml(t("a4PrintSubtitle"))}</p>
    <table>${rowsHtml}</table>
  </body>
</html>`);
    printWindow.document.close();
    printWindow.focus();
    window.setTimeout(() => {
      printWindow.print();
    }, 250);
  }

  function formatDisplayDate(value: string | null): string {
    if (!value) return "-";
    const d = new Date(value);
    if (Number.isNaN(d.valueOf())) return "-";
    return d.toLocaleDateString(currentLang === "de" ? "de-CH" : "en-GB");
  }

  function formatDisplayDateTime(value: string | null | undefined): string {
    if (!value) return "-";
    const d = new Date(value);
    if (Number.isNaN(d.valueOf())) return "-";
    return d.toLocaleString(currentLang === "de" ? "de-CH" : "en-GB");
  }

  function formatSuccessful(value: boolean | null): string {
    if (selectedRepair?.outcome === "PARTIAL") return t("partial");
    if (selectedRepair?.outcome === "YES") return t("yes");
    if (selectedRepair?.outcome === "NO") return t("no");
    if (value === true) return t("yes");
    if (value === false) return t("no");
    return t("unknown");
  }

  function formatStatus(value: string | null | undefined, notified?: boolean | null): string {
    switch (value) {
      case "NEW":
        return t("statusNew");
      case "IN_PROGRESS":
        return t("statusInProgress");
      case "WAITING_PARTS":
        return t("statusWaitingParts");
      case "READY_FOR_PICKUP":
        if (notified === true) return t("statusReadyForPickup");
        if (notified === false || notified === null) return t("statusNotifyCustomer");
        return t("statusReadyForPickup");
      case "COMPLETED":
        return t("statusCompleted");
      case "CANCELLED":
        return t("statusCancelled");
      default:
        return value ?? "-";
    }
  }

  function statusChipClass(value: string | null | undefined): string {
    switch (value) {
      case "COMPLETED":
        return "status-chip completed";
      case "READY_FOR_PICKUP":
        return "status-chip ready";
      case "IN_PROGRESS":
      case "WAITING_PARTS":
        return "status-chip progress";
      case "CANCELLED":
        return "status-chip cancelled";
      case "NEW":
      default:
        return "status-chip new";
    }
  }

  function formatPrinterStatus(value: PrinterProfile["printerStatus"]): string {
    switch (value) {
      case "ONLINE":
        return t("printerStatusOnline");
      case "OFFLINE":
        return t("printerStatusOffline");
      default:
        return t("printerStatusUnknown");
    }
  }

  function printerStatusBadgeClass(value: PrinterProfile["printerStatus"]): string {
    switch (value) {
      case "ONLINE":
        return "printer-status-badge online";
      case "OFFLINE":
        return "printer-status-badge offline";
      default:
        return "printer-status-badge unknown";
    }
  }

  function renderExpandableValue(fieldKey: string, value: string | null | undefined) {
    if (!value) return <>{value ?? "-"}</>;
    const shouldCollapse = value.length > 180;
    const expanded = Boolean(expandedDetailFields[fieldKey]);
    const displayText = shouldCollapse && !expanded ? `${value.slice(0, 180)}...` : value;
    return (
      <>
        {displayText}
        {shouldCollapse && (
          <>
            {" "}
            <button
              type="button"
              className="inline-toggle-button"
              onClick={() => toggleDetailField(fieldKey)}
            >
              {expanded ? t("showLess") : t("showMore")}
            </button>
          </>
        )}
      </>
    );
  }

  function intakeEditHint(): string {
    if (canEditIntakeFields && canEditOutcomeFields) return t("roleEditHintAll");
    if (canEditIntakeFields) return t("roleEditHintIntake");
    return t("roleEditHintReadOnly");
  }

  function outcomeEditHint(): string {
    if (canEditIntakeFields && canEditOutcomeFields) return t("roleEditHintAll");
    if (canEditOutcomeFields) return t("roleEditHintOutcome");
    return t("roleEditHintReadOnly");
  }

  function formatRepairRef(repair: Repair): string {
    if (repair.repairNumber === null) return repair.publicRef;
    return String(repair.repairNumber).padStart(4, "0");
  }

  function canEditRepairWork(repair: Repair): boolean {
    if (!user) return false;
    return canEditRepairFields && (isAdmin || isSupervisor || repair.assignedToUserId === user.id);
  }

  function canToggleCustomerNotified(repair: Repair): boolean {
    return (
      canAssignRepairs &&
      (repair.status === "READY_FOR_PICKUP" || repair.status === "NOTIFY_CUSTOMER")
    );
  }

  function formatCustomerFullName(repair: Repair): string {
    const first = (repair.firstName ?? "").trim();
    const last = (repair.lastName ?? "").trim();
    const full = `${first} ${last}`.trim();
    return full || "-";
  }

  function applyCustomerFromHistory(repair: Repair): void {
    setNewRepair((prev) => ({
      ...prev,
      customerId: repair.customerId ?? "",
      firstName: repair.firstName ?? "",
      lastName: repair.lastName ?? "",
      streetAddress: repair.streetAddress ?? "",
      city: repair.city ?? "",
      email: repair.email ?? "",
      phone: repair.phone ?? "",
      itemName: "",
      problemDescription: "",
    }));
    showToast(t("customerHistoryApplied"), "success");
  }

  function clearLinkedCustomer(): void {
    setNewRepair((prev) => ({ ...prev, customerId: "" }));
    showToast(t("clearLinkedCustomerDone"), "success");
  }

  function resetNewRepairForm(): void {
    setNewRepair({
      productType: "",
      createdDate: dateInputTodayLocal(),
      firstName: "",
      lastName: "",
      city: "",
      streetAddress: "",
      email: "",
      phone: "",
      itemName: "",
      problemDescription: "",
      assignedToUserId: "",
      customerId: "",
    });
    setCustomerHistoryMatches([]);
    setHasQueriedCustomerHistory(false);
  }

  function formatArticleType(value: string | null | undefined): string {
    if (!value) return "-";
    const key = `articleTypeOption.${value}` as const;
    const translated = t(key);
    return translated === key ? value : translated;
  }

  function calculatePercent(value: number, max: number): number {
    if (max <= 0) return 0;
    return Math.max(4, Math.round((value / max) * 100));
  }

  function activeFilterLabel(): string | null {
    if (listFilters.status === "NOTIFY_CUSTOMER") return t("filterNotifyCustomer");
    if (listFilters.status === "READY_FOR_PICKUP" && listFilters.notified === true) {
      return t("filterReadyPickup");
    }
    if (listFilters.notified === true) return t("filterCustomerNotified");
    return null;
  }

  function formatChangeType(changeType: string): string {
    switch (changeType) {
      case "CREATE":
        return t("historyCreate");
      case "PATCH":
        return t("historyPatch");
      case "WORK_UPDATE":
        return t("historyWorkUpdate");
      case "PHOTO_ADD":
        return t("historyPhotoAdd");
      case "PHOTO_REMOVE":
        return t("historyPhotoRemove");
      default:
        return changeType;
    }
  }

  function formatTelHref(value: string | null | undefined): string | null {
    if (!value) return null;
    const cleaned = value.replace(/[^+\d]/g, "");
    if (!cleaned) return null;
    return `tel:${cleaned}`;
  }

  if (!token) {
    return (
      <main className="container login-screen">
        <form
          className="card login-card"
          onSubmit={(event) => {
            event.preventDefault();
            void login(new FormData(event.currentTarget));
          }}
        >
          <header className="login-card-header">
            <img className="login-brand-logo" src={brandLogoSrc} alt="" />
            <h1>{brandAppName}</h1>
            <p>{t("login")}</p>
          </header>

          <label className="login-field">
            <span>{t("username")}</span>
            <input name="username" autoComplete="username" required />
          </label>

          <label className="login-field">
            <span>{t("password")}</span>
            <input name="password" type="password" autoComplete="current-password" required />
          </label>

          <button type="submit" className="login-submit">{t("login")}</button>
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
                    onClick={() => void requestPasswordReset()}
                  >
                    {t("requestResetEmail")}
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
                        setForgotPasswordForm((prev) => ({ ...prev, confirmNewPassword: event.target.value }))
                      }
                      autoComplete="new-password"
                    />
                  </label>
                  <button
                    type="button"
                    className="login-submit"
                    onClick={() => void resetPasswordWithToken()}
                  >
                    {t("submitPasswordReset")}
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
          {message && <p className={`message ${messageType} login-message`}>{message}</p>}
        </form>
      </main>
    );
  }

  if (mustChangePassword) {
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
                  onChange={(e) => setPasswordForm((prev) => ({ ...prev, currentPassword: e.target.value }))}
                />
                <button type="button" onClick={() => togglePasswordField("currentPassword")}>
                  {showPasswordFields.currentPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </label>
            <label>
              {t("profileNewPassword")}
              <div className="password-field">
                <input
                  type={showPasswordFields.newPassword ? "text" : "password"}
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))}
                />
                <button type="button" onClick={() => togglePasswordField("newPassword")}>
                  {showPasswordFields.newPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </label>
            <label>
              {t("profileConfirmPassword")}
              <div className="password-field">
                <input
                  type={showPasswordFields.confirmNewPassword ? "text" : "password"}
                  value={passwordForm.confirmNewPassword}
                  onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirmNewPassword: e.target.value }))}
                />
                <button type="button" onClick={() => togglePasswordField("confirmNewPassword")}>
                  {showPasswordFields.confirmNewPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </label>
          </div>
          <div className="detail-header-actions">
            <button disabled={busyActions.changePassword} onClick={() => void changeMyPassword()}>
              {busyActions.changePassword ? t("loadingChangePassword") : t("profileChangePassword")}
            </button>
            <button type="button" onClick={logout}>{t("logout")}</button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="container" style={{ "--left-pane-width": `${leftPaneWidth}px` } as CSSProperties}>
      <header className="header">
        <div className="header-top">
          <div className="header-brand">
            <img className="header-brand-logo" src={brandLogoSrc} alt="" />
            <h1>{brandAppName}</h1>
          </div>
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
          {accountMenuOpen && (
            <>
              <button
                type="button"
                className={`account-drawer-overlay ${accountMenuVisible ? "open" : "closing"}`}
                onClick={closeAccountMenu}
                aria-label={t("close")}
              />
              <aside className={`account-drawer ${accountMenuVisible ? "open" : "closing"}`} role="dialog" aria-label={t("profile")}>
                <div className="account-drawer-header">
                  <strong>{user?.fullName}</strong>
                  <button type="button" onClick={closeAccountMenu}>{t("close")}</button>
                </div>
                <div className="account-drawer-actions">
                  {showAdminTools && (
                    <button
                      type="button"
                      title={t("settings")}
                      onClick={() => {
                        setShowFunctionHub(false);
                        setShowProfilePage(false);
                        setAdminTab("settings");
                        closeAccountMenu();
                      }}
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
          )}
        </div>

        {isMobile && (
          <button
            className="mobile-menu-toggle"
            title={mobileMenuOpen ? t("close") : t("menu")}
            onClick={() => setMobileMenuOpen((prev) => !prev)}
          >
            {mobileMenuOpen ? <X size={16} /> : <Menu size={16} />}
          </button>
        )}

        {(!showFunctionHub || !canUseFunctionHub) && (
        <div className={`header-actions ${isMobile ? "mobile-actions" : ""} ${mobileMenuOpen ? "open" : ""}`}>
          {canUseFunctionHub && (
            <button
              title={t("home")}
              onClick={() => {
                setAdminTab("none");
                setShowFunctionHub(true);
                closeMobileMenu();
              }}
            >
              <Home size={14} /> {t("home")}
            </button>
          )}
          <button
            className={adminTab === "none" && !showFunctionHub && viewMode === "active" && scope === "my" ? "active" : ""}
            title={t("myRepairs")}
            onClick={() => {
              setAdminTab("none");
              setShowFunctionHub(false);
              void loadRepairs("my", searchText, 1, sort, "active", true, {});
              closeMobileMenu();
            }}
          >
            {t("myRepairs")}
          </button>
          <button
            className={adminTab === "none" && !showFunctionHub && viewMode === "active" && scope === "all" ? "active" : ""}
            title={t("allRepairs")}
            onClick={() => {
              setAdminTab("none");
              setShowFunctionHub(false);
              void loadRepairs("all", searchText, 1, sort, "active", true, {});
              closeMobileMenu();
            }}
          >
            {t("allRepairs")}
          </button>
          {canViewArchivedItems && (
            <button
              className={adminTab === "none" && !showFunctionHub && viewMode === "archived" ? "active" : ""}
              title={t("archivedItems")}
              onClick={() => {
                setAdminTab("none");
                setShowFunctionHub(false);
                void loadRepairs("all", searchText, 1, sort, "archived", true, {});
                closeMobileMenu();
              }}
            >
              {t("archivedItems")}
            </button>
          )}
          {isAdmin && (
            <button
              className={adminTab === "dashboard" ? "active" : ""}
              title={t("adminDashboard")}
              onClick={() => {
                setShowFunctionHub(false);
                setAdminTab("dashboard");
                closeMobileMenu();
              }}
            >
              {t("adminDashboard")}
            </button>
          )}
          {canCreateRepair && (
            <button
              className={adminTab === "addRepair" ? "active" : ""}
              title={t("adminAddRepair")}
              onClick={() => {
                setShowFunctionHub(false);
                setAdminTab("addRepair");
                closeMobileMenu();
              }}
            >
              {t("adminAddRepair")}
            </button>
          )}
          {canManageUsers && (
            <button
              className={adminTab === "manageRepairers" || adminTab === "addRepairer" ? "active" : ""}
              title={t("manageUsers")}
              onClick={() => {
                setShowFunctionHub(false);
                setAdminTab("manageRepairers");
                closeMobileMenu();
              }}
            >
              {t("manageUsers")}
            </button>
          )}
          {isAdmin && (
            <button
              className={adminTab === "customers" ? "active" : ""}
              title={t("adminCustomers")}
              onClick={() => {
                setShowFunctionHub(false);
                setAdminTab("customers");
                closeMobileMenu();
              }}
            >
              {t("adminCustomers")}
            </button>
          )}
          {isAdmin && (
            <button
              title={t("exportCsv")}
              disabled={busyActions.exportCsv}
              onClick={() => void exportRepairsCsv()}
            >
              <FileDown size={14} /> {busyActions.exportCsv ? t("loadingExportCsv") : t("exportCsv")}
            </button>
          )}
        </div>
        )}
      </header>
      {message && <p className={`message ${messageType}`}>{message}</p>}
      {showProfilePage && (
        <section className="card profile-page">
          <div className="profile-page-header">
            <h2>{t("profile")}</h2>
            <div className="profile-page-actions">
              <small>{profile?.username}</small>
              <button type="button" onClick={() => setShowProfilePage(false)}>{t("close")}</button>
            </div>
          </div>

          <div className="profile-layout">
            <div className="profile-avatar-panel">
              {profileAvatarUrl ? (
                <img className="profile-avatar-preview" src={profileAvatarUrl} alt={t("profileAvatarAlt")} />
              ) : (
                <div className="profile-avatar-placeholder">
                  <UserCircle size={56} />
                </div>
              )}
              <label className="profile-control">
                {t("profileAvatarLabel")}
                <input type="file" accept="image/*" onChange={(e) => void uploadMyAvatar(e.target.files)} />
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
                    onChange={(e) => setProfileForm((prev) => ({ ...prev, fullName: e.target.value }))}
                  />
                </label>
                <label>
                  {t("recoveryEmail")}
                  <input
                    type="email"
                    value={profileForm.recoveryEmail}
                    onChange={(e) => setProfileForm((prev) => ({ ...prev, recoveryEmail: e.target.value }))}
                  />
                  <span className="field-help">{t("recoveryEmailHelp")}</span>
                </label>
                <label>
                  {t("customerPhone")}
                  <input
                    value={profileForm.profilePhone}
                    onChange={(e) => setProfileForm((prev) => ({ ...prev, profilePhone: e.target.value }))}
                  />
                </label>
                <label>
                  {t("profileLocation")}
                  <input
                    value={profileForm.profileLocation}
                    onChange={(e) => setProfileForm((prev) => ({ ...prev, profileLocation: e.target.value }))}
                  />
                </label>
                <label className="wide">
                  {t("profileAboutMe")}
                  <textarea
                    rows={4}
                    value={profileForm.aboutMe}
                    onChange={(e) => setProfileForm((prev) => ({ ...prev, aboutMe: e.target.value }))}
                  />
                </label>
              </div>
              <button disabled={busyActions.saveProfile} onClick={() => void saveMyProfile()}>
                {busyActions.saveProfile ? t("loadingProfileSave") : t("profileSave")}
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
                      onChange={(e) => setPasswordForm((prev) => ({ ...prev, currentPassword: e.target.value }))}
                    />
                    <button type="button" onClick={() => togglePasswordField("currentPassword")}>
                      {showPasswordFields.currentPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </label>
                <label>
                  {t("profileNewPassword")}
                  <div className="password-field">
                    <input
                      type={showPasswordFields.newPassword ? "text" : "password"}
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))}
                    />
                    <button type="button" onClick={() => togglePasswordField("newPassword")}>
                      {showPasswordFields.newPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </label>
                <label>
                  {t("profileConfirmPassword")}
                  <div className="password-field">
                    <input
                      type={showPasswordFields.confirmNewPassword ? "text" : "password"}
                      value={passwordForm.confirmNewPassword}
                      onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirmNewPassword: e.target.value }))}
                    />
                    <button type="button" onClick={() => togglePasswordField("confirmNewPassword")}>
                      {showPasswordFields.confirmNewPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </label>
              </div>
              <button disabled={busyActions.changePassword} onClick={() => void changeMyPassword()}>
                {busyActions.changePassword ? t("loadingChangePassword") : t("profileChangePassword")}
              </button>
            </div>
          </div>
        </section>
      )}
      {adminTab !== "none" && (!showFunctionHub || !canUseFunctionHub) && (
        <section className="card admin-tabs-container">
          {adminTab === "dashboard" && isAdmin && (
            <div className="admin-tab-content">
              <h2>{t("adminDashboard")}</h2>
              {metrics ? (
                <>
                  <div className="metric-grid">
                  <div><strong>{t("totalLabel")}</strong><span>{metrics.totalRepairs}</span></div>
                  <div><strong>{t("openLabel")}</strong><span>{metrics.openRepairs}</span></div>
                  <div><strong>{t("completedLabel")}</strong><span>{metrics.completedRepairs}</span></div>
                  </div>
                  <div className="metric-lists">
                    <div className="chart-card">
                      <h3>{t("chartStatus")}</h3>
                      <div className="bar-chart">
                        {(() => {
                          const max = Math.max(...metrics.statusBreakdown.map((row) => row.count), 0);
                          return metrics.statusBreakdown.map((row) => (
                            <div key={row.status} className="bar-row">
                              <span className="bar-label">{formatStatus(row.status)}</span>
                              <div className="bar-track">
                                <div
                                  className="bar-fill status"
                                  style={{ width: `${calculatePercent(row.count, max)}%` }}
                                />
                              </div>
                              <span className="bar-value">{row.count}</span>
                            </div>
                          ));
                        })()}
                      </div>
                    </div>
                    <div className="chart-card">
                      <h3>{t("byAssignee")}</h3>
                      <div className="bar-chart">
                        {(() => {
                          const sorted = [...metrics.assigneeBreakdown].sort((a, b) => b.count - a.count).slice(0, 10);
                          const max = Math.max(...sorted.map((row) => row.count), 0);
                          return sorted.map((row) => (
                            <div key={`${row.assigneeId ?? "none"}-${row.assigneeName}`} className="bar-row">
                              <span className="bar-label">{row.assigneeName}</span>
                              <div className="bar-track">
                                <div
                                  className="bar-fill assignee"
                                  style={{ width: `${calculatePercent(row.count, max)}%` }}
                                />
                              </div>
                              <span className="bar-value">{row.count}</span>
                            </div>
                          ));
                        })()}
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <p>{t("loading")}</p>
              )}
            </div>
          )}

          {adminTab === "addRepair" && canCreateRepair && (
            <div className="admin-tab-content">
              <h3>{t("addRepair")}</h3>
              <div className="add-repair-section">
                <h4 className="add-repair-section-title">{t("sectionCustomerDetails")}</h4>
                <div className="add-repair-grid">
                  <label>
                    {t("customerFirstName")}
                    <input
                      value={newRepair.firstName}
                      onChange={(e) => setNewRepair((prev) => ({ ...prev, firstName: e.target.value }))}
                    />
                  </label>
                  <label>
                    {t("customerLastName")}
                    <input
                      value={newRepair.lastName}
                      onChange={(e) => setNewRepair((prev) => ({ ...prev, lastName: e.target.value }))}
                    />
                  </label>
                  <label className="wide">
                    {t("customerStreetAddress")}
                    <input
                      value={newRepair.streetAddress}
                      onChange={(e) => setNewRepair((prev) => ({ ...prev, streetAddress: e.target.value }))}
                    />
                  </label>
                  <label>
                    {t("customerCity")}
                    <input
                      value={newRepair.city}
                      onChange={(e) => setNewRepair((prev) => ({ ...prev, city: e.target.value }))}
                    />
                  </label>
                  <label>
                    {t("customerEmail")}
                    <input
                      type="email"
                      value={newRepair.email}
                      onChange={(e) => setNewRepair((prev) => ({ ...prev, email: e.target.value }))}
                    />
                  </label>
                  <label>
                    {t("customerPhone")}
                    <input
                      value={newRepair.phone}
                      onChange={(e) => setNewRepair((prev) => ({ ...prev, phone: e.target.value }))}
                    />
                  </label>
                  {newRepair.customerId.trim() !== "" && (
                    <div className="add-repair-clear-link">
                      <button type="button" className="clear-linked-customer-btn" onClick={clearLinkedCustomer}>
                        {t("clearLinkedCustomer")}
                      </button>
                    </div>
                  )}
                </div>
                {(isLoadingCustomerHistory || hasQueriedCustomerHistory) && (
                  <div className="detail-section add-repair-history">
                    <h4>{t("customerHistoryTitle")}</h4>
                    {isLoadingCustomerHistory ? (
                      <p className="field-help">{t("loading")}</p>
                    ) : (
                      <>
                        <p className="field-help">
                          {t("customerHistoryCount", { count: customerHistoryMatches.length })}
                        </p>
                        {customerHistoryMatches.length === 0 ? (
                          <p className="field-help">{t("customerHistoryNoMatches")}</p>
                        ) : (
                          <>
                            <p className="field-help">{t("customerHistoryTapHint")}</p>
                            <ul className="customer-history-list">
                              {customerHistoryMatches.map((repair) => (
                                <li key={repair.id}>
                                  <button
                                    type="button"
                                    className="customer-history-row"
                                    onClick={() => applyCustomerFromHistory(repair)}
                                  >
                                    <span className="customer-history-name">{formatCustomerFullName(repair)}</span>
                                    <span className="customer-history-meta">
                                      {formatRepairRef(repair)} · {repair.itemName ?? t("noProduct")} ·{" "}
                                      {formatStatus(repair.status, repair.notified)}
                                    </span>
                                  </button>
                                </li>
                              ))}
                            </ul>
                          </>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
              <div className="add-repair-section">
                <h4 className="add-repair-section-title">{t("sectionRepairDetails")}</h4>
                <div className="add-repair-grid">
                  <label>
                    {t("articleType")}
                    <select
                      value={newRepair.productType}
                      onChange={(e) => setNewRepair((prev) => ({ ...prev, productType: e.target.value }))}
                    >
                      <option value="">-</option>
                      {ARTICLE_TYPE_OPTIONS.map((option) => (
                        <option key={option} value={option}>{t(`articleTypeOption.${option}`)}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {t("dateReceived")}
                    <input
                      type="date"
                      value={newRepair.createdDate}
                      onChange={(e) => setNewRepair((prev) => ({ ...prev, createdDate: e.target.value }))}
                    />
                  </label>
                  <label className="wide">
                    {t("itemDescription")}
                    <input
                      value={newRepair.itemName}
                      onChange={(e) => setNewRepair((prev) => ({ ...prev, itemName: e.target.value }))}
                    />
                  </label>
                  <label className="wide">
                    {t("problem")}
                    <input
                      value={newRepair.problemDescription}
                      onChange={(e) => setNewRepair((prev) => ({ ...prev, problemDescription: e.target.value }))}
                    />
                  </label>
                  {assignees.length > 0 && canAssignRepairs && (
                    <label>
                      {t("assigned")}
                      <select
                        value={newRepair.assignedToUserId}
                        onChange={(e) => setNewRepair((prev) => ({ ...prev, assignedToUserId: e.target.value }))}
                      >
                        <option value="">{t("unassigned")}</option>
                        {assignees.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.fullName}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>
              </div>
              <div className="add-repair-actions">
                <button
                  className="add-repair-submit"
                  disabled={busyActions.createRepair}
                  onClick={() => void createRepair()}
                >
                  <Plus size={14} /> {busyActions.createRepair ? t("loadingCreateRepair") : t("createRepair")}
                </button>
                <button
                  type="button"
                  className="add-repair-submit"
                  onClick={resetNewRepairForm}
                >
                  {t("clearForm")}
                </button>
              </div>
            </div>
          )}

          {adminTab === "addRepairer" && canManageUsers && (
            <div className="admin-tab-content">
              <h3>{t("addUser")}</h3>
              <form
                className="add-user-grid"
                autoComplete="off"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (busyActions.createUser) return;
                  void createRepairer();
                }}
              >
                <label>
                  {t("username")}
                  <input
                    name="new-user-username"
                    autoComplete="new-username"
                    value={newRepairer.username}
                    onChange={(e) => setNewRepairer((prev) => ({ ...prev, username: e.target.value }))}
                  />
                </label>
                <label>
                  {t("fullName")}
                  <input
                    name="new-user-fullname"
                    autoComplete="off"
                    value={newRepairer.fullName}
                    onChange={(e) => setNewRepairer((prev) => ({ ...prev, fullName: e.target.value }))}
                  />
                </label>
                <label>
                  {t("password")}
                  <input
                    name="new-user-password"
                    type="password"
                    autoComplete="new-password"
                    value={newRepairer.password}
                    onChange={(e) => setNewRepairer((prev) => ({ ...prev, password: e.target.value }))}
                  />
                </label>
                <label>
                  {t("role")}
                  <select
                    name="new-user-role"
                    autoComplete="off"
                    value={newRepairer.role}
                    onChange={(e) => setNewRepairer((prev) => ({ ...prev, role: e.target.value as UserRoleKey }))}
                  >
                    {ROLE_OPTIONS.map((role) => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                </label>
              </form>
              <p className="field-help">{t("passwordHint")}</p>
              <button
                className="add-user-submit"
                type="button"
                disabled={busyActions.createUser}
                onClick={() => void createRepairer()}
              >
                <Plus size={14} /> {busyActions.createUser ? t("loadingAddUser") : t("addUser")}
              </button>
            </div>
          )}

          {adminTab === "manageRepairers" && canManageUsers && (
            <div className="admin-tab-content">
              <div className="admin-tab-header">
                <h3>{t("manageUsers")}</h3>
                <button onClick={() => setAdminTab("addRepairer")}>
                  {t("addUser")}
                </button>
              </div>
              <table className="repairs-table">
                <thead>
                  <tr>
                    <th>{t("username")}</th>
                    <th>{t("name")}</th>
                    <th>{t("customerEmail")}</th>
                    <th>{t("role")}</th>
                    <th>{t("status")}</th>
                    <th>{t("actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {repairers.map((repairer) => (
                    <tr key={repairer.id}>
                      <td>{repairer.username}</td>
                      <td>{repairer.fullName}</td>
                      <td>{repairer.recoveryEmail ?? "-"}</td>
                      <td>
                        <div className="role-pill-list">
                          {ROLE_OPTIONS.map((role) => (
                            <label key={`${repairer.id}-${role}`}>
                              <input
                                type="checkbox"
                                checked={(roleDrafts[repairer.id] ?? repairer.roles).includes(role)}
                                onChange={() => toggleDraftRole(repairer.id, role)}
                              />
                              {role}
                            </label>
                          ))}
                        </div>
                      </td>
                      <td>{repairer.isActive ? t("active") : t("inactive")}</td>
                      <td>
                        <button
                          className="manage-user-action-button"
                          title={busyActions.saveRoles ? t("loadingSaveRoles") : t("saveRoles")}
                          aria-label={busyActions.saveRoles ? t("loadingSaveRoles") : t("saveRoles")}
                          disabled={busyActions.saveRoles}
                          onClick={() => void saveUserRoles(repairer.id)}
                        >
                          <Save size={14} />
                        </button>
                        <button
                          className="manage-user-action-button"
                          title={repairer.isActive ? t("deactivate") : t("activate")}
                          aria-label={repairer.isActive ? t("deactivate") : t("activate")}
                          onClick={() => void setRepairerStatus(repairer.id, !repairer.isActive)}
                        >
                          <Power size={14} />
                        </button>
                        <button
                          className="manage-user-action-button"
                          title={t("resetPassword")}
                          aria-label={t("resetPassword")}
                          onClick={() => void resetRepairerPassword(repairer.id)}
                        >
                          <KeyRound size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {adminTab === "customers" && isAdmin && (
            <div className="admin-tab-content">
              <h3>{t("adminCustomers")}</h3>
              {customerListTotal === 0 && !isLoadingCustomerList && !customerListSearch && (
                <div className="detail-section">
                  <p className="field-help">{t("backfillHint")}</p>
                  <button onClick={() => void backfillCustomers()}>
                    {t("backfillCustomers")}
                  </button>
                </div>
              )}
              <div className="customer-list-toolbar">
                <input
                  type="search"
                  placeholder={t("search")}
                  value={customerListSearch}
                  onChange={(e) => setCustomerListSearch(e.target.value)}
                />
                <span className="field-help">{t("customerListTotal", { count: customerListTotal })}</span>
                {customerMergeSelection.size >= 2 && (
                  <button
                    disabled={isMergingCustomers}
                    onClick={() => void mergeCustomers()}
                  >
                    {isMergingCustomers ? t("loading") : t("mergeSelected", { count: customerMergeSelection.size })}
                  </button>
                )}
                {customerMergeSelection.size > 0 && (
                  <button
                    type="button"
                    className="clear-linked-customer-btn"
                    onClick={() => setCustomerMergeSelection(new Set())}
                  >
                    {t("clearSelection")}
                  </button>
                )}
              </div>
              {isLoadingCustomerList ? (
                <p className="field-help">{t("loading")}</p>
              ) : customerList.length === 0 ? (
                <p className="field-help">{t("customerHistoryNoMatches")}</p>
              ) : (
                <>
                  <table className="repairs-table customer-list-table">
                    <thead>
                      <tr>
                        <th className="customer-merge-col"></th>
                        <th>{t("fullName")}</th>
                        <th>{t("customerEmail")}</th>
                        <th>{t("customerPhone")}</th>
                        <th>{t("customerCity")}</th>
                        <th>{t("repairs")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customerList.map((cust) => {
                        const nameDisplay = [cust.firstName, cust.lastName].filter(Boolean).join(" ") || "-";
                        const isExpanded = expandedCustomerId === cust.id;
                        const isSelected = customerMergeSelection.has(cust.id);
                        return (
                          <tr
                            key={cust.id}
                            className={`customer-list-row ${isExpanded ? "expanded" : ""} ${isSelected ? "selected" : ""}`}
                          >
                            <td className="customer-merge-col">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {
                                  setCustomerMergeSelection((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(cust.id)) next.delete(cust.id);
                                    else next.add(cust.id);
                                    return next;
                                  });
                                }}
                              />
                            </td>
                            <td>
                              <button
                                type="button"
                                className="customer-expand-btn"
                                onClick={() => setExpandedCustomerId(isExpanded ? null : cust.id)}
                              >
                                {nameDisplay}
                              </button>
                              {isExpanded && cust.repairs.length > 0 && (
                                <ul className="customer-repairs-sublist">
                                  {cust.repairs.map((r) => (
                                    <li key={r.id}>
                                      {r.repairNumber !== null ? String(r.repairNumber).padStart(4, "0") : r.publicRef}
                                      {" · "}{r.itemName ?? t("noProduct")}
                                      {" · "}{formatStatus(r.status, r.notified)}
                                      {r.createdDate ? ` · ${new Date(r.createdDate).toLocaleDateString()}` : ""}
                                    </li>
                                  ))}
                                </ul>
                              )}
                              {isExpanded && cust.repairs.length === 0 && (
                                <p className="field-help">{t("customerHistoryNoMatches")}</p>
                              )}
                            </td>
                            <td>{cust.email ?? "-"}</td>
                            <td>{cust.phone ?? "-"}</td>
                            <td>{cust.city ?? "-"}</td>
                            <td>{cust.repairs.length}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {customerListTotal > 25 && (
                    <div className="pagination-row">
                      <button
                        disabled={customerListPage <= 1}
                        onClick={() => void loadCustomerList(customerListSearch, customerListPage - 1)}
                      >&laquo; {t("prevPage")}</button>
                      <span>{t("pageOf", { page: customerListPage, totalPages: Math.ceil(customerListTotal / 25) })}</span>
                      <button
                        disabled={customerListPage >= Math.ceil(customerListTotal / 25)}
                        onClick={() => void loadCustomerList(customerListSearch, customerListPage + 1)}
                      >{t("nextPage")} &raquo;</button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {adminTab === "settings" && (
            <div className="admin-tab-content">
              <div className="detail-header-row">
                <h3>{t("settings")}</h3>
                <button type="button" onClick={() => setAdminTab("none")}>{t("close")}</button>
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
                      <button className="clear-linked-customer-btn" onClick={() => void deleteBrandLogo()}>
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
          )}
        </section>
      )}
      {showFunctionHub && (
        <section className="card function-hub-card">
          <h2>{t("functionHubTitle")}</h2>
          <p className="field-help">{t("functionHubSubtitle")}</p>
          <div className="function-hub-actions">
            <button
              type="button"
              onClick={() => {
                void loadRepairs("all", searchText, 1, sort, "active", true, {});
                setAdminTab("none");
                setShowFunctionHub(false);
              }}
            >
              {t("allRepairs")}
            </button>
            {canViewArchivedItems && (
              <button
                type="button"
                onClick={() => {
                  void loadRepairs("all", searchText, 1, sort, "archived", true, {});
                  setAdminTab("none");
                  setShowFunctionHub(false);
                }}
              >
                {t("archivedItems")}
              </button>
            )}
            {isAdmin && (
              <button
                type="button"
                onClick={() => {
                  setAdminTab("dashboard");
                  setShowFunctionHub(false);
                }}
              >
                {t("adminDashboard")}
              </button>
            )}
            {canCreateRepair && (
              <button
                type="button"
                onClick={() => {
                  setAdminTab("addRepair");
                  setShowFunctionHub(false);
                }}
              >
                {t("createRepair")}
              </button>
            )}
            {canManageUsers && (
              <button
                type="button"
                onClick={() => {
                  setAdminTab("manageRepairers");
                  setShowFunctionHub(false);
                }}
              >
                {t("manageUsers")}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                void loadRepairs("all", searchText, 1, sort, "active", true, {
                  status: "READY_FOR_PICKUP",
                  notified: true,
                });
                setAdminTab("none");
                setShowFunctionHub(false);
              }}
            >
              {t("homeReadyForPickup")}
            </button>
            <button
              type="button"
              onClick={() => {
                void loadRepairs("all", searchText, 1, sort, "active", true, {
                  status: "NOTIFY_CUSTOMER",
                });
                setAdminTab("none");
                setShowFunctionHub(false);
              }}
            >
              {t("homeNotifyCustomer")}
            </button>
            {isAdmin && (
              <button
                type="button"
                disabled={busyActions.exportCsv}
                onClick={() => void exportRepairsCsv()}
              >
                <FileDown size={14} /> {busyActions.exportCsv ? t("loadingExportCsv") : t("exportCsv")}
              </button>
            )}
          </div>
        </section>
      )}
      {!hideRepairWorkspace && (
      <section className="grid">
        <aside
          className={`card list ${isMobile && mobileView === "detail" ? "mobile-hidden" : ""}`}
          onKeyDown={handleRepairListKeyNav}
          tabIndex={0}
        >
          <h2>
            {viewMode === "archived" ? t("archivedItems") : t("activeItems")} ({scope})
          </h2>
          {activeFilterLabel() && (
            <div className="active-filter-row">
              <span className="status-chip ready">{t("filterActiveLabel", { value: activeFilterLabel() })}</span>
              <button
                type="button"
                onClick={() => void loadRepairs(scope, searchText, 1, sort, viewMode, false, {})}
              >
                {t("clearFilter")}
              </button>
            </div>
          )}
          <div className="search-bar">
            <input
              placeholder={`${t("search")}...`}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void loadRepairs(scope, searchText, 1, sort, viewMode, false, listFilters);
              }}
            />
            <button
              type="button"
              title={t("clearSearch")}
              aria-label={t("clearSearch")}
              disabled={!searchText.trim()}
              onClick={() => {
                setSearchText("");
                void loadRepairs(scope, "", 1, sort, viewMode, false, listFilters);
              }}
            >
              <X size={14} />
            </button>
            <button title={t("search")} onClick={() => void loadRepairs(scope, searchText, 1, sort, viewMode, false, listFilters)}>
              <Search size={14} />
            </button>
          </div>
          <p className="field-help">{t("listKeyboardHint")}</p>
          {isLoading && <p>Loading...</p>}
          <table className="repairs-table">
            <thead>
              <tr>
                <th className="sortable" onClick={() => toggleSort("repairNumber")}>
                  {t("reference")}{sortIndicator("repairNumber")}
                </th>
                <th className="sortable" onClick={() => toggleSort("itemName")}>
                  {t("product")}{sortIndicator("itemName")}
                </th>
                <th className="sortable" onClick={() => toggleSort("status")}>
                  {t("status")}{sortIndicator("status")}
                </th>
                <th className="sortable" onClick={() => toggleSort("assigned")}>
                  {t("assigned")}{sortIndicator("assigned")}
                </th>
                <th>{t("customerNotified")}</th>
              </tr>
            </thead>
            <tbody>
              {repairs.map((repair) => (
                <tr
                  key={repair.id}
                  className={repair.id === selectedRepairId ? "selected" : ""}
                  onClick={() => openRepairDetail(repair.id)}
                >
                  <td>{formatRepairRef(repair)}</td>
                  <td>{repair.itemName ?? t("noProduct")}</td>
                  <td><span className={statusChipClass(repair.status)}>{formatStatus(repair.status, repair.notified ?? false)}</span></td>
                  <td>{repair.assignedToUser?.fullName ?? t("unassigned")}</td>
                  <td className="notified-toggle-cell" onClick={(event) => event.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={Boolean(repair.notified)}
                      disabled={!canToggleCustomerNotified(repair)}
                      title={t("customerNotified")}
                      aria-label={t("customerNotified")}
                      onChange={(event) => void setCustomerNotified(repair.id, event.target.checked)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="pagination">
            <button
              disabled={pagination.page <= 1}
              onClick={() => void loadRepairs(scope, searchText, pagination.page - 1, sort, viewMode, false, listFilters)}
            >
              {t("prev")}
            </button>
            <span>{t("pageSummary", { page: pagination.page, totalPages: pagination.totalPages, total: pagination.total })}</span>
            <button
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => void loadRepairs(scope, searchText, pagination.page + 1, sort, viewMode, false, listFilters)}
            >
              {t("next")}
            </button>
          </div>
        </aside>
        <div
          className={`grid-resizer ${isResizing ? "active" : ""}`}
          onMouseDown={startResizing}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize repair list panel"
          tabIndex={0}
        />
        <section className={`card detail ${isMobile && mobileView === "list" ? "mobile-hidden" : ""}`}>
          {selectedRepair ? (
            <>
              {isMobile && (
                <button className="mobile-back-button" onClick={() => setMobileView("list")}>
                  <ArrowLeft size={14} /> {t("backToList")}
                </button>
              )}
              <div className="detail-header-row">
                <h2>{t("repairDetail")}</h2>
                <div className="detail-header-actions">
                  {assignees.length > 0 && canAssignRepairs && (
                    <select
                      className="detail-assign-select"
                      defaultValue={selectedRepair.assignedToUserId ?? ""}
                      onChange={(e) => void updateAssignment(selectedRepair.id, e.target.value)}
                    >
                      <option value="">{t("unassigned")}</option>
                      {assignees.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.fullName}
                        </option>
                      ))}
                    </select>
                  )}
                  {canPrintFromDetail && (
                    <button disabled={busyActions.printLabel} onClick={() => void printLabel(selectedRepair.id)}>
                      <Printer size={14} /> {busyActions.printLabel ? t("loadingPrintLabel") : t("printLabel")}
                    </button>
                  )}
                  <button type="button" onClick={() => printRepairA4(selectedRepair)}>
                    <FileText size={14} /> {t("printA4")}
                  </button>
                  {canToggleLabelSimulation && (
                    <button
                      type="button"
                      onClick={() => setShowThermalPreview((prev) => !prev)}
                    >
                      {showThermalPreview ? t("hideSimulationLabel") : t("showSimulationLabel")}
                    </button>
                  )}
                  {isAdmin && (
                    <button
                      className="button-danger"
                      disabled={busyActions.deleteRepair}
                      onClick={() => void deleteRepair(selectedRepair.id)}
                    >
                      <Trash2 size={14} /> {busyActions.deleteRepair ? t("loadingDeleteRepair") : t("deleteRepair")}
                    </button>
                  )}
                </div>
              </div>
              <div className="detail-meta-chips">
                <span className="detail-chip"><strong>{t("reference")}:</strong> {formatRepairRef(selectedRepair)}</span>
                <span className="detail-chip"><strong>{t("status")}:</strong> {formatStatus(selectedRepair.status, selectedRepair.notified ?? false)}</span>
                <span className="detail-chip"><strong>{t("assigned")}:</strong> {selectedRepair.assignedToUser?.fullName ?? t("unassigned")}</span>
                <span className="detail-chip"><strong>{t("customerNotified")}:</strong> {selectedRepair.notified ? t("yes") : t("no")}</span>
              </div>

              <section className="detail-section">
                <div className="section-header-row">
                  <h3>{t("customerIntake")}</h3>
                  {canEditCustomerIntake && !isEditingRepairIntake && (
                    <button type="button" onClick={() => setIsEditingRepairIntake(true)}>
                      <Pencil size={14} /> {t("editCustomerIntake")}
                    </button>
                  )}
                </div>
                <p className="section-hint">{intakeEditHint()}</p>
                {isEditingRepairIntake ? (
                  <>
                    <h4 className="intake-subsection-title">{t("sectionCustomerDetails")}</h4>
                    <div className="intake-edit-grid">
                      <label>
                        {t("customerFirstName")}
                        <input
                          value={repairIntakeForm.firstName}
                          onChange={(e) => setRepairIntakeForm((prev) => ({ ...prev, firstName: e.target.value }))}
                        />
                      </label>
                      <label>
                        {t("customerLastName")}
                        <input
                          value={repairIntakeForm.lastName}
                          onChange={(e) => setRepairIntakeForm((prev) => ({ ...prev, lastName: e.target.value }))}
                        />
                      </label>
                      <label className="wide">
                        {t("customerStreetAddress")}
                        <input
                          value={repairIntakeForm.streetAddress}
                          onChange={(e) => setRepairIntakeForm((prev) => ({ ...prev, streetAddress: e.target.value }))}
                        />
                      </label>
                      <label>
                        {t("customerCity")}
                        <input
                          value={repairIntakeForm.city}
                          onChange={(e) => setRepairIntakeForm((prev) => ({ ...prev, city: e.target.value }))}
                        />
                      </label>
                      <label>
                        {t("customerEmail")}
                        <input
                          type="email"
                          value={repairIntakeForm.email}
                          onChange={(e) => setRepairIntakeForm((prev) => ({ ...prev, email: e.target.value }))}
                        />
                      </label>
                      <label>
                        {t("customerPhone")}
                        <input
                          value={repairIntakeForm.phone}
                          onChange={(e) => setRepairIntakeForm((prev) => ({ ...prev, phone: e.target.value }))}
                        />
                      </label>
                    </div>
                    <h4 className="intake-subsection-title">{t("sectionRepairDetails")}</h4>
                    <div className="intake-edit-grid">
                      <label>
                        {t("articleType")}
                        <select
                          value={repairIntakeForm.productType}
                          onChange={(e) => setRepairIntakeForm((prev) => ({ ...prev, productType: e.target.value }))}
                        >
                          <option value="">-</option>
                          {ARTICLE_TYPE_OPTIONS.map((option) => (
                            <option key={option} value={option}>{t(`articleTypeOption.${option}`)}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        {t("dateBroughtIn")}
                        <input
                          type="date"
                          value={repairIntakeForm.createdDate}
                          onChange={(e) => setRepairIntakeForm((prev) => ({ ...prev, createdDate: e.target.value }))}
                        />
                      </label>
                      <label className="wide">
                        {t("itemDescription")}
                        <textarea
                          rows={2}
                          value={repairIntakeForm.itemName}
                          onChange={(e) => setRepairIntakeForm((prev) => ({ ...prev, itemName: e.target.value }))}
                        />
                      </label>
                      <label className="wide">
                        {t("problem")}
                        <textarea
                          rows={3}
                          value={repairIntakeForm.problemDescription}
                          onChange={(e) => setRepairIntakeForm((prev) => ({ ...prev, problemDescription: e.target.value }))}
                        />
                      </label>
                    </div>
                    <div className="repair-work-actions">
                      <button
                        disabled={busyActions.saveRepairIntake}
                        onClick={() => void saveRepairIntake(selectedRepair.id)}
                      >
                        {busyActions.saveRepairIntake ? t("loadingSaveCustomerIntake") : t("saveCustomerIntake")}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (intakeHasUnsavedChanges && !window.confirm(t("unsavedChangesConfirm"))) return;
                          setIsEditingRepairIntake(false);
                        }}
                      >
                        {t("cancelEdit")}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <h4 className="intake-subsection-title">{t("sectionCustomerDetails")}</h4>
                    <dl className="detail-grid">
                      <div><dt>{t("fullName")}</dt><dd>{formatCustomerFullName(selectedRepair)}</dd></div>
                      <div><dt>{t("customerStreetAddress")}</dt><dd>{selectedRepair.streetAddress ?? "-"}</dd></div>
                      <div><dt>{t("customerCity")}</dt><dd>{selectedRepair.city ?? "-"}</dd></div>
                      <div><dt>{t("customerEmail")}</dt><dd>{selectedRepair.email ?? "-"}</dd></div>
                      <div>
                        <dt>{t("customerPhone")}</dt>
                        <dd>
                          {(() => {
                            const phoneHref = formatTelHref(selectedRepair.phone);
                            if (!phoneHref || !selectedRepair.phone) return selectedRepair.phone ?? "-";
                            return <a href={phoneHref}>{selectedRepair.phone}</a>;
                          })()}
                        </dd>
                      </div>
                    </dl>
                    <h4 className="intake-subsection-title">{t("sectionRepairDetails")}</h4>
                    <dl className="detail-grid">
                    <div><dt>{t("articleType")}</dt><dd>{formatArticleType(selectedRepair.productType)}</dd></div>
                    <div><dt>{t("dateBroughtIn")}</dt><dd>{formatDisplayDate(selectedRepair.createdDate)}</dd></div>
                    <div className="wide">
                      <dt>{t("itemDescription")}</dt>
                      <dd>
                        {selectedRepair.itemName ?? "-"}
                        {translatedContent?.itemName && (
                          <span className="translation-inline">EN: {translatedContent.itemName}</span>
                        )}
                      </dd>
                    </div>
                    <div className="wide">
                      <dt>{t("problem")}</dt>
                      <dd>
                        {renderExpandableValue("problemDescription", selectedRepair.problemDescription)}
                        {translatedContent?.problemDescription && (
                          <span className="translation-inline">EN: {translatedContent.problemDescription}</span>
                        )}
                      </dd>
                    </div>
                  </dl>
                  </>
                )}
              </section>

              <section className="detail-section">
                <div className="section-header-row">
                  <h3>{t("repairOutcomeSection")}</h3>
                  {canEditRepairWork(selectedRepair) && !isEditingRepairWork && (
                    <button type="button" onClick={() => setIsEditingRepairWork(true)}>
                      <Pencil size={14} /> {t("editRepairWork")}
                    </button>
                  )}
                </div>
                <p className="section-hint">{outcomeEditHint()}</p>
                {isEditingRepairWork ? (
                  <div className="repair-outcome-edit-grid">
                    <label>
                      {t("status")}
                      <select
                        value={repairWorkForm.status}
                        onChange={(e) =>
                          setRepairWorkForm((prev) => ({
                            ...prev,
                            status: e.target.value as "IN_PROGRESS" | "WAITING_PARTS" | "NOTIFY_CUSTOMER" | "READY_FOR_PICKUP" | "COMPLETED" | "CANCELLED",
                          }))
                        }
                      >
                        <option value="IN_PROGRESS">{t("statusInProgress")}</option>
                        <option value="WAITING_PARTS">{t("statusWaitingParts")}</option>
                        <option value="NOTIFY_CUSTOMER">{t("statusNotifyCustomer")}</option>
                        <option value="READY_FOR_PICKUP">{t("statusReadyForPickup")}</option>
                        <option value="COMPLETED">{t("statusCompleted")}</option>
                        <option value="CANCELLED">{t("statusCancelled")}</option>
                      </select>
                    </label>
                    <label>
                      {t("successful")}
                      <select
                        value={
                          repairWorkForm.successful === null
                            ? ""
                            : repairWorkForm.successful
                              ? "YES"
                              : "NO"
                        }
                        onChange={(e) => {
                          const value = e.target.value;
                          setRepairWorkForm((prev) => ({
                            ...prev,
                            successful: value === "" ? null : value === "YES",
                          }));
                        }}
                      >
                        <option value="">{t("unknown")}</option>
                        <option value="YES">{t("yes")}</option>
                        <option value="NO">{t("no")}</option>
                      </select>
                    </label>
                    <label>
                      {t("outcome")}
                      <select
                        value={repairWorkForm.outcome}
                        onChange={(e) =>
                          setRepairWorkForm((prev) => ({
                            ...prev,
                            outcome: e.target.value as "" | "YES" | "PARTIAL" | "NO",
                          }))
                        }
                      >
                        <option value="">{t("unknown")}</option>
                        <option value="YES">{t("yes")}</option>
                        <option value="PARTIAL">{t("partial")}</option>
                        <option value="NO">{t("no")}</option>
                      </select>
                    </label>
                    <label>
                      {t("safetyTest")}
                      <select
                        value={
                          repairWorkForm.safetyTested === null
                            ? ""
                            : repairWorkForm.safetyTested
                              ? "YES"
                              : "NO"
                        }
                        onChange={(e) => {
                          const value = e.target.value;
                          setRepairWorkForm((prev) => ({
                            ...prev,
                            safetyTested: value === "" ? null : value === "YES",
                          }));
                        }}
                      >
                        <option value="">{t("unknown")}</option>
                        <option value="YES">{t("yes")}</option>
                        <option value="NO">{t("no")}</option>
                      </select>
                    </label>
                    <label>
                      {t("lastUpdate")}
                      <input value={formatDisplayDateTime(selectedRepair.updatedAt)} readOnly />
                    </label>
                    <label className="wide">
                      {t("fix")}
                      <textarea
                        rows={3}
                        value={repairWorkForm.fixDescription}
                        onChange={(e) =>
                          setRepairWorkForm((prev) => ({ ...prev, fixDescription: e.target.value }))
                        }
                      />
                    </label>
                    <label className="wide">
                      {t("material")}
                      <textarea
                        rows={3}
                        value={repairWorkForm.material}
                        onChange={(e) =>
                          setRepairWorkForm((prev) => ({ ...prev, material: e.target.value }))
                        }
                      />
                    </label>
                    <label className="wide">
                      {t("remarks")}
                      <textarea
                        rows={4}
                        value={repairWorkForm.technicianNotes}
                        onChange={(e) =>
                          setRepairWorkForm((prev) => ({ ...prev, technicianNotes: e.target.value }))
                        }
                      />
                    </label>
                    <div className="repair-work-actions">
                      <button disabled={busyActions.saveRepairWork} onClick={() => void saveRepairWork(selectedRepair.id)}>
                        {busyActions.saveRepairWork ? t("loadingSaveRepairWork") : t("saveRepairWork")}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (workHasUnsavedChanges && !window.confirm(t("unsavedChangesConfirm"))) return;
                          setIsEditingRepairWork(false);
                        }}
                      >
                        {t("cancelEdit")}
                      </button>
                    </div>
                  </div>
                ) : (
                  <dl className="detail-grid">
                    <div><dt>{t("successful")}</dt><dd>{formatSuccessful(selectedRepair.successful)}</dd></div>
                    <div>
                      <dt>{t("outcome")}</dt>
                      <dd>
                        {selectedRepair.outcome === "YES"
                          ? t("yes")
                          : selectedRepair.outcome === "PARTIAL"
                            ? t("partial")
                            : selectedRepair.outcome === "NO"
                              ? t("no")
                              : t("unknown")}
                      </dd>
                    </div>
                    <div><dt>{t("safetyTest")}</dt><dd>{selectedRepair.safetyTested === null ? t("unknown") : selectedRepair.safetyTested ? t("yes") : t("no")}</dd></div>
                    <div><dt>{t("lastUpdate")}</dt><dd>{formatDisplayDateTime(selectedRepair.updatedAt)}</dd></div>
                    <div className="wide"><dt>{t("fix")}</dt><dd>{renderExpandableValue("fixDescription", selectedRepair.fixDescription)}</dd></div>
                    <div className="wide"><dt>{t("material")}</dt><dd>{renderExpandableValue("material", selectedRepair.material)}</dd></div>
                    <div className="wide"><dt>{t("remarks")}</dt><dd>{renderExpandableValue("technicianNotes", selectedRepair.technicianNotes)}</dd></div>
                  </dl>
                )}
              </section>

              <section className="detail-section">
                <h3>{t("repairChangeHistoryTitle")}</h3>
                {isLoadingRepairHistory ? (
                  <p>{t("loading")}</p>
                ) : repairChangeHistory.length === 0 ? (
                  <p className="field-help">{t("repairChangeHistoryEmpty")}</p>
                ) : (
                  <ul className="repair-history-list">
                    {repairChangeHistory.map((entry) => (
                      <li key={entry.id}>
                        <strong>{formatChangeType(entry.changeType)}</strong>{" "}
                        <span className="field-help">
                          {formatDisplayDateTime(entry.createdAt)} - {(entry.changedBy?.fullName ?? entry.changedBy?.username ?? t("unknown"))}
                        </span>
                        {entry.changedFields.length > 0 && (
                          <div className="field-help">
                            {t("repairChangeFieldsLabel")}: {entry.changedFields.join(", ")}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="photos-section">
                <div className="photos-section-header">
                  <h3>{t("photos")} ({selectedRepair.photos.length})</h3>
                  {canManagePhotos && (
                    <label className="photo-upload-btn">
                      <Plus size={14} /> {t("addPhotos")}
                      <input type="file" multiple accept="image/*" onChange={(e) => void uploadPhotos(selectedRepair.id, e.target.files)} hidden />
                    </label>
                  )}
                </div>
                {selectedRepair.photos.length === 0 ? (
                  <p className="field-help">{t("noPhotos")}</p>
                ) : (
                  <div className="photo-grid">
                    {selectedRepair.photos.map((photo) => (
                      <div key={photo.id} className="photo-card">
                        <div className="photo-card-image">
                          {photoPreviewUrls[photo.id] ? (
                            <a href={photoPreviewUrls[photo.id]} target="_blank" rel="noreferrer">
                              <img src={photoPreviewUrls[photo.id]} alt={photo.caption || ""} />
                            </a>
                          ) : (
                            <span className="photo-loading">{t("loading")}</span>
                          )}
                          {canManagePhotos && (
                            <button
                              type="button"
                              className="photo-delete-btn"
                              title={t("delete")}
                              onClick={() => void removePhoto(selectedRepair.id, photo.id)}
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                        <input
                          type="text"
                          className="photo-caption-input"
                          placeholder={t("photoCaption")}
                          defaultValue={photo.caption ?? ""}
                          onBlur={(e) => {
                            const val = e.target.value.trim();
                            if (val !== (photo.caption ?? "")) {
                              void api.patch(`/repairs/${selectedRepair.id}/photos/${photo.id}`, { caption: val });
                            }
                          }}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </section>
              {showThermalPreview && <ThermalLabelPreview repair={selectedRepair} onClose={() => setShowThermalPreview(false)} />}
            </>
          ) : (
            <p>{t("selectRepairPrompt")}</p>
          )}
        </section>
      </section>
      )}
    </main>
  );
}

export default App;
