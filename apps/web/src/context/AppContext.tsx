import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { useTranslation } from "react-i18next";
import { api, setApiToken, setUnauthorizedHandler } from "../api";
import type {
  Assignee,
  DashboardMetrics,
  InventoryItem,
  PrinterProfile,
  Repair,
  RepairChangeHistoryEntry,
  RepairerAdmin,
  RepairMaterial,
  RepairsPagination,
  RepairsSort,
  Supplier,
  UserRoleKey,
  User,
  UserProfile,
} from "../types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
export const ROLE_OPTIONS: UserRoleKey[] = ["ADMIN", "SUPERVISOR", "POS_USER", "REPAIRER"];
export const ARTICLE_TYPE_OPTIONS = [
  "Assortment",
  "Textile",
  "Electronics",
  "Electrical",
  "Wood",
  "Other",
] as const;
export const DEFAULT_LOGO_SRC = "/repair-kafi-logo-v3.png";
export const DEFAULT_APP_NAME = "Repair Platform";

// ---------------------------------------------------------------------------
// Local types
// ---------------------------------------------------------------------------
export type BusyAction =
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

export type CustomerListItem = {
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

// ---------------------------------------------------------------------------
// Helpers (pure, used inside the provider)
// ---------------------------------------------------------------------------
function dateInputTodayLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getViewModeFromPath(): "active" | "archived" {
  const path = window.location.pathname.replace(/\/+$/, "");
  return path === "/archived" ? "archived" : "active";
}

function getPublicRefFromPath(): string | null {
  const parts = window.location.pathname.split("/").filter(Boolean);
  if (parts.length === 2 && parts[0] === "repairs") {
    return decodeURIComponent(parts[1]);
  }
  return null;
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#039;");
}

// ---------------------------------------------------------------------------
// Context value type
// ---------------------------------------------------------------------------
export type AppContextValue = {
  // ---- Auth state ----
  token: string | null;
  setToken: React.Dispatch<React.SetStateAction<string | null>>;
  user: User | null;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  showForgotPassword: boolean;
  setShowForgotPassword: React.Dispatch<React.SetStateAction<boolean>>;
  forgotPasswordStep: "request" | "reset";
  setForgotPasswordStep: React.Dispatch<React.SetStateAction<"request" | "reset">>;
  forgotPasswordForm: {
    username: string;
    resetToken: string;
    newPassword: string;
    confirmNewPassword: string;
  };
  setForgotPasswordForm: React.Dispatch<React.SetStateAction<{
    username: string;
    resetToken: string;
    newPassword: string;
    confirmNewPassword: string;
  }>>;

  // ---- Repair state ----
  repairs: Repair[];
  setRepairs: React.Dispatch<React.SetStateAction<Repair[]>>;
  selectedRepairId: string | null;
  setSelectedRepairId: React.Dispatch<React.SetStateAction<string | null>>;
  selectedRepair: Repair | null;
  scope: "my" | "all";
  setScope: React.Dispatch<React.SetStateAction<"my" | "all">>;
  viewMode: "active" | "archived";
  setViewMode: React.Dispatch<React.SetStateAction<"active" | "archived">>;
  sort: RepairsSort;
  setSort: React.Dispatch<React.SetStateAction<RepairsSort>>;
  pagination: RepairsPagination;
  setPagination: React.Dispatch<React.SetStateAction<RepairsPagination>>;
  listFilters: { status?: string; notified?: boolean };
  setListFilters: React.Dispatch<React.SetStateAction<{ status?: string; notified?: boolean }>>;
  searchText: string;
  setSearchText: React.Dispatch<React.SetStateAction<string>>;
  assignees: Assignee[];
  setAssignees: React.Dispatch<React.SetStateAction<Assignee[]>>;

  // ---- Repair forms ----
  repairIntakeForm: {
    productType: string;
    createdDate: string;
    firstName: string;
    lastName: string;
    streetAddress: string;
    city: string;
    email: string;
    phone: string;
    itemName: string;
    problemDescription: string;
  };
  setRepairIntakeForm: React.Dispatch<React.SetStateAction<{
    productType: string;
    createdDate: string;
    firstName: string;
    lastName: string;
    streetAddress: string;
    city: string;
    email: string;
    phone: string;
    itemName: string;
    problemDescription: string;
  }>>;
  repairWorkForm: {
    status: "IN_PROGRESS" | "WAITING_PARTS" | "NOTIFY_CUSTOMER" | "READY_FOR_PICKUP" | "COMPLETED" | "CANCELLED";
    outcome: "" | "YES" | "PARTIAL" | "NO";
    fixDescription: string;
    material: string;
    safetyTested: boolean | null;
    technicianNotes: string;
  };
  setRepairWorkForm: React.Dispatch<React.SetStateAction<{
    status: "IN_PROGRESS" | "WAITING_PARTS" | "NOTIFY_CUSTOMER" | "READY_FOR_PICKUP" | "COMPLETED" | "CANCELLED";
    outcome: "" | "YES" | "PARTIAL" | "NO";
    fixDescription: string;
    material: string;
    safetyTested: boolean | null;
    technicianNotes: string;
  }>>;
  isEditingRepairIntake: boolean;
  setIsEditingRepairIntake: React.Dispatch<React.SetStateAction<boolean>>;
  isEditingRepairWork: boolean;
  setIsEditingRepairWork: React.Dispatch<React.SetStateAction<boolean>>;
  newRepair: {
    productType: string;
    createdDate: string;
    firstName: string;
    lastName: string;
    city: string;
    streetAddress: string;
    email: string;
    phone: string;
    itemName: string;
    problemDescription: string;
    assignedToUserId: string;
    customerId: string;
  };
  setNewRepair: React.Dispatch<React.SetStateAction<{
    productType: string;
    createdDate: string;
    firstName: string;
    lastName: string;
    city: string;
    streetAddress: string;
    email: string;
    phone: string;
    itemName: string;
    problemDescription: string;
    assignedToUserId: string;
    customerId: string;
  }>>;
  newRepairer: {
    username: string;
    fullName: string;
    password: string;
    role: UserRoleKey;
  };
  setNewRepairer: React.Dispatch<React.SetStateAction<{
    username: string;
    fullName: string;
    password: string;
    role: UserRoleKey;
  }>>;
  translatedContent: {
    itemName: string;
    problemDescription: string;
    fixDescription: string;
    technicianNotes: string;
  } | null;
  setTranslatedContent: React.Dispatch<React.SetStateAction<{
    itemName: string;
    problemDescription: string;
    fixDescription: string;
    technicianNotes: string;
  } | null>>;
  customerHistoryMatches: Repair[];
  setCustomerHistoryMatches: React.Dispatch<React.SetStateAction<Repair[]>>;
  isLoadingCustomerHistory: boolean;
  hasQueriedCustomerHistory: boolean;

  // ---- UI state ----
  isMobile: boolean;
  setIsMobile: React.Dispatch<React.SetStateAction<boolean>>;
  mobileView: "list" | "detail";
  setMobileView: React.Dispatch<React.SetStateAction<"list" | "detail">>;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  adminTab: "none" | "dashboard" | "addRepair" | "addRepairer" | "manageRepairers" | "customers" | "settings" | "inventory" | "suppliers" | "help";
  setAdminTab: React.Dispatch<React.SetStateAction<"none" | "dashboard" | "addRepair" | "addRepairer" | "manageRepairers" | "customers" | "settings" | "inventory" | "suppliers" | "help">>;
  showFunctionHub: boolean;
  setShowFunctionHub: React.Dispatch<React.SetStateAction<boolean>>;
  showProfilePage: boolean;
  setShowProfilePage: React.Dispatch<React.SetStateAction<boolean>>;
  accountMenuOpen: boolean;
  setAccountMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  accountMenuVisible: boolean;
  setAccountMenuVisible: React.Dispatch<React.SetStateAction<boolean>>;
  isResizing: boolean;
  setIsResizing: React.Dispatch<React.SetStateAction<boolean>>;
  leftPaneWidth: number;
  setLeftPaneWidth: React.Dispatch<React.SetStateAction<number>>;
  message: string;
  setMessage: React.Dispatch<React.SetStateAction<string>>;
  messageType: "success" | "error" | "info";
  setMessageType: React.Dispatch<React.SetStateAction<"success" | "error" | "info">>;
  showThermalPreview: boolean;
  setShowThermalPreview: React.Dispatch<React.SetStateAction<boolean>>;
  showCsvExportDialog: boolean;
  setShowCsvExportDialog: React.Dispatch<React.SetStateAction<boolean>>;
  csvExportType: "repairs" | "customers" | "both";
  setCsvExportType: React.Dispatch<React.SetStateAction<"repairs" | "customers" | "both">>;
  expandedDetailFields: Record<string, boolean>;
  setExpandedDetailFields: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  showUnsavedDialog: { action: () => void; saveAction?: () => Promise<void> } | null;
  setShowUnsavedDialog: React.Dispatch<React.SetStateAction<{ action: () => void; saveAction?: () => Promise<void> } | null>>;
  repairChangeHistory: RepairChangeHistoryEntry[];
  isLoadingRepairHistory: boolean;

  // ---- Profile state ----
  profile: UserProfile | null;
  setProfile: React.Dispatch<React.SetStateAction<UserProfile | null>>;
  profileForm: {
    fullName: string;
    recoveryEmail: string;
    profilePhone: string;
    profileLocation: string;
    aboutMe: string;
  };
  setProfileForm: React.Dispatch<React.SetStateAction<{
    fullName: string;
    recoveryEmail: string;
    profilePhone: string;
    profileLocation: string;
    aboutMe: string;
  }>>;
  passwordForm: {
    currentPassword: string;
    newPassword: string;
    confirmNewPassword: string;
  };
  setPasswordForm: React.Dispatch<React.SetStateAction<{
    currentPassword: string;
    newPassword: string;
    confirmNewPassword: string;
  }>>;
  showPasswordFields: {
    currentPassword: boolean;
    newPassword: boolean;
    confirmNewPassword: boolean;
  };
  setShowPasswordFields: React.Dispatch<React.SetStateAction<{
    currentPassword: boolean;
    newPassword: boolean;
    confirmNewPassword: boolean;
  }>>;
  profileAvatarUrl: string;
  setProfileAvatarUrl: React.Dispatch<React.SetStateAction<string>>;

  // ---- Admin state ----
  repairers: RepairerAdmin[];
  setRepairers: React.Dispatch<React.SetStateAction<RepairerAdmin[]>>;
  roleDrafts: Record<string, UserRoleKey[]>;
  setRoleDrafts: React.Dispatch<React.SetStateAction<Record<string, UserRoleKey[]>>>;
  metrics: DashboardMetrics | null;
  setMetrics: React.Dispatch<React.SetStateAction<DashboardMetrics | null>>;
  customerList: CustomerListItem[];
  setCustomerList: React.Dispatch<React.SetStateAction<CustomerListItem[]>>;
  customerListTotal: number;
  setCustomerListTotal: React.Dispatch<React.SetStateAction<number>>;
  customerListPage: number;
  setCustomerListPage: React.Dispatch<React.SetStateAction<number>>;
  customerListSearch: string;
  setCustomerListSearch: React.Dispatch<React.SetStateAction<string>>;
  isLoadingCustomerList: boolean;
  expandedCustomerId: string | null;
  setExpandedCustomerId: React.Dispatch<React.SetStateAction<string | null>>;
  customerMergeSelection: Set<string>;
  setCustomerMergeSelection: React.Dispatch<React.SetStateAction<Set<string>>>;
  isMergingCustomers: boolean;

  // ---- Printer state ----
  printerProfiles: PrinterProfile[];
  setPrinterProfiles: React.Dispatch<React.SetStateAction<PrinterProfile[]>>;
  selectedPrinterProfileId: string;
  setSelectedPrinterProfileId: React.Dispatch<React.SetStateAction<string>>;
  latestPairingCode: string;
  setLatestPairingCode: React.Dispatch<React.SetStateAction<string>>;
  selectedPrinterProfile: PrinterProfile | null;

  // ---- Photo state ----
  photoPreviewUrls: Record<string, string>;
  setPhotoPreviewUrls: React.Dispatch<React.SetStateAction<Record<string, string>>>;

  // ---- Materials state ----
  repairMaterials: RepairMaterial[];
  setRepairMaterials: React.Dispatch<React.SetStateAction<RepairMaterial[]>>;
  isLoadingMaterials: boolean;
  inventoryItems: InventoryItem[];
  setInventoryItems: React.Dispatch<React.SetStateAction<InventoryItem[]>>;
  inventorySearch: string;
  setInventorySearch: React.Dispatch<React.SetStateAction<string>>;
  editingInventoryItem: Partial<InventoryItem> | null;
  setEditingInventoryItem: React.Dispatch<React.SetStateAction<Partial<InventoryItem> | null>>;
  suppliers: Supplier[];
  setSuppliers: React.Dispatch<React.SetStateAction<Supplier[]>>;
  supplierSearch: string;
  setSupplierSearch: React.Dispatch<React.SetStateAction<string>>;
  editingSupplier: Partial<Supplier> | null;
  setEditingSupplier: React.Dispatch<React.SetStateAction<Partial<Supplier> | null>>;

  // ---- Busy / loading state ----
  busyActions: Record<BusyAction, boolean>;
  setBusyActions: React.Dispatch<React.SetStateAction<Record<BusyAction, boolean>>>;
  isLoading: boolean;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;

  // ---- Branding state ----
  brandAppName: string;
  setBrandAppName: React.Dispatch<React.SetStateAction<string>>;
  brandLogoSrc: string;
  setBrandLogoSrc: React.Dispatch<React.SetStateAction<string>>;
  brandingDraft: { appName: string };
  setBrandingDraft: React.Dispatch<React.SetStateAction<{ appName: string }>>;
  brandLogoFile: File | null;
  setBrandLogoFile: React.Dispatch<React.SetStateAction<File | null>>;

  // ---- Permission booleans ----
  isAdmin: boolean;
  isSupervisor: boolean;
  canManageUsers: boolean;
  canManagePrinters: boolean;
  canCreateRepair: boolean;
  canEditCustomerIntake: boolean;
  canEditRepairFields: boolean;
  canEditIntakeFields: boolean;
  canEditOutcomeFields: boolean;
  canAssignRepairs: boolean;
  canManageMaterials: boolean;
  canManagePhotos: boolean;
  canPrintFromDetail: boolean;
  canToggleLabelSimulation: boolean;
  canUseFunctionHub: boolean;
  canViewArchivedItems: boolean;
  canGeneratePairCode: boolean;

  // ---- Derived values ----
  mustChangePassword: boolean;
  currentLang: "en" | "de";
  hideRepairWorkspace: boolean;
  hasUnsavedFormChanges: boolean;
  showAdminTools: boolean;
  addRepairHasUnsavedChanges: boolean;
  addUserHasUnsavedChanges: boolean;
  profileHasUnsavedChanges: boolean;
  intakeHasUnsavedChanges: boolean;
  workHasUnsavedChanges: boolean;
  currentRepairStatusForForm: string;

  // ---- i18n ----
  t: ReturnType<typeof useTranslation>["t"];
  i18n: ReturnType<typeof useTranslation>["i18n"];

  // ---- Async / API functions ----
  login: (formData: FormData) => Promise<void>;
  logout: () => void;
  loadRepairs: (
    nextScope: "my" | "all",
    q: string,
    page: number,
    sortInput: RepairsSort,
    nextViewMode: "active" | "archived",
    syncUrl?: boolean,
    nextFilters?: { status?: string; notified?: boolean },
  ) => Promise<void>;
  createRepair: () => Promise<void>;
  createRepairer: () => Promise<void>;
  saveRepairIntake: (repairId: string) => Promise<void>;
  saveRepairWork: (repairId: string) => Promise<void>;
  updateAssignment: (repairId: string, assignedToUserId: string) => Promise<void>;
  uploadPhotos: (repairId: string, fileList: FileList | null) => Promise<void>;
  removePhoto: (repairId: string, photoId: string) => Promise<void>;
  deleteRepair: (repairId: string) => Promise<void>;
  printLabel: (repairId: string) => Promise<void>;
  saveUserRoles: (userId: string) => Promise<void>;
  setRepairerStatus: (userId: string, isActive: boolean) => Promise<void>;
  resetRepairerPassword: (userId: string) => Promise<void>;
  deleteUser: (userId: string) => Promise<void>;
  saveMyProfile: () => Promise<void>;
  uploadMyAvatar: (fileList: FileList | null) => Promise<void>;
  changeMyPassword: () => Promise<void>;
  loadCustomerList: (search: string, page: number) => Promise<void>;
  mergeCustomers: () => Promise<void>;
  backfillCustomers: () => Promise<void>;
  requestPasswordReset: () => Promise<void>;
  resetPasswordWithToken: () => Promise<void>;
  generatePairingCode: (printerProfileId: string) => Promise<void>;
  exportCsv: (type: "repairs" | "customers" | "both") => Promise<void>;
  loadRepairMaterials: (repairId: string) => Promise<void>;
  addRepairMaterial: (repairId: string, data: {
    inventoryItemId?: string | null;
    description: string;
    quantity: number;
    unitCost: number;
    billedToCustomer: boolean;
    notes?: string;
  }) => Promise<void>;
  updateRepairMaterial: (repairId: string, materialId: string, data: Record<string, unknown>) => Promise<void>;
  deleteRepairMaterial: (repairId: string, materialId: string) => Promise<void>;
  uploadMaterialReceipt: (repairId: string, materialId: string, file: File) => Promise<void>;
  removeMaterialReceipt: (repairId: string, materialId: string) => Promise<void>;
  loadInventoryItems: () => Promise<void>;
  saveInventoryItem: (data: Partial<InventoryItem> & { name: string }) => Promise<void>;
  deactivateInventoryItem: (id: string) => Promise<void>;
  loadAllSuppliers: () => Promise<void>;
  saveSupplier: (data: Partial<Supplier> & { name: string }) => Promise<void>;
  deactivateSupplier: (id: string) => Promise<void>;
  saveBranding: () => Promise<void>;
  deleteBrandLogo: () => Promise<void>;
  setCustomerNotified: (repairId: string, notified: boolean) => Promise<void>;
  printRepairA4: (repair: Repair) => void;
  changeLanguage: (lang: "de" | "en") => Promise<void>;
  loadAssignees: () => Promise<void>;
  loadPrinters: () => Promise<void>;
  loadMetrics: () => Promise<void>;
  loadRepairers: () => Promise<void>;
  loadProfile: () => Promise<void>;

  // ---- Helper / formatting functions ----
  formatStatus: (value: string | null | undefined, notified?: boolean | null) => string;
  statusChipClass: (value: string | null | undefined) => string;
  formatDisplayDate: (value: string | null) => string;
  formatDisplayDateTime: (value: string | null | undefined) => string;
  formatRepairRef: (repair: Repair) => string;
  formatCustomerFullName: (repair: Repair) => string;
  formatArticleType: (value: string | null | undefined) => string;
  formatPrinterStatus: (value: PrinterProfile["printerStatus"]) => string;
  printerStatusBadgeClass: (value: PrinterProfile["printerStatus"]) => string;
  formatChangeType: (changeType: string) => string;
  formatTelHref: (value: string | null | undefined) => string | null;
  renderExpandableValue: (fieldKey: string, value: string | null | undefined) => React.ReactNode;
  calculatePercent: (value: number, max: number) => number;
  activeFilterLabel: () => string | null;
  sortIndicator: (sortBy: string) => string;
  intakeEditHint: () => string;
  outcomeEditHint: () => string;
  canEditRepairWork: (repair: Repair) => boolean;
  canToggleCustomerNotified: (repair: Repair) => boolean;

  // ---- UI action functions ----
  toggleSort: (sortBy: string) => void;
  toggleDraftRole: (userId: string, role: UserRoleKey) => void;
  togglePasswordField: (field: "currentPassword" | "newPassword" | "confirmNewPassword") => void;
  toggleDetailField: (fieldKey: string) => void;
  openRepairDetail: (repairId: string) => void;
  closeMobileMenu: () => void;
  openAccountMenu: () => void;
  closeAccountMenu: () => void;
  toggleAccountMenu: () => void;
  startResizing: () => void;
  guardUnsavedChanges: (action: () => void) => void;
  showToast: (text: string, type?: "success" | "error" | "info") => void;
  setBusy: (action: BusyAction, value: boolean) => void;
  onPrinterProfileChange: (value: string) => void;
  applyCustomerFromHistory: (repair: Repair) => void;
  clearLinkedCustomer: () => void;
  resetNewRepairForm: () => void;
  handleRepairListKeyNav: (event: ReactKeyboardEvent<HTMLElement>) => void;
  renderPagination: () => React.ReactNode;
  dateInputTodayLocal: () => string;
};

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------
const AppContext = createContext<AppContextValue | null>(null);

export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error("useAppContext must be used within an AppProvider");
  }
  return ctx;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------
export function AppProvider({ children }: { children: ReactNode }) {
  const { t, i18n } = useTranslation();

  // =========================================================================
  // STATE
  // =========================================================================

  // ---- Auth state ----
  const [token, setToken] = useState<string | null>(localStorage.getItem("rp_token"));
  const [user, setUser] = useState<User | null>(null);
  const [showForgotPassword, setShowForgotPassword] = useState<boolean>(false);
  const [forgotPasswordStep, setForgotPasswordStep] = useState<"request" | "reset">("request");
  const [forgotPasswordForm, setForgotPasswordForm] = useState({
    username: "",
    resetToken: "",
    newPassword: "",
    confirmNewPassword: "",
  });

  // ---- Repair state ----
  const [repairs, setRepairs] = useState<Repair[]>([]);
  const [selectedRepairId, setSelectedRepairId] = useState<string | null>(null);
  const [scope, setScope] = useState<"my" | "all">("my");
  const [viewMode, setViewMode] = useState<"active" | "archived">("active");
  const [sort, setSort] = useState<RepairsSort>({ sortBy: "updatedAt", sortDir: "desc" });
  const [pagination, setPagination] = useState<RepairsPagination>({
    page: 1,
    pageSize: 25,
    total: 0,
    totalPages: 1,
  });
  const [listFilters, setListFilters] = useState<{ status?: string; notified?: boolean }>({});
  const [searchText, setSearchText] = useState<string>("");
  const [assignees, setAssignees] = useState<Assignee[]>([]);

  // ---- Repair forms ----
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
  const [repairWorkForm, setRepairWorkForm] = useState({
    status: "IN_PROGRESS" as "IN_PROGRESS" | "WAITING_PARTS" | "NOTIFY_CUSTOMER" | "READY_FOR_PICKUP" | "COMPLETED" | "CANCELLED",
    outcome: "" as "" | "YES" | "PARTIAL" | "NO",
    fixDescription: "",
    material: "",
    safetyTested: null as boolean | null,
    technicianNotes: "",
  });
  const [isEditingRepairIntake, setIsEditingRepairIntake] = useState<boolean>(false);
  const [isEditingRepairWork, setIsEditingRepairWork] = useState<boolean>(false);
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
  const [translatedContent, setTranslatedContent] = useState<{
    itemName: string;
    problemDescription: string;
    fixDescription: string;
    technicianNotes: string;
  } | null>(null);
  const [customerHistoryMatches, setCustomerHistoryMatches] = useState<Repair[]>([]);
  const [isLoadingCustomerHistory, setIsLoadingCustomerHistory] = useState<boolean>(false);
  const [hasQueriedCustomerHistory, setHasQueriedCustomerHistory] = useState<boolean>(false);

  // ---- UI state ----
  const [isMobile, setIsMobile] = useState<boolean>(() => window.innerWidth <= 900);
  const [mobileView, setMobileView] = useState<"list" | "detail">("list");
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [adminTab, setAdminTab] = useState<"none" | "dashboard" | "addRepair" | "addRepairer" | "manageRepairers" | "customers" | "settings" | "inventory" | "suppliers" | "help">(
    "none",
  );
  const [showFunctionHub, setShowFunctionHub] = useState<boolean>(false);
  const [showProfilePage, setShowProfilePage] = useState<boolean>(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState<boolean>(false);
  const [accountMenuVisible, setAccountMenuVisible] = useState<boolean>(false);
  const accountMenuCloseTimeoutRef = useRef<number | null>(null);
  const [isResizing, setIsResizing] = useState<boolean>(false);
  const [leftPaneWidth, setLeftPaneWidth] = useState<number>(() => {
    const saved = localStorage.getItem("rp_left_pane_width");
    const parsed = saved ? Number(saved) : NaN;
    return Number.isFinite(parsed) ? parsed : 460;
  });
  const [message, setMessage] = useState<string>("");
  const [messageType, setMessageType] = useState<"success" | "error" | "info">("success");
  const [showThermalPreview, setShowThermalPreview] = useState<boolean>(false);
  const [showCsvExportDialog, setShowCsvExportDialog] = useState<boolean>(false);
  const [csvExportType, setCsvExportType] = useState<"repairs" | "customers" | "both">("repairs");
  const [expandedDetailFields, setExpandedDetailFields] = useState<Record<string, boolean>>({});
  const [showUnsavedDialog, setShowUnsavedDialog] = useState<{ action: () => void; saveAction?: () => Promise<void> } | null>(null);
  const [repairChangeHistory, setRepairChangeHistory] = useState<RepairChangeHistoryEntry[]>([]);
  const [isLoadingRepairHistory, setIsLoadingRepairHistory] = useState<boolean>(false);

  // ---- Profile state ----
  const [profile, setProfile] = useState<UserProfile | null>(null);
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
  const [profileAvatarUrl, setProfileAvatarUrl] = useState<string>("");

  // ---- Admin state ----
  const [repairers, setRepairers] = useState<RepairerAdmin[]>([]);
  const [roleDrafts, setRoleDrafts] = useState<Record<string, UserRoleKey[]>>({});
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [customerList, setCustomerList] = useState<CustomerListItem[]>([]);
  const [customerListTotal, setCustomerListTotal] = useState<number>(0);
  const [customerListPage, setCustomerListPage] = useState<number>(1);
  const [customerListSearch, setCustomerListSearch] = useState<string>("");
  const [isLoadingCustomerList, setIsLoadingCustomerList] = useState<boolean>(false);
  const [expandedCustomerId, setExpandedCustomerId] = useState<string | null>(null);
  const [customerMergeSelection, setCustomerMergeSelection] = useState<Set<string>>(new Set());
  const [isMergingCustomers, setIsMergingCustomers] = useState<boolean>(false);

  // ---- Printer state ----
  const [printerProfiles, setPrinterProfiles] = useState<PrinterProfile[]>([]);
  const [selectedPrinterProfileId, setSelectedPrinterProfileId] = useState<string>(
    () => localStorage.getItem("rp_printer_profile_id") ?? "",
  );
  const [latestPairingCode, setLatestPairingCode] = useState<string>("");

  // ---- Photo state ----
  const [photoPreviewUrls, setPhotoPreviewUrls] = useState<Record<string, string>>({});

  // ---- Materials state ----
  const [repairMaterials, setRepairMaterials] = useState<RepairMaterial[]>([]);
  const [isLoadingMaterials, setIsLoadingMaterials] = useState(false);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [inventorySearch, setInventorySearch] = useState("");
  const [editingInventoryItem, setEditingInventoryItem] = useState<Partial<InventoryItem> | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierSearch, setSupplierSearch] = useState("");
  const [editingSupplier, setEditingSupplier] = useState<Partial<Supplier> | null>(null);

  // ---- Busy / loading state ----
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
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // ---- Branding state ----
  const [brandAppName, setBrandAppName] = useState<string>(DEFAULT_APP_NAME);
  const [brandLogoSrc, setBrandLogoSrc] = useState<string>(DEFAULT_LOGO_SRC);
  const [brandingDraft, setBrandingDraft] = useState({ appName: "" });
  const [brandLogoFile, setBrandLogoFile] = useState<File | null>(null);

  // =========================================================================
  // DERIVED / COMPUTED VALUES
  // =========================================================================
  const selectedRepair = useMemo(
    () => repairs.find((r) => r.id === selectedRepairId) ?? null,
    [repairs, selectedRepairId],
  );

  const isAdmin = Boolean(user?.roles.includes("ADMIN"));
  const isSupervisor = Boolean(user?.roles.includes("SUPERVISOR"));
  const canManageUsers = isAdmin || isSupervisor;
  const canManagePrinters = Boolean(user?.roles.some((role) => role === "ADMIN" || role === "SUPERVISOR"));
  const canCreateRepair = Boolean(user?.roles.some((role) => role === "ADMIN" || role === "SUPERVISOR" || role === "POS_USER"));
  const canEditCustomerIntake = isAdmin || isSupervisor || canCreateRepair;
  const canUseFunctionHub = canCreateRepair;
  const canViewArchivedItems = canCreateRepair;
  const canEditRepairFields = Boolean(user?.roles.some((role) => role === "ADMIN" || role === "SUPERVISOR" || role === "REPAIRER"));
  const canEditIntakeFields = canCreateRepair || canEditRepairFields;
  const canEditOutcomeFields = canEditRepairFields || canCreateRepair;
  const canAssignRepairs = Boolean(user?.roles.some((role) => role === "ADMIN" || role === "SUPERVISOR" || role === "REPAIRER" || role === "POS_USER"));
  const canManageMaterials = canEditRepairFields;
  const canManagePhotos = canEditIntakeFields || canEditOutcomeFields;
  const canPrintFromDetail = canManagePhotos;
  const canToggleLabelSimulation = canManagePrinters;
  const showAdminTools = viewMode === "active";
  const mustChangePassword = Boolean(user?.mustChangePassword);
  const currentLang: "en" | "de" = i18n.language.startsWith("en") ? "en" : "de";

  const selectedPrinterProfile = useMemo(
    () => printerProfiles.find((p) => p.id === selectedPrinterProfileId) ?? null,
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

  // =========================================================================
  // HELPER / FORMATTING FUNCTIONS
  // =========================================================================

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

  function formatRepairRef(repair: Repair): string {
    if (repair.repairNumber === null) return repair.publicRef;
    return String(repair.repairNumber).padStart(4, "0");
  }

  function formatCustomerFullName(repair: Repair): string {
    const first = (repair.firstName ?? "").trim();
    const last = (repair.lastName ?? "").trim();
    const full = `${first} ${last}`.trim();
    return full || "-";
  }

  function formatArticleType(value: string | null | undefined): string {
    if (!value) return "-";
    const key = `articleTypeOption.${value}` as const;
    const translated = t(key);
    return translated === key ? value : translated;
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
      case "ASSIGNMENT":
        return t("historyAssignment");
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

  function sortIndicator(sortBy: string): string {
    if (sort.sortBy !== sortBy) return "";
    return sort.sortDir === "asc" ? " ↑" : " ↓";
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

  function fnCanEditRepairWork(repair: Repair): boolean {
    if (!user) return false;
    return canEditOutcomeFields && (isAdmin || isSupervisor || canCreateRepair || repair.assignedToUserId === user.id);
  }

  function fnCanToggleCustomerNotified(repair: Repair): boolean {
    return (
      canAssignRepairs &&
      (repair.status === "READY_FOR_PICKUP" || repair.status === "NOTIFY_CUSTOMER")
    );
  }

  // =========================================================================
  // UI ACTION FUNCTIONS
  // =========================================================================

  function onPrinterProfileChange(value: string): void {
    setSelectedPrinterProfileId(value);
    localStorage.setItem("rp_printer_profile_id", value);
    setLatestPairingCode("");
  }

  function showToast(text: string, type: "success" | "error" | "info" = "success"): void {
    setMessage(text);
    setMessageType(type);
  }

  function setBusy(action: BusyAction, value: boolean): void {
    setBusyActions((prev) => ({ ...prev, [action]: value }));
  }

  function toggleDetailField(fieldKey: string): void {
    setExpandedDetailFields((prev) => ({ ...prev, [fieldKey]: !prev[fieldKey] }));
  }

  function guardUnsavedChanges(action: () => void): void {
    if (!hasUnsavedFormChanges) {
      action();
      return;
    }
    let saveAction: (() => Promise<void>) | undefined;
    if (intakeHasUnsavedChanges && selectedRepairId) {
      const id = selectedRepairId;
      saveAction = () => saveRepairIntake(id);
    } else if (workHasUnsavedChanges && selectedRepairId) {
      const id = selectedRepairId;
      saveAction = () => saveRepairWork(id);
    }
    setShowUnsavedDialog({
      action: () => {
        setIsEditingRepairIntake(false);
        setIsEditingRepairWork(false);
        action();
      },
      saveAction,
    });
  }

  function openRepairDetail(repairId: string): void {
    if (repairId === selectedRepairId) {
      return;
    }
    guardUnsavedChanges(() => {
      setSelectedRepairId(repairId);
      if (isMobile) setMobileView("detail");
    });
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

  function startResizing(): void {
    if (window.innerWidth <= 900) return;
    setIsResizing(true);
  }

  function toggleSort(sortBy: string): void {
    guardUnsavedChanges(() => {
      const nextDir: "asc" | "desc" =
        sort.sortBy === sortBy ? (sort.sortDir === "asc" ? "desc" : "asc") : "asc";
      const nextSort = { sortBy, sortDir: nextDir };
      void loadRepairs(scope, searchText, 1, nextSort, viewMode);
    });
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

  function togglePasswordField(field: "currentPassword" | "newPassword" | "confirmNewPassword"): void {
    setShowPasswordFields((prev) => ({ ...prev, [field]: !prev[field] }));
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

  function renderPagination() {
    return (
      <div className="pagination">
        <button
          disabled={pagination.page <= 1}
          onClick={() => guardUnsavedChanges(() => void loadRepairs(scope, searchText, pagination.page - 1, sort, viewMode, false, listFilters))}
        >
          {t("prev")}
        </button>
        <span>{t("pageSummary", { page: pagination.page, totalPages: pagination.totalPages, total: pagination.total })}</span>
        <button
          disabled={pagination.page >= pagination.totalPages}
          onClick={() => guardUnsavedChanges(() => void loadRepairs(scope, searchText, pagination.page + 1, sort, viewMode, false, listFilters))}
        >
          {t("next")}
        </button>
      </div>
    );
  }

  // =========================================================================
  // ASYNC / API FUNCTIONS
  // =========================================================================

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
  ): Promise<void> {
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
        await loadRepairs("all", q, page, sortInput, "active", true, nextFilters);
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
        !response.data.printers.some((p) => p.id === selectedPrinterProfileId)
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

  async function createRepair(): Promise<void> {
    const missing: string[] = [];
    if (!newRepair.firstName.trim()) missing.push(t("firstName"));
    if (!newRepair.lastName.trim()) missing.push(t("lastName"));
    if (!newRepair.phone.trim()) missing.push(t("customerPhone"));
    if (!newRepair.productType.trim()) missing.push(t("articleType"));
    if (!newRepair.itemName.trim()) missing.push(t("itemDescription"));
    if (!newRepair.problemDescription.trim()) missing.push(t("problem"));
    if (missing.length > 0) {
      showToast(t("mandatoryFieldsMissing", { fields: missing.join(", ") }), "error");
      return;
    }
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
      await loadRepairs(scope, searchText, 1, sort, viewMode, false, listFilters);
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
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "response" in err
          ? (err as { response: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      showToast(msg || t("userCreateFailed"), "error");
    } finally {
      setBusy("createUser", false);
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
      await loadRepairs(scope, searchText, pagination.page, sort, viewMode, false, listFilters);
      showToast(t("customerIntakeSaved"));
      setIsEditingRepairIntake(false);
    } finally {
      setBusy("saveRepairIntake", false);
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
        fixDescription: repairWorkForm.fixDescription || null,
        material: repairWorkForm.material || null,
        safetyTested: repairWorkForm.safetyTested,
        technicianNotes: repairWorkForm.technicianNotes || null,
      });
      await loadRepairs(scope, searchText, pagination.page, sort, viewMode, false, listFilters);
      showToast(t("repairFieldsSaved"));
      setIsEditingRepairWork(false);
      if (apiStatus === "COMPLETED" || apiStatus === "CANCELLED") {
        setSelectedRepairId(null);
      }
    } finally {
      setBusy("saveRepairWork", false);
    }
  }

  async function updateAssignment(repairId: string, assignedToUserId: string): Promise<void> {
    await api.patch(`/repairs/${repairId}`, { assignedToUserId: assignedToUserId || null });
    await loadRepairs(scope, searchText, pagination.page, sort, viewMode, false, listFilters);
    if (isAdmin) void loadMetrics();
    setMessage(t("assignmentUpdated"));
  }

  async function uploadPhotos(repairId: string, fileList: FileList | null): Promise<void> {
    if (!fileList || fileList.length === 0) return;
    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    const rejected: string[] = [];
    const formData = new FormData();
    for (const file of Array.from(fileList)) {
      if (file.size > MAX_FILE_SIZE) {
        rejected.push(file.name);
      } else {
        formData.append("photos", file);
      }
    }
    if (rejected.length > 0) {
      showToast(t("photoTooLarge", { names: rejected.join(", "), maxMB: 10 }), "error");
    }
    if (!formData.has("photos")) return;
    try {
      await api.post(`/repairs/${repairId}/photos`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      await loadRepairs(scope, searchText, pagination.page, sort, viewMode, false, listFilters);
      setMessage(t("photosUploaded"));
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "response" in err
          ? (err as { response: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      showToast(msg || t("photoUploadFailed"), "error");
    }
  }

  async function removePhoto(repairId: string, photoId: string): Promise<void> {
    await api.delete(`/repairs/${repairId}/photos/${photoId}`);
    await loadRepairs(scope, searchText, pagination.page, sort, viewMode, false, listFilters);
    setMessage(t("photoRemoved"));
  }

  async function deleteRepair(repairId: string): Promise<void> {
    const confirmed = window.confirm(t("deleteRepairConfirm"));
    if (!confirmed) return;
    setBusy("deleteRepair", true);
    try {
      await api.delete(`/repairs/${repairId}`);
      await loadRepairs(scope, searchText, pagination.page, sort, viewMode, false, listFilters);
      showToast(t("repairDeleted"));
    } finally {
      setBusy("deleteRepair", false);
    }
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

  async function setCustomerNotifiedFn(repairId: string, notified: boolean): Promise<void> {
    await api.patch<{ repair: Repair }>(`/repairs/${repairId}`, { notified });
    setRepairs((prev) => prev.map((repair) => (repair.id === repairId ? { ...repair, notified } : repair)));
    showToast(
      notified ? t("customerNotifiedUpdatedYes") : t("customerNotifiedUpdatedNo"),
      "info",
    );
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

  async function setRepairerStatusFn(userId: string, isActive: boolean): Promise<void> {
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

  async function deleteUser(userId: string): Promise<void> {
    if (!window.confirm(t("deleteUserConfirm"))) return;
    try {
      await api.delete(`/users/${userId}`);
      await loadRepairers();
      await loadAssignees();
      showToast(t("userDeleted"));
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "response" in err
          ? (err as { response: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      showToast(msg || t("userDeleteFailed"), "error");
    }
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

  async function backfillCustomers(): Promise<void> {
    try {
      const response = await api.post<{ created: number; linked: number }>("/customers/backfill");
      showToast(t("backfillDone", { created: response.data.created, linked: response.data.linked }));
      void loadCustomerList(customerListSearch, 1);
    } catch {
      showToast(t("backfillFailed"), "error");
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

  async function downloadCsvBlob(endpoint: string, filename: string): Promise<void> {
    const response = await api.get(endpoint, { responseType: "blob" });
    const blob = response.data as Blob;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  async function exportCsv(type: "repairs" | "customers" | "both"): Promise<void> {
    if (!isAdmin) return;
    setBusy("exportCsv", true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      if (type === "repairs" || type === "both") {
        await downloadCsvBlob("/repairs/export/csv", `repairs-export-${today}.csv`);
      }
      if (type === "customers" || type === "both") {
        await downloadCsvBlob("/customers/export/csv", `customers-export-${today}.csv`);
      }
      showToast(t("csvExportStarted"));
      setShowCsvExportDialog(false);
    } catch {
      showToast(t("csvExportFailed"), "error");
    } finally {
      setBusy("exportCsv", false);
    }
  }

  async function loadRepairMaterials(repairId: string): Promise<void> {
    setIsLoadingMaterials(true);
    try {
      const res = await api.get<RepairMaterial[]>(`/repairs/${repairId}/materials`);
      setRepairMaterials(res.data);
    } catch {
      setRepairMaterials([]);
    } finally {
      setIsLoadingMaterials(false);
    }
  }

  async function addRepairMaterial(repairId: string, data: {
    inventoryItemId?: string | null;
    description: string;
    quantity: number;
    unitCost: number;
    billedToCustomer: boolean;
    notes?: string;
  }): Promise<void> {
    try {
      await api.post(`/repairs/${repairId}/materials`, data);
      showToast(t("materialSaved"));
      void loadRepairMaterials(repairId);
    } catch {
      showToast(t("materialSaveFailed"), "error");
    }
  }

  async function updateRepairMaterial(repairId: string, materialId: string, data: Record<string, unknown>): Promise<void> {
    try {
      await api.patch(`/repairs/${repairId}/materials/${materialId}`, data);
      showToast(t("materialSaved"));
      void loadRepairMaterials(repairId);
    } catch {
      showToast(t("materialSaveFailed"), "error");
    }
  }

  async function deleteRepairMaterial(repairId: string, materialId: string): Promise<void> {
    if (!window.confirm(t("materialDeleteConfirm"))) return;
    try {
      await api.delete(`/repairs/${repairId}/materials/${materialId}`);
      showToast(t("materialDeleted"));
      void loadRepairMaterials(repairId);
    } catch {
      showToast(t("materialSaveFailed"), "error");
    }
  }

  async function uploadMaterialReceipt(repairId: string, materialId: string, file: File): Promise<void> {
    try {
      const formDataObj = new FormData();
      formDataObj.append("receipt", file);
      await api.post(`/repairs/${repairId}/materials/${materialId}/receipt`, formDataObj);
      showToast(t("materialReceiptUploaded"));
      void loadRepairMaterials(repairId);
    } catch {
      showToast(t("materialSaveFailed"), "error");
    }
  }

  async function removeMaterialReceipt(repairId: string, materialId: string): Promise<void> {
    try {
      await api.delete(`/repairs/${repairId}/materials/${materialId}/receipt`);
      showToast(t("materialReceiptRemoved"));
      void loadRepairMaterials(repairId);
    } catch {
      showToast(t("materialSaveFailed"), "error");
    }
  }

  async function loadInventoryItems(): Promise<void> {
    try {
      const res = await api.get<InventoryItem[]>("/inventory", { params: { search: inventorySearch, includeInactive: "true" } });
      setInventoryItems(res.data);
    } catch {
      setInventoryItems([]);
    }
  }

  async function saveInventoryItem(data: Partial<InventoryItem> & { name: string }): Promise<void> {
    try {
      if (data.id) {
        await api.patch(`/inventory/${data.id}`, data);
      } else {
        await api.post("/inventory", data);
      }
      showToast(t("inventorySaved"));
      setEditingInventoryItem(null);
      void loadInventoryItems();
    } catch {
      showToast(t("inventorySaveFailed"), "error");
    }
  }

  async function deactivateInventoryItem(id: string): Promise<void> {
    try {
      await api.delete(`/inventory/${id}`);
      showToast(t("inventoryDeleted"));
      void loadInventoryItems();
    } catch {
      showToast(t("inventorySaveFailed"), "error");
    }
  }

  async function loadAllSuppliers(): Promise<void> {
    try {
      const res = await api.get<Supplier[]>("/suppliers", { params: { search: supplierSearch, includeInactive: "true" } });
      setSuppliers(res.data);
    } catch {
      setSuppliers([]);
    }
  }

  async function saveSupplier(data: Partial<Supplier> & { name: string }): Promise<void> {
    try {
      if (data.id) {
        await api.patch(`/suppliers/${data.id}`, data);
      } else {
        await api.post("/suppliers", data);
      }
      showToast(t("supplierSaved"));
      setEditingSupplier(null);
      void loadAllSuppliers();
    } catch {
      showToast(t("supplierSaveFailed"), "error");
    }
  }

  async function deactivateSupplier(id: string): Promise<void> {
    try {
      await api.delete(`/suppliers/${id}`);
      showToast(t("supplierDeleted"));
      void loadAllSuppliers();
    } catch {
      showToast(t("supplierSaveFailed"), "error");
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

  async function changeLanguage(lang: "de" | "en"): Promise<void> {
    await i18n.changeLanguage(lang);
  }

  // =========================================================================
  // EFFECTS
  // =========================================================================

  // Cleanup account menu timeout on unmount
  useEffect(() => {
    return () => {
      if (accountMenuCloseTimeoutRef.current !== null) {
        window.clearTimeout(accountMenuCloseTimeoutRef.current);
        accountMenuCloseTimeoutRef.current = null;
      }
    };
  }, []);

  // Load branding on mount
  useEffect(() => {
    api.get<Record<string, string>>("/branding").then((res) => {
      if (res.data.appName) setBrandAppName(res.data.appName);
      if (res.data.logoKey) setBrandLogoSrc(`${api.defaults.baseURL}/branding/logo?_=${Date.now()}`);
    }).catch(() => { /* keep defaults */ });
  }, []);

  // Token effect: bootstrap or clear
  useEffect(() => {
    setApiToken(token);
    if (token) {
      localStorage.setItem("rp_token", token);
      void (async () => {
        try {
          await loadMe();
        } catch {
          setToken(null);
          showToast(t("sessionExpiredPleaseLogin"), "info");
          return;
        }
        void loadProfile();
        const modeFromPath = getViewModeFromPath();
        const startScope = modeFromPath === "archived" ? "all" : scope;
        void loadRepairs(startScope, "", 1, sort, modeFromPath).then(() => void loadFromPublicRefPath());
        void loadAssignees();
        void loadPrinters();
      })();
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

  // Handle resetToken URL param when not logged in
  useEffect(() => {
    if (token) return;
    const url = new URL(window.location.href);
    const resetToken = (url.searchParams.get("resetToken") ?? "").trim();
    if (!resetToken) return;
    setShowForgotPassword(true);
    setForgotPasswordStep("reset");
    setForgotPasswordForm((prev) => ({ ...prev, resetToken }));
  }, [token]);

  // Set unauthorized handler
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setToken(null);
      showToast(t("sessionExpiredPleaseLogin"), "info");
    });
    return () => setUnauthorizedHandler(null);
  }, [t]);

  // Popstate -> reload
  useEffect(() => {
    if (!token) return;
    const onPopState = () => {
      window.location.reload();
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [token]);

  // Admin/supervisor data loading
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

  // Guard admin tabs against permissions
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
    if (adminTab === "customers" && !canCreateRepair) {
      setAdminTab("none");
    }
    if (adminTab === "settings" && !showAdminTools) {
      setAdminTab("none");
    }
  }, [adminTab, canCreateRepair, canManageUsers, isAdmin, showAdminTools]);

  // Persist language
  useEffect(() => {
    localStorage.setItem("rp_lang", currentLang);
  }, [currentLang]);

  // Cleanup photo preview URLs
  useEffect(() => {
    return () => {
      Object.values(photoPreviewUrls).forEach((url) => URL.revokeObjectURL(url));
    };
  }, [photoPreviewUrls]);

  // Cleanup profile avatar URL
  useEffect(() => {
    return () => {
      if (profileAvatarUrl) URL.revokeObjectURL(profileAvatarUrl);
    };
  }, [profileAvatarUrl]);

  // Auto-dismiss toast messages
  useEffect(() => {
    if (!message) return;
    const timeoutMs = messageType === "error" ? 6000 : 4000;
    const timeoutId = window.setTimeout(() => {
      setMessage("");
    }, timeoutMs);
    return () => window.clearTimeout(timeoutId);
  }, [message, messageType]);

  // Warn before unload if unsaved changes
  useEffect(() => {
    if (!hasUnsavedFormChanges) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasUnsavedFormChanges]);

  // Load photo previews when selected repair changes
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

  // Load repair change history
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

  // Load repair materials when selected repair changes
  useEffect(() => {
    const repairId = selectedRepair?.id;
    if (!repairId) {
      setRepairMaterials([]);
      return;
    }
    let cancelled = false;
    async function loadMaterials(): Promise<void> {
      setIsLoadingMaterials(true);
      try {
        const res = await api.get<RepairMaterial[]>(`/repairs/${repairId}/materials`);
        if (!cancelled) setRepairMaterials(res.data);
      } catch {
        if (!cancelled) setRepairMaterials([]);
      } finally {
        if (!cancelled) setIsLoadingMaterials(false);
      }
    }
    void loadMaterials();
    return () => { cancelled = true; };
  }, [selectedRepair?.id]);

  // Customer history lookup for new repair form
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

  // Load customer list when customers tab is active
  useEffect(() => {
    if (adminTab !== "customers") return;
    const timeoutId = window.setTimeout(() => {
      void loadCustomerList(customerListSearch, 1);
    }, customerListSearch ? 300 : 0);
    return () => window.clearTimeout(timeoutId);
  }, [adminTab, customerListSearch]);

  // Load inventory when inventory tab active
  useEffect(() => {
    if (adminTab !== "inventory") return;
    void loadInventoryItems();
    void loadAllSuppliers();
  }, [adminTab]);

  // Load suppliers when suppliers tab active
  useEffect(() => {
    if (adminTab !== "suppliers") return;
    void loadAllSuppliers();
  }, [adminTab]);

  // Load translation for selected repair
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

  // Sync intake/work forms when selected repair changes
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
      fixDescription: selectedRepair.fixDescription ?? "",
      material: selectedRepair.material ?? "",
      safetyTested: selectedRepair.safetyTested ?? null,
      technicianNotes: selectedRepair.technicianNotes ?? "",
    });
    setIsEditingRepairIntake(false);
    setIsEditingRepairWork(false);
  }, [selectedRepair]);

  // Persist left pane width
  useEffect(() => {
    localStorage.setItem("rp_left_pane_width", String(leftPaneWidth));
  }, [leftPaneWidth]);

  // Window resize -> mobile detection
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

  // Reset mobile view if detail but no selection
  useEffect(() => {
    if (isMobile && mobileView === "detail" && !selectedRepairId) {
      setMobileView("list");
    }
  }, [isMobile, mobileView, selectedRepairId]);

  // Pane resizing mouse events
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

  // =========================================================================
  // CONTEXT VALUE
  // =========================================================================
  const contextValue: AppContextValue = {
    // Auth
    token,
    setToken,
    user,
    setUser,
    showForgotPassword,
    setShowForgotPassword,
    forgotPasswordStep,
    setForgotPasswordStep,
    forgotPasswordForm,
    setForgotPasswordForm,

    // Repair state
    repairs,
    setRepairs,
    selectedRepairId,
    setSelectedRepairId,
    selectedRepair,
    scope,
    setScope,
    viewMode,
    setViewMode,
    sort,
    setSort,
    pagination,
    setPagination,
    listFilters,
    setListFilters,
    searchText,
    setSearchText,
    assignees,
    setAssignees,

    // Repair forms
    repairIntakeForm,
    setRepairIntakeForm,
    repairWorkForm,
    setRepairWorkForm,
    isEditingRepairIntake,
    setIsEditingRepairIntake,
    isEditingRepairWork,
    setIsEditingRepairWork,
    newRepair,
    setNewRepair,
    newRepairer,
    setNewRepairer,
    translatedContent,
    setTranslatedContent,
    customerHistoryMatches,
    setCustomerHistoryMatches,
    isLoadingCustomerHistory,
    hasQueriedCustomerHistory,

    // UI state
    isMobile,
    setIsMobile,
    mobileView,
    setMobileView,
    mobileMenuOpen,
    setMobileMenuOpen,
    adminTab,
    setAdminTab,
    showFunctionHub,
    setShowFunctionHub,
    showProfilePage,
    setShowProfilePage,
    accountMenuOpen,
    setAccountMenuOpen,
    accountMenuVisible,
    setAccountMenuVisible,
    isResizing,
    setIsResizing,
    leftPaneWidth,
    setLeftPaneWidth,
    message,
    setMessage,
    messageType,
    setMessageType,
    showThermalPreview,
    setShowThermalPreview,
    showCsvExportDialog,
    setShowCsvExportDialog,
    csvExportType,
    setCsvExportType,
    expandedDetailFields,
    setExpandedDetailFields,
    showUnsavedDialog,
    setShowUnsavedDialog,
    repairChangeHistory,
    isLoadingRepairHistory,

    // Profile state
    profile,
    setProfile,
    profileForm,
    setProfileForm,
    passwordForm,
    setPasswordForm,
    showPasswordFields,
    setShowPasswordFields,
    profileAvatarUrl,
    setProfileAvatarUrl,

    // Admin state
    repairers,
    setRepairers,
    roleDrafts,
    setRoleDrafts,
    metrics,
    setMetrics,
    customerList,
    setCustomerList,
    customerListTotal,
    setCustomerListTotal,
    customerListPage,
    setCustomerListPage,
    customerListSearch,
    setCustomerListSearch,
    isLoadingCustomerList,
    expandedCustomerId,
    setExpandedCustomerId,
    customerMergeSelection,
    setCustomerMergeSelection,
    isMergingCustomers,

    // Printer state
    printerProfiles,
    setPrinterProfiles,
    selectedPrinterProfileId,
    setSelectedPrinterProfileId,
    latestPairingCode,
    setLatestPairingCode,
    selectedPrinterProfile,

    // Photo state
    photoPreviewUrls,
    setPhotoPreviewUrls,

    // Materials state
    repairMaterials,
    setRepairMaterials,
    isLoadingMaterials,
    inventoryItems,
    setInventoryItems,
    inventorySearch,
    setInventorySearch,
    editingInventoryItem,
    setEditingInventoryItem,
    suppliers,
    setSuppliers,
    supplierSearch,
    setSupplierSearch,
    editingSupplier,
    setEditingSupplier,

    // Busy / loading
    busyActions,
    setBusyActions,
    isLoading,
    setIsLoading,

    // Branding
    brandAppName,
    setBrandAppName,
    brandLogoSrc,
    setBrandLogoSrc,
    brandingDraft,
    setBrandingDraft,
    brandLogoFile,
    setBrandLogoFile,

    // Permission booleans
    isAdmin,
    isSupervisor,
    canManageUsers,
    canManagePrinters,
    canCreateRepair,
    canEditCustomerIntake,
    canEditRepairFields,
    canEditIntakeFields,
    canEditOutcomeFields,
    canAssignRepairs,
    canManageMaterials,
    canManagePhotos,
    canPrintFromDetail,
    canToggleLabelSimulation,
    canUseFunctionHub,
    canViewArchivedItems,
    canGeneratePairCode,

    // Derived values
    mustChangePassword,
    currentLang,
    hideRepairWorkspace,
    hasUnsavedFormChanges,
    showAdminTools,
    addRepairHasUnsavedChanges,
    addUserHasUnsavedChanges,
    profileHasUnsavedChanges,
    intakeHasUnsavedChanges,
    workHasUnsavedChanges,
    currentRepairStatusForForm,

    // i18n
    t,
    i18n,

    // Async / API functions
    login,
    logout,
    loadRepairs,
    createRepair,
    createRepairer,
    saveRepairIntake,
    saveRepairWork,
    updateAssignment,
    uploadPhotos,
    removePhoto,
    deleteRepair,
    printLabel,
    saveUserRoles,
    setRepairerStatus: setRepairerStatusFn,
    resetRepairerPassword,
    deleteUser,
    saveMyProfile,
    uploadMyAvatar,
    changeMyPassword,
    loadCustomerList,
    mergeCustomers,
    backfillCustomers,
    requestPasswordReset,
    resetPasswordWithToken,
    generatePairingCode,
    exportCsv,
    loadRepairMaterials,
    addRepairMaterial,
    updateRepairMaterial,
    deleteRepairMaterial,
    uploadMaterialReceipt,
    removeMaterialReceipt,
    loadInventoryItems,
    saveInventoryItem,
    deactivateInventoryItem,
    loadAllSuppliers,
    saveSupplier,
    deactivateSupplier,
    saveBranding,
    deleteBrandLogo,
    setCustomerNotified: setCustomerNotifiedFn,
    printRepairA4,
    changeLanguage,
    loadAssignees,
    loadPrinters,
    loadMetrics,
    loadRepairers,
    loadProfile,

    // Helper / formatting functions
    formatStatus,
    statusChipClass,
    formatDisplayDate,
    formatDisplayDateTime,
    formatRepairRef,
    formatCustomerFullName,
    formatArticleType,
    formatPrinterStatus,
    printerStatusBadgeClass,
    formatChangeType,
    formatTelHref,
    renderExpandableValue,
    calculatePercent,
    activeFilterLabel,
    sortIndicator,
    intakeEditHint,
    outcomeEditHint,
    canEditRepairWork: fnCanEditRepairWork,
    canToggleCustomerNotified: fnCanToggleCustomerNotified,

    // UI action functions
    toggleSort,
    toggleDraftRole,
    togglePasswordField,
    toggleDetailField,
    openRepairDetail,
    closeMobileMenu,
    openAccountMenu,
    closeAccountMenu,
    toggleAccountMenu,
    startResizing,
    guardUnsavedChanges,
    showToast,
    setBusy,
    onPrinterProfileChange,
    applyCustomerFromHistory,
    clearLinkedCustomer,
    resetNewRepairForm,
    handleRepairListKeyNav,
    renderPagination,
    dateInputTodayLocal,
  };

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
}
