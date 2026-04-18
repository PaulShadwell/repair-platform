import { useTranslation } from "react-i18next";

interface UserGuideProps {
  onClose: () => void;
}

export default function UserGuide({ onClose }: UserGuideProps) {
  const { t } = useTranslation();

  function scrollToSection(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    const id = e.currentTarget.getAttribute("href")?.slice(1);
    if (id) document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <section className="user-guide">
      <div className="user-guide-header">
        <h2>{t("helpTitle")}</h2>
        <div className="user-guide-header-actions">
          <button type="button" className="btn-primary" onClick={() => window.print()}>
            {t("helpPrint")}
          </button>
          <button type="button" onClick={onClose}>{t("close")}</button>
        </div>
      </div>

      <div className="user-guide-body">
        <p className="user-guide-intro">{t("helpIntro")}</p>

        <nav className="user-guide-toc">
          <h3>{t("helpTocTitle")}</h3>
          <ol>
            <li><a href="#guide-getting-started" onClick={scrollToSection}>{t("helpGettingStarted")}</a></li>
            <li><a href="#guide-navigation" onClick={scrollToSection}>{t("helpNavigation")}</a></li>
            <li><a href="#guide-creating-repair" onClick={scrollToSection}>{t("helpCreatingRepair")}</a></li>
            <li><a href="#guide-repair-list" onClick={scrollToSection}>{t("helpRepairList")}</a></li>
            <li><a href="#guide-repair-detail" onClick={scrollToSection}>{t("helpRepairDetail")}</a></li>
            <li><a href="#guide-photos" onClick={scrollToSection}>{t("helpPhotos")}</a></li>
            <li><a href="#guide-materials" onClick={scrollToSection}>{t("helpMaterials")}</a></li>
            <li><a href="#guide-customers" onClick={scrollToSection}>{t("helpCustomers")}</a></li>
            <li><a href="#guide-statuses" onClick={scrollToSection}>{t("helpStatuses")}</a></li>
            <li><a href="#guide-dashboard" onClick={scrollToSection}>{t("helpDashboard")}</a></li>
            <li><a href="#guide-user-management" onClick={scrollToSection}>{t("helpUserMgmt")}</a></li>
            <li><a href="#guide-inventory" onClick={scrollToSection}>{t("helpInventory")}</a></li>
            <li><a href="#guide-csv-export" onClick={scrollToSection}>{t("helpCsvExport")}</a></li>
            <li><a href="#guide-settings" onClick={scrollToSection}>{t("helpSettings")}</a></li>
            <li><a href="#guide-roles" onClick={scrollToSection}>{t("helpRoles")}</a></li>
            <li><a href="#guide-tips" onClick={scrollToSection}>{t("helpTips")}</a></li>
          </ol>
        </nav>

        <article id="guide-getting-started">
          <h3>1. {t("helpGettingStarted")}</h3>
          <p>{t("helpGettingStartedP1")}</p>
          <p>{t("helpGettingStartedP2")}</p>
        </article>

        <article id="guide-navigation">
          <h3>2. {t("helpNavigation")}</h3>
          <p>{t("helpNavigationP1")}</p>
          <dl className="user-guide-dl">
            <div><dt>{t("home")}</dt><dd>{t("helpNavHome")}</dd></div>
            <div><dt>{t("myRepairs")}</dt><dd>{t("helpNavMyRepairs")}</dd></div>
            <div><dt>{t("allRepairs")}</dt><dd>{t("helpNavAllRepairs")}</dd></div>
            <div><dt>{t("archivedItems")}</dt><dd>{t("helpNavArchived")}</dd></div>
            <div><dt>{t("adminDashboard")}</dt><dd>{t("helpNavDashboard")}</dd></div>
            <div><dt>{t("adminAddRepair")}</dt><dd>{t("helpNavAddRepair")}</dd></div>
            <div><dt>{t("manageUsers")}</dt><dd>{t("helpNavManageUsers")}</dd></div>
            <div><dt>{t("adminCustomers")}</dt><dd>{t("helpNavCustomers")}</dd></div>
            <div><dt>{t("inventorySection")}</dt><dd>{t("helpNavInventory")}</dd></div>
            <div><dt>{t("suppliersSection")}</dt><dd>{t("helpNavSuppliers")}</dd></div>
            <div><dt>{t("exportCsv")}</dt><dd>{t("helpNavExportCsv")}</dd></div>
          </dl>
          <p>{t("helpNavigationP2")}</p>
        </article>

        <article id="guide-creating-repair">
          <h3>3. {t("helpCreatingRepair")}</h3>
          <p>{t("helpCreatingRepairP1")}</p>
          <h4>{t("helpCreatingRepairCustomer")}</h4>
          <p>{t("helpCreatingRepairCustomerP1")}</p>
          <ul>
            <li>{t("helpCreatingRepairCustomerL1")}</li>
            <li>{t("helpCreatingRepairCustomerL2")}</li>
            <li>{t("helpCreatingRepairCustomerL3")}</li>
          </ul>
          <h4>{t("helpCreatingRepairRepair")}</h4>
          <p>{t("helpCreatingRepairRepairP1")}</p>
          <p>{t("helpCreatingRepairMandatory")}</p>
        </article>

        <article id="guide-repair-list">
          <h3>4. {t("helpRepairList")}</h3>
          <p>{t("helpRepairListP1")}</p>
          <ul>
            <li>{t("helpRepairListL1")}</li>
            <li>{t("helpRepairListL2")}</li>
            <li>{t("helpRepairListL3")}</li>
            <li>{t("helpRepairListL4")}</li>
          </ul>
        </article>

        <article id="guide-repair-detail">
          <h3>5. {t("helpRepairDetail")}</h3>
          <p>{t("helpRepairDetailP1")}</p>
          <h4>{t("helpRepairDetailIntake")}</h4>
          <p>{t("helpRepairDetailIntakeP1")}</p>
          <h4>{t("helpRepairDetailOutcome")}</h4>
          <p>{t("helpRepairDetailOutcomeP1")}</p>
          <h4>{t("helpRepairDetailAssign")}</h4>
          <p>{t("helpRepairDetailAssignP1")}</p>
          <h4>{t("helpRepairDetailHistory")}</h4>
          <p>{t("helpRepairDetailHistoryP1")}</p>
        </article>

        <article id="guide-photos">
          <h3>6. {t("helpPhotos")}</h3>
          <p>{t("helpPhotosP1")}</p>
          <ul>
            <li>{t("helpPhotosL1")}</li>
            <li>{t("helpPhotosL2")}</li>
            <li>{t("helpPhotosL3")}</li>
          </ul>
        </article>

        <article id="guide-materials">
          <h3>7. {t("helpMaterials")}</h3>
          <p>{t("helpMaterialsP1")}</p>
          <ul>
            <li>{t("helpMaterialsL1")}</li>
            <li>{t("helpMaterialsL2")}</li>
            <li>{t("helpMaterialsL3")}</li>
            <li>{t("helpMaterialsL4")}</li>
          </ul>
        </article>

        <article id="guide-customers">
          <h3>8. {t("helpCustomers")}</h3>
          <p>{t("helpCustomersP1")}</p>
          <ul>
            <li>{t("helpCustomersL1")}</li>
            <li>{t("helpCustomersL2")}</li>
            <li>{t("helpCustomersL3")}</li>
          </ul>
        </article>

        <article id="guide-statuses">
          <h3>9. {t("helpStatuses")}</h3>
          <p>{t("helpStatusesP1")}</p>
          <dl className="user-guide-dl status-list">
            <div><dt>{t("statusNew")}</dt><dd>{t("helpStatusNew")}</dd></div>
            <div><dt>{t("statusInProgress")}</dt><dd>{t("helpStatusInProgress")}</dd></div>
            <div><dt>{t("statusWaitingParts")}</dt><dd>{t("helpStatusWaitingParts")}</dd></div>
            <div><dt>{t("statusNotifyCustomer")}</dt><dd>{t("helpStatusNotifyCustomer")}</dd></div>
            <div><dt>{t("statusReadyForPickup")}</dt><dd>{t("helpStatusReadyForPickup")}</dd></div>
            <div><dt>{t("statusCompleted")}</dt><dd>{t("helpStatusCompleted")}</dd></div>
            <div><dt>{t("statusCancelled")}</dt><dd>{t("helpStatusCancelled")}</dd></div>
          </dl>
        </article>

        <article id="guide-dashboard">
          <h3>10. {t("helpDashboard")}</h3>
          <p>{t("helpDashboardP1")}</p>
          <p>{t("helpDashboardP2")}</p>
        </article>

        <article id="guide-user-management">
          <h3>11. {t("helpUserMgmt")}</h3>
          <p>{t("helpUserMgmtP1")}</p>
          <ul>
            <li>{t("helpUserMgmtL1")}</li>
            <li>{t("helpUserMgmtL2")}</li>
            <li>{t("helpUserMgmtL3")}</li>
            <li>{t("helpUserMgmtL4")}</li>
            <li>{t("helpUserMgmtL5")}</li>
          </ul>
        </article>

        <article id="guide-inventory">
          <h3>12. {t("helpInventory")}</h3>
          <p>{t("helpInventoryP1")}</p>
          <p>{t("helpInventoryP2")}</p>
        </article>

        <article id="guide-csv-export">
          <h3>13. {t("helpCsvExport")}</h3>
          <p>{t("helpCsvExportP1")}</p>
        </article>

        <article id="guide-settings">
          <h3>14. {t("helpSettings")}</h3>
          <p>{t("helpSettingsP1")}</p>
          <ul>
            <li>{t("helpSettingsL1")}</li>
            <li>{t("helpSettingsL2")}</li>
          </ul>
        </article>

        <article id="guide-roles">
          <h3>15. {t("helpRoles")}</h3>
          <p>{t("helpRolesP1")}</p>
          <table className="user-guide-table">
            <thead>
              <tr>
                <th>{t("helpRoleCol")}</th>
                <th>{t("helpRoleViewRepairs")}</th>
                <th>{t("helpRoleCreate")}</th>
                <th>{t("helpRoleAssign")}</th>
                <th>{t("helpRolePrint")}</th>
                <th>{t("helpRoleEditPOS")}</th>
                <th>{t("helpRoleEditRepair")}</th>
                <th>{t("helpRoleManageUsers")}</th>
                <th>{t("helpRoleDelete")}</th>
                <th>{t("helpRoleArchived")}</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>Admin</td><td>&#10003;</td><td>&#10003;</td><td>&#10003;</td><td>&#10003;</td><td>&#10003;</td><td>&#10003;</td><td>&#10003;</td><td>&#10003;</td><td>&#10003;</td></tr>
              <tr><td>Supervisor</td><td>&#10003;</td><td>&#10003;</td><td>&#10003;</td><td>&#10003;</td><td>&#10003;</td><td>&#10003;</td><td>&#10003;</td><td>&ndash;</td><td>&ndash;</td></tr>
              <tr><td>POS User</td><td>&#10003;</td><td>&#10003;</td><td>&#10003;</td><td>&#10003;</td><td>&#10003;</td><td>&ndash;</td><td>&ndash;</td><td>&ndash;</td><td>&ndash;</td></tr>
              <tr><td>Repairer</td><td>&#10003;</td><td>&ndash;</td><td>&#10003;</td><td>&#10003;</td><td>&ndash;</td><td>&#10003;</td><td>&ndash;</td><td>&ndash;</td><td>&ndash;</td></tr>
            </tbody>
          </table>
          <p>{t("helpRolesP2")}</p>
        </article>

        <article id="guide-tips">
          <h3>16. {t("helpTips")}</h3>
          <ul>
            <li>{t("helpTipsL1")}</li>
            <li>{t("helpTipsL2")}</li>
            <li>{t("helpTipsL3")}</li>
            <li>{t("helpTipsL4")}</li>
            <li>{t("helpTipsL5")}</li>
            <li>{t("helpTipsL6")}</li>
          </ul>
        </article>
      </div>
    </section>
  );
}
