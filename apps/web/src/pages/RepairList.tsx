import { useState, useEffect, useRef } from "react";
import { Skeleton } from "../components/Skeleton";
import { X, Search } from "lucide-react";
import { useAppContext } from "../context/AppContext";

const STATUS_CHIPS = [
  { label: "New", status: "NEW" },
  { label: "In Progress", status: "IN_PROGRESS" },
  { label: "Waiting Parts", status: "WAITING_PARTS" },
  { label: "Ready", status: "READY_FOR_PICKUP" },
  { label: "Notify Customer", status: "NOTIFY_CUSTOMER" },
] as const;

export function RepairList() {
  const {
    t,
    viewMode,
    scope,
    searchText,
    setSearchText,
    sort,
    listFilters,
    isLoading,
    repairs,
    selectedRepairId,
    activeFilterLabel,
    sortIndicator,
    toggleSort,
    loadRepairs,
    openRepairDetail,
    guardUnsavedChanges,
    renderPagination,
    isMobile,
    mobileView,
    handleRepairListKeyNav,
    formatRepairRef,
    statusChipClass,
    formatStatus,
    canToggleCustomerNotified,
    setCustomerNotified,
  } = useAppContext();

  // --- Search-as-you-type with debounce ---
  const [searchDraft, setSearchDraft] = useState(searchText);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep searchDraft in sync when searchText is cleared externally
  useEffect(() => {
    setSearchDraft(searchText);
  }, [searchText]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (searchDraft !== searchText) {
        setSearchText(searchDraft);
        void loadRepairs(scope, searchDraft, 1, sort, viewMode, false, listFilters);
      }
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchDraft]);

  // --- Filter chips ---
  const [activeChipStatus, setActiveChipStatus] = useState<string | null>(null);

  function handleChipClick(status: string) {
    guardUnsavedChanges(() => {
      if (activeChipStatus === status) {
        // Toggle off
        setActiveChipStatus(null);
        void loadRepairs(scope, searchText, 1, sort, viewMode, false, {});
      } else {
        setActiveChipStatus(status);
        void loadRepairs(scope, searchText, 1, sort, viewMode, false, { status });
      }
    });
  }

  function handleChipClear() {
    guardUnsavedChanges(() => {
      setActiveChipStatus(null);
      void loadRepairs(scope, searchText, 1, sort, viewMode, false, {});
    });
  }

  function ariaSortValue(column: string): "ascending" | "descending" | "none" {
    if (sort.sortBy !== column) return "none";
    return sort.sortDir === "asc" ? "ascending" : "descending";
  }

  const showEmptyState = !isLoading && repairs.length === 0;

  return (
    <aside
      className={`card list ${isMobile && mobileView === "detail" ? "mobile-hidden" : ""}${isLoading ? " list-loading-overlay is-loading" : ""}`}
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
            onClick={() => guardUnsavedChanges(() => void loadRepairs(scope, searchText, 1, sort, viewMode, false, {}))}
          >
            {t("clearFilter")}
          </button>
        </div>
      )}

      <div className="search-bar">
        <input
          placeholder={`${t("search")}...`}
          value={searchDraft}
          onChange={(e) => setSearchDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              if (debounceRef.current) clearTimeout(debounceRef.current);
              setSearchText(searchDraft);
              guardUnsavedChanges(() => void loadRepairs(scope, searchDraft, 1, sort, viewMode, false, listFilters));
            }
          }}
        />
        <button
          type="button"
          title={t("clearSearch")}
          aria-label={t("clearSearch")}
          disabled={!searchDraft.trim()}
          onClick={() => guardUnsavedChanges(() => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
            setSearchDraft("");
            setSearchText("");
            void loadRepairs(scope, "", 1, sort, viewMode, false, listFilters);
          })}
        >
          <X size={14} />
        </button>
        <button
          title={t("search")}
          aria-label={t("search")}
          onClick={() => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
            setSearchText(searchDraft);
            guardUnsavedChanges(() => void loadRepairs(scope, searchDraft, 1, sort, viewMode, false, listFilters));
          }}
        >
          <Search size={14} />
        </button>
      </div>

      <div className="filter-chips" role="group" aria-label="Status filters">
        {STATUS_CHIPS.map((chip) => (
          <button
            key={chip.status}
            type="button"
            className={`filter-chip${activeChipStatus === chip.status ? " active" : ""}`}
            onClick={() => handleChipClick(chip.status)}
            aria-pressed={activeChipStatus === chip.status}
          >
            {chip.label}
          </button>
        ))}
        {activeChipStatus && (
          <button
            type="button"
            className="filter-chip filter-chip-clear"
            onClick={handleChipClear}
          >
            Clear
          </button>
        )}
      </div>

      <p className="field-help">{t("listKeyboardHint")}</p>

      {isLoading && (
        <div className="skeleton-table" aria-busy="true">
          <table className="repairs-table" role="presentation">
            <tbody>
              {[1, 2, 3].map((row) => (
                <tr key={row}>
                  <td><Skeleton width="6em" height="1em" /></td>
                  <td><Skeleton width="10em" height="1em" /></td>
                  <td><Skeleton width="5em" height="1em" /></td>
                  <td><Skeleton width="7em" height="1em" /></td>
                  <td><Skeleton width="2em" height="1em" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {renderPagination()}

      {showEmptyState ? (
        <div className="empty-state">
          <p>{t("noRepairsFound") ?? "No repairs found."}</p>
        </div>
      ) : (
        <table className="repairs-table" role="grid">
          <thead>
            <tr>
              <th
                className="sortable"
                onClick={() => toggleSort("repairNumber")}
                aria-sort={ariaSortValue("repairNumber")}
              >
                {t("reference")}{sortIndicator("repairNumber")}
              </th>
              <th
                className="sortable"
                onClick={() => toggleSort("itemName")}
                aria-sort={ariaSortValue("itemName")}
              >
                {t("product")}{sortIndicator("itemName")}
              </th>
              <th
                className="sortable"
                onClick={() => toggleSort("status")}
                aria-sort={ariaSortValue("status")}
              >
                {t("status")}{sortIndicator("status")}
              </th>
              <th
                className="sortable"
                onClick={() => toggleSort("assigned")}
                aria-sort={ariaSortValue("assigned")}
              >
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
                aria-selected={repair.id === selectedRepairId}
                tabIndex={0}
              >
                <td>{formatRepairRef(repair)}</td>
                <td>{repair.itemName ?? t("noProduct")}</td>
                <td>
                  <span className={statusChipClass(repair.status)}>
                    {formatStatus(repair.status, repair.notified ?? false)}
                  </span>
                </td>
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
      )}

      {renderPagination()}
    </aside>
  );
}
