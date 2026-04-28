import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Search, Plus, Save, Pencil, Trash2 } from "lucide-react";
import { useAppContext } from "../context/AppContext";
import { FormField } from "../components/FormField";
import type { InventoryItem } from "../types";

export function InventoryTab() {
  const { t } = useTranslation();
  const {
    setAdminTab,
    inventoryItems,
    inventorySearch,
    setInventorySearch,
    loadInventoryItems,
    editingInventoryItem,
    setEditingInventoryItem,
    saveInventoryItem,
    deactivateInventoryItem,
    suppliers,
  } = useAppContext();

  const [nameError, setNameError] = useState<string>("");
  const [nameTouched, setNameTouched] = useState(false);

  const validateName = useCallback(
    (value: string): string => {
      if (!value.trim()) return t("fieldRequired");
      return "";
    },
    [t],
  );

  const handleNameBlur = useCallback(() => {
    setNameTouched(true);
    const error = validateName(editingInventoryItem?.name ?? "");
    setNameError(error);
  }, [editingInventoryItem, validateName]);

  const handleNameChange = useCallback(
    (value: string) => {
      setEditingInventoryItem((p) => ({ ...p, name: value }));
      if (nameTouched) {
        setNameError(validateName(value));
      }
    },
    [setEditingInventoryItem, nameTouched, validateName],
  );

  const handleSave = useCallback(() => {
    const error = validateName(editingInventoryItem?.name ?? "");
    setNameTouched(true);
    setNameError(error);
    if (error) return;
    void saveInventoryItem(editingInventoryItem as InventoryItem & { name: string });
  }, [editingInventoryItem, validateName, saveInventoryItem]);

  // Reset validation when editing item changes
  const handleStartEdit = useCallback(
    (item: Partial<InventoryItem> | null) => {
      setNameTouched(false);
      setNameError("");
      setEditingInventoryItem(item);
    },
    [setEditingInventoryItem],
  );

  return (
    <div className="admin-tab-content">
      <div className="detail-header-row">
        <h3>{t("inventorySection")}</h3>
        <button type="button" onClick={() => setAdminTab("none")}>
          {t("close")}
        </button>
      </div>
      <div className="inventory-toolbar">
        <input
          type="text"
          placeholder={t("search")}
          value={inventorySearch}
          onChange={(e) => setInventorySearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void loadInventoryItems();
          }}
        />
        <button type="button" onClick={() => void loadInventoryItems()}>
          <Search size={14} />
        </button>
        <button
          type="button"
          onClick={() =>
            handleStartEdit({
              name: "",
              sku: "",
              category: "",
              unitCost: null,
              unitLabel: "pcs",
              supplierId: null,
              notes: "",
              isActive: true,
            })
          }
        >
          <Plus size={14} /> {t("inventoryAddItem")}
        </button>
      </div>
      {editingInventoryItem && (
        <div className="inline-edit-form">
          <FormField
            label={t("inventoryName")}
            required
            error={nameTouched ? nameError : undefined}
          >
            <input
              type="text"
              value={editingInventoryItem.name ?? ""}
              onChange={(e) => handleNameChange(e.target.value)}
              onBlur={handleNameBlur}
            />
          </FormField>
          <label>
            {t("inventorySku")}
            <input
              type="text"
              value={editingInventoryItem.sku ?? ""}
              onChange={(e) =>
                setEditingInventoryItem((p) => ({ ...p, sku: e.target.value || null }))
              }
            />
          </label>
          <label>
            {t("inventoryCategory")}
            <select
              value={editingInventoryItem.category ?? ""}
              onChange={(e) =>
                setEditingInventoryItem((p) => ({ ...p, category: e.target.value || null }))
              }
            >
              <option value="">{t("inventoryCategoryNone")}</option>
              <option value="stocked">{t("inventoryCategoryStocked")}</option>
              <option value="cafe">{t("inventoryCategoryCafe")}</option>
              <option value="private">{t("inventoryCategoryPrivate")}</option>
            </select>
          </label>
          <label>
            {t("inventoryUnitCost")}
            <input
              type="number"
              step="0.01"
              min="0"
              value={editingInventoryItem.unitCost ?? ""}
              onChange={(e) =>
                setEditingInventoryItem((p) => ({
                  ...p,
                  unitCost: e.target.value ? Number(e.target.value) : null,
                }))
              }
            />
          </label>
          <label>
            {t("inventoryUnitLabel")}
            <input
              type="text"
              value={editingInventoryItem.unitLabel ?? "pcs"}
              onChange={(e) =>
                setEditingInventoryItem((p) => ({
                  ...p,
                  unitLabel: e.target.value || "pcs",
                }))
              }
            />
          </label>
          <label>
            {t("inventorySupplier")}
            <select
              value={editingInventoryItem.supplierId ?? ""}
              onChange={(e) =>
                setEditingInventoryItem((p) => ({
                  ...p,
                  supplierId: e.target.value || null,
                }))
              }
            >
              <option value="">{t("noSupplier")}</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("materialNotes")}
            <textarea
              rows={2}
              value={editingInventoryItem.notes ?? ""}
              onChange={(e) =>
                setEditingInventoryItem((p) => ({
                  ...p,
                  notes: e.target.value || null,
                }))
              }
            />
          </label>
          <div className="inline-edit-actions">
            <button type="button" onClick={handleSave}>
              <Save size={14} /> {t("save")}
            </button>
            <button type="button" onClick={() => setEditingInventoryItem(null)}>
              {t("cancel")}
            </button>
          </div>
        </div>
      )}
      {inventoryItems.length === 0 ? (
        <p className="field-help">{t("inventoryNoItems")}</p>
      ) : (
        <table className="inventory-table">
          <thead>
            <tr>
              <th>{t("inventoryName")}</th>
              <th>{t("inventorySku")}</th>
              <th>{t("inventoryCategory")}</th>
              <th>{t("inventoryUnitCost")}</th>
              <th>{t("inventoryUnitLabel")}</th>
              <th>{t("inventorySupplier")}</th>
              <th>{t("inventoryActive")}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {inventoryItems.map((item) => (
              <tr key={item.id} className={item.isActive ? "" : "inactive-row"}>
                <td>{item.name}</td>
                <td>{item.sku ?? "-"}</td>
                <td>{item.category ?? "-"}</td>
                <td>{item.unitCost != null ? Number(item.unitCost).toFixed(2) : "-"}</td>
                <td>{item.unitLabel}</td>
                <td>{item.supplier?.name ?? "-"}</td>
                <td>{item.isActive ? t("yes") : t("no")}</td>
                <td>
                  <button
                    type="button"
                    onClick={() =>
                      handleStartEdit({
                        ...item,
                        unitCost: item.unitCost != null ? Number(item.unitCost) : null,
                      })
                    }
                  >
                    <Pencil size={14} />
                  </button>
                  {item.isActive && (
                    <button
                      type="button"
                      onClick={() => void deactivateInventoryItem(item.id)}
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
