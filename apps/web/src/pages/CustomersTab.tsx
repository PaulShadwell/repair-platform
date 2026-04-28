import { useTranslation } from "react-i18next";
import { useAppContext } from "../context/AppContext";
import { Skeleton } from "../components/Skeleton";

export function CustomersTab() {
  const { t } = useTranslation();
  const {
    isAdmin,
    customerList,
    customerListTotal,
    customerListPage,
    customerListSearch,
    setCustomerListSearch,
    isLoadingCustomerList,
    expandedCustomerId,
    setExpandedCustomerId,
    customerMergeSelection,
    setCustomerMergeSelection,
    isMergingCustomers,
    mergeCustomers,
    backfillCustomers,
    loadCustomerList,
    formatStatus,
  } = useAppContext();

  return (
    <div className="admin-tab-content">
      <h3>{t("adminCustomers")}</h3>
      {isAdmin && customerListTotal === 0 && !isLoadingCustomerList && !customerListSearch && (
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
        {isAdmin && customerMergeSelection.size >= 2 && (
          <button
            disabled={isMergingCustomers}
            onClick={() => void mergeCustomers()}
          >
            {isMergingCustomers ? t("loading") : t("mergeSelected", { count: customerMergeSelection.size })}
          </button>
        )}
        {isAdmin && customerMergeSelection.size > 0 && (
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
        <table className="repairs-table customer-list-table">
          <thead>
            <tr>
              {isAdmin && <th className="customer-merge-col"></th>}
              <th>{t("fullName")}</th>
              <th>{t("customerEmail")}</th>
              <th>{t("customerPhone")}</th>
              <th>{t("customerCity")}</th>
              <th>{t("repairs")}</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }, (_, i) => (
              <tr key={i}>
                {isAdmin && (
                  <td className="customer-merge-col">
                    <Skeleton width={16} height={16} />
                  </td>
                )}
                <td><Skeleton width="70%" /></td>
                <td><Skeleton width="60%" /></td>
                <td><Skeleton width="50%" /></td>
                <td><Skeleton width="40%" /></td>
                <td><Skeleton width="1.5rem" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : customerList.length === 0 ? (
        <p className="field-help">{t("customerHistoryNoMatches")}</p>
      ) : (
        <>
          <table className="repairs-table customer-list-table">
            <thead>
              <tr>
                {isAdmin && <th className="customer-merge-col"></th>}
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
                    {isAdmin && (
                      <td className="customer-merge-col">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          aria-label={t("mergeSelected", { count: 1 }) + ": " + nameDisplay}
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
                    )}
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
                              {r.repairNumber !== null
                                ? String(r.repairNumber).padStart(4, "0")
                                : r.publicRef}
                              {" · "}
                              {r.itemName ?? t("noProduct")}
                              {" · "}
                              {formatStatus(r.status, r.notified)}
                              {r.createdDate
                                ? ` · ${new Date(r.createdDate).toLocaleDateString()}`
                                : ""}
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
              >
                &laquo; {t("prevPage")}
              </button>
              <span>
                {t("pageOf", {
                  page: customerListPage,
                  totalPages: Math.ceil(customerListTotal / 25),
                })}
              </span>
              <button
                disabled={customerListPage >= Math.ceil(customerListTotal / 25)}
                onClick={() => void loadCustomerList(customerListSearch, customerListPage + 1)}
              >
                {t("nextPage")} &raquo;
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
