export function AppHeader({ model }: { model: any }) {
  const { view, setView, mobileMenuOpen, setMobileMenuOpen, key, changeMonth, saved, openImport, openExport } = model;
  return (
    <header className="topbar">
    <div className="brand-lockup">
    <span className="brand-mark">SC</span>
    <div>
    <p className="eyebrow">PERSONAL WORK LOG</p>
    <h1>Submission Center</h1>
    </div>
    </div>
    <nav className="primary-nav" aria-label="Primary navigation">
    <button className={view === "dashboard" ? "active" : ""} onClick={() => setView("dashboard")}>
    Dashboard
    </button>
    </nav>
    <nav className="secondary-nav" aria-label="Workspace navigation">
    <button className={view === "days" ? "active" : ""} onClick={() => setView("days")}>
    Day Control
    </button>
    <button className={view === "todos" ? "active" : ""} onClick={() => setView("todos")}>
    To Do List
    </button>
    </nav>
    <button
    className={`mobile-menu-trigger ${mobileMenuOpen ? "is-open" : ""}`}
    type="button"
    aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
    aria-expanded={mobileMenuOpen}
    aria-controls="mobile-navigation"
    onClick={() => setMobileMenuOpen((open) => !open)}
    >
    <span aria-hidden="true" /><span aria-hidden="true" /><span aria-hidden="true" />
    </button>
    {mobileMenuOpen && (
    <aside className="mobile-nav-panel" id="mobile-navigation">
    <nav aria-label="Mobile navigation">
    <button className={view === "dashboard" ? "active" : ""} onClick={() => { setView("dashboard"); setMobileMenuOpen(false); }}>Dashboard</button>
    <button className={view === "days" ? "active" : ""} onClick={() => { setView("days"); setMobileMenuOpen(false); }}>Day Control</button>
    <button className={view === "todos" ? "active" : ""} onClick={() => { setView("todos"); setMobileMenuOpen(false); }}>To Do List</button>
    </nav>
    </aside>
    )}
    <div className="topbar-actions">
    <label className="month-control">
    <span>Month</span>
    <input type="month" value={key} onChange={(event) => changeMonth(event.target.value)} />
    </label>
    {view !== "todos" && <>
    <span className={`save-state ${saved ? "is-saved" : ""}`}>
    <i aria-hidden="true" />{saved ? "Saved on this device" : "Saving…"}
    </span>
    <div className="file-actions">
    <button className="import-trigger" type="button" onClick={openImport}>
    <span aria-hidden="true">↑</span> Import
    </button>
    <button className="export-trigger" type="button" onClick={openExport}>
    <span aria-hidden="true">↓</span> Export
    </button>
    </div>
    </>}
    </div>
    </header>
  );
}

