import { useTranslation } from "react-i18next";
import { Search, Plus, Save, Pencil, Trash2 } from "lucide-react";
import { useAppContext } from "../context/AppContext";
import type { Supplier } from "../types";

export function SuppliersTab() {
  const { t } = useTranslation();
  const {
    setAdminTab,
    suppliers,
    supplierSearch,
    setSupplierSearch,
    loadAllSuppliers,
    editingSupplier,
    setEditingSupplier,
    saveSupplier,
    deactivateSupplier,
  } = useAppContext();

  return (
    <div className="admin-tab-content">
      <div className="detail-header-row">
        <h3>{t("suppliersSection")}</h3>
        <button type="button" onClick={() => setAdminTab("none")}>
          {t("close")}
        </button>
      </div>
      <div className="inventory-toolbar">
        <input
          type="text"
          placeholder={t("search")}
          value={supplierSearch}
          onChange={(e) => setSupplierSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void loadAllSuppliers();
          }}
        />
        <button type="button" onClick={() => void loadAllSuppliers()}>
          <Search size={14} />
        </button>
        <button
          type="button"
          onClick={() =>
            setEditingSupplier({
              name: "",
              contactName: "",
              email: "",
              phone: "",
              website: "",
              address: "",
              notes: "",
              isActive: true,
            })
          }
        >
          <Plus size={14} /> {t("supplierAdd")}
        </button>
      </div>
      {editingSupplier && (
        <div className="inline-edit-form">
          <label>
            {t("supplierName")} *
            <input
              type="text"
              value={editingSupplier.name ?? ""}
              onChange={(e) =>
                setEditingSupplier((p) => ({ ...p, name: e.target.value }))
              }
            />
          </label>
          <label>
            {t("supplierContact")}
            <input
              type="text"
              value={editingSupplier.contactName ?? ""}
              onChange={(e) =>
                setEditingSupplier((p) => ({
                  ...p,
                  contactName: e.target.value || null,
                }))
              }
            />
          </label>
          <label>
            {t("supplierEmail")}
            <input
              type="email"
              value={editingSupplier.email ?? ""}
              onChange={(e) =>
                setEditingSupplier((p) => ({
                  ...p,
                  email: e.target.value || null,
                }))
              }
            />
          </label>
          <label>
            {t("supplierPhone")}
            <input
              type="text"
              value={editingSupplier.phone ?? ""}
              onChange={(e) =>
                setEditingSupplier((p) => ({
                  ...p,
                  phone: e.target.value || null,
                }))
              }
            />
          </label>
          <label>
            {t("supplierWebsite")}
            <input
              type="url"
              value={editingSupplier.website ?? ""}
              onChange={(e) =>
                setEditingSupplier((p) => ({
                  ...p,
                  website: e.target.value || null,
                }))
              }
            />
          </label>
          <label>
            {t("supplierAddress")}
            <textarea
              rows={2}
              value={editingSupplier.address ?? ""}
              onChange={(e) =>
                setEditingSupplier((p) => ({
                  ...p,
                  address: e.target.value || null,
                }))
              }
            />
          </label>
          <label>
            {t("supplierNotes")}
            <textarea
              rows={2}
              value={editingSupplier.notes ?? ""}
              onChange={(e) =>
                setEditingSupplier((p) => ({
                  ...p,
                  notes: e.target.value || null,
                }))
              }
            />
          </label>
          <div className="inline-edit-actions">
            <button
              type="button"
              onClick={() => {
                if (!editingSupplier.name?.trim()) return;
                void saveSupplier(editingSupplier as Supplier & { name: string });
              }}
            >
              <Save size={14} /> {t("save")}
            </button>
            <button type="button" onClick={() => setEditingSupplier(null)}>
              {t("cancel")}
            </button>
          </div>
        </div>
      )}
      {suppliers.length === 0 ? (
        <p className="field-help">{t("supplierNoItems")}</p>
      ) : (
        <table className="inventory-table">
          <thead>
            <tr>
              <th>{t("supplierName")}</th>
              <th>{t("supplierContact")}</th>
              <th>{t("supplierEmail")}</th>
              <th>{t("supplierPhone")}</th>
              <th>{t("supplierWebsite")}</th>
              <th>{t("supplierActive")}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {suppliers.map((s) => (
              <tr key={s.id} className={s.isActive ? "" : "inactive-row"}>
                <td>{s.name}</td>
                <td>{s.contactName ?? "-"}</td>
                <td>
                  {s.email ? (
                    <a href={`mailto:${s.email}`}>{s.email}</a>
                  ) : (
                    "-"
                  )}
                </td>
                <td>{s.phone ?? "-"}</td>
                <td>
                  {s.website ? (
                    <a href={s.website} target="_blank" rel="noreferrer">
                      {s.website}
                    </a>
                  ) : (
                    "-"
                  )}
                </td>
                <td>{s.isActive ? t("yes") : t("no")}</td>
                <td>
                  <button type="button" onClick={() => setEditingSupplier({ ...s })}>
                    <Pencil size={14} />
                  </button>
                  {s.isActive && (
                    <button
                      type="button"
                      onClick={() => void deactivateSupplier(s.id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
