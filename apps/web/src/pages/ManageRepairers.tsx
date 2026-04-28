import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Save, Power, KeyRound, Trash2 } from "lucide-react";
import { useAppContext, ROLE_OPTIONS } from "../context/AppContext";
import { FormField } from "../components/FormField";
import { Spinner } from "../components/Spinner";
import type { UserRoleKey } from "../types";

export function ManageRepairers() {
  const { t } = useTranslation();
  const {
    repairers,
    newRepairer,
    setNewRepairer,
    roleDrafts,
    toggleDraftRole,
    busyActions,
    createRepairer,
    saveUserRoles,
    setRepairerStatus,
    resetRepairerPassword,
    deleteUser,
    adminTab,
    setAdminTab,
  } = useAppContext();

  const [addUserErrors, setAddUserErrors] = useState<Record<string, string>>({});
  const [addUserTouched, setAddUserTouched] = useState<Record<string, boolean>>({});

  const validateAddUserField = useCallback(
    (field: string, value: string): string => {
      if (["username", "fullName", "password"].includes(field) && !value.trim()) {
        return t("fieldRequired");
      }
      return "";
    },
    [t],
  );

  const handleAddUserBlur = useCallback(
    (field: string) => {
      setAddUserTouched((prev) => ({ ...prev, [field]: true }));
      const value = (newRepairer as Record<string, string>)[field] ?? "";
      const error = validateAddUserField(field, value);
      setAddUserErrors((prev) => ({ ...prev, [field]: error }));
    },
    [newRepairer, validateAddUserField],
  );

  const handleAddUserChange = useCallback(
    (field: string, value: string) => {
      setNewRepairer((prev) => ({ ...prev, [field]: value }));
      if (addUserTouched[field]) {
        const error = validateAddUserField(field, value);
        setAddUserErrors((prev) => ({ ...prev, [field]: error }));
      }
    },
    [setNewRepairer, addUserTouched, validateAddUserField],
  );

  const handleCreateUser = useCallback(() => {
    const requiredFields = ["username", "fullName", "password"];
    const newErrors: Record<string, string> = {};
    const newTouched: Record<string, boolean> = {};
    for (const field of requiredFields) {
      newTouched[field] = true;
      const value = (newRepairer as Record<string, string>)[field] ?? "";
      const error = validateAddUserField(field, value);
      if (error) newErrors[field] = error;
    }
    setAddUserTouched((prev) => ({ ...prev, ...newTouched }));
    setAddUserErrors((prev) => ({ ...prev, ...newErrors }));
    if (Object.values(newErrors).some(Boolean)) return;
    void createRepairer();
  }, [newRepairer, validateAddUserField, createRepairer]);

  // Show the "Add User" form
  if (adminTab === "addRepairer") {
    return (
      <div className="admin-tab-content">
        <h3>{t("addUser")}</h3>
        <form
          className="add-user-grid"
          autoComplete="off"
          onSubmit={(event) => {
            event.preventDefault();
            if (busyActions.createUser) return;
            handleCreateUser();
          }}
        >
          <FormField
            label={t("username")}
            required
            error={addUserTouched.username ? addUserErrors.username : undefined}
          >
            <input
              name="new-user-username"
              autoComplete="new-username"
              value={newRepairer.username}
              onChange={(e) => handleAddUserChange("username", e.target.value)}
              onBlur={() => handleAddUserBlur("username")}
            />
          </FormField>
          <FormField
            label={t("fullName")}
            required
            error={addUserTouched.fullName ? addUserErrors.fullName : undefined}
          >
            <input
              name="new-user-fullname"
              autoComplete="off"
              value={newRepairer.fullName}
              onChange={(e) => handleAddUserChange("fullName", e.target.value)}
              onBlur={() => handleAddUserBlur("fullName")}
            />
          </FormField>
          <FormField
            label={t("password")}
            required
            error={addUserTouched.password ? addUserErrors.password : undefined}
          >
            <input
              name="new-user-password"
              type="password"
              autoComplete="new-password"
              value={newRepairer.password}
              onChange={(e) => handleAddUserChange("password", e.target.value)}
              onBlur={() => handleAddUserBlur("password")}
            />
          </FormField>
          <FormField label={t("role")}>
            <select
              name="new-user-role"
              autoComplete="off"
              value={newRepairer.role}
              onChange={(e) => setNewRepairer((prev) => ({ ...prev, role: e.target.value as UserRoleKey }))}
            >
              {ROLE_OPTIONS.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </FormField>
        </form>
        <p className="field-help">{t("passwordHint")}</p>
        <button
          className="add-user-submit"
          type="button"
          disabled={busyActions.createUser}
          onClick={handleCreateUser}
        >
          {busyActions.createUser ? (
            <Spinner size={14} />
          ) : (
            <Plus size={14} />
          )}{" "}
          {busyActions.createUser ? t("loadingAddUser") : t("addUser")}
        </button>
      </div>
    );
  }

  // Show the "Manage Users" table
  return (
    <div className="admin-tab-content">
      <div className="admin-tab-header">
        <h3>{t("manageUsers")}</h3>
        <button onClick={() => setAdminTab("addRepairer")}>{t("addUser")}</button>
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
                  {busyActions.saveRoles ? <Spinner size={14} /> : <Save size={14} />}
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
                {!repairer.isActive && (
                  <button
                    className="manage-user-action-button danger"
                    title={t("deleteUser")}
                    aria-label={t("deleteUser")}
                    onClick={() => void deleteUser(repairer.id)}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
