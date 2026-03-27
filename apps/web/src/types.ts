export type User = {
  id: string;
  username: string;
  fullName: string;
  roles: UserRoleKey[];
  mustChangePassword?: boolean;
};

export type UserProfile = {
  id: string;
  username: string;
  fullName: string;
  recoveryEmail: string | null;
  profilePhone: string | null;
  profileLocation: string | null;
  aboutMe: string | null;
  hasAvatar: boolean;
  updatedAt: string;
};

export type UserRoleKey = "ADMIN" | "SUPERVISOR" | "POS_USER" | "REPAIRER";

export type Repair = {
  id: string;
  publicRef: string;
  repairNumber: number | null;
  customerId?: string | null;
  productType: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  streetAddress: string | null;
  city: string | null;
  itemName: string | null;
  problemDescription: string | null;
  status: string;
  outcome: "YES" | "PARTIAL" | "NO" | null;
  material: string | null;
  technicianNotes: string | null;
  updatedAt: string;
  assignedToUserId: string | null;
  assignedToUser?: { id: string; fullName: string; username: string } | null;
  createdDate: string | null;
  completedAt: string | null;
  successful: boolean | null;
  safetyTested: boolean | null;
  notified: boolean | null;
  fixDescription: string | null;
  photos: Array<{
    id: string;
    originalFileName: string;
  }>;
};

export type RepairChangeHistoryEntry = {
  id: string;
  changeType: string;
  changedFields: string[];
  previousData: Record<string, unknown> | null;
  nextData: Record<string, unknown> | null;
  createdAt: string;
  changedBy?: { id: string; fullName: string; username: string } | null;
};

export type Assignee = {
  id: string;
  username: string;
  fullName: string;
};

export type DashboardMetrics = {
  totalRepairs: number;
  completedRepairs: number;
  openRepairs: number;
  statusBreakdown: Array<{
    status: string;
    count: number;
  }>;
  assigneeBreakdown: Array<{
    assigneeId: string | null;
    assigneeName: string;
    count: number;
  }>;
};

export type RepairsPagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type RepairsSort = {
  sortBy: string;
  sortDir: "asc" | "desc";
};

export type RepairerAdmin = {
  id: string;
  username: string;
  fullName: string;
  recoveryEmail: string | null;
  isActive: boolean;
  roles: UserRoleKey[];
};

export type PrinterProfile = {
  id: string;
  name: string;
  connectionType: "SPOOL" | "TCP";
  host: string | null;
  port: number | null;
  charsPerLine: number;
  hasActiveAgent?: boolean;
  canGeneratePairCode?: boolean;
  printerStatus?: "ONLINE" | "OFFLINE" | "UNKNOWN";
  lastSuccessfulPrintAt?: string | null;
};
