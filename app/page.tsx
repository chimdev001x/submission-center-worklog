"use client";

import { useEffect, useMemo, useState } from "react";
import { exportExcel, exportPdf } from "./export-utils";

const STATUSES = ["Open", "In Progress", "Passed", "Fail", "Stopper", "Cancel", "Done"] as const;
const ACTIVITIES = ["Retest", "Open", "Meeting", "Create Testcase", "Smoke Test", "E2E", "Review"] as const;
const WORK_MODES = ["Office", "Onsite", "WFH"] as const;

type View = "dashboard" | "days";
type ExportPeriod = "month" | "day" | "range";
type Status = (typeof STATUSES)[number] | "";
type Activity = (typeof ACTIVITIES)[number] | "";
type WorkMode = (typeof WORK_MODES)[number] | "";
type Task = { id: string; activity: Activity; link: string; results: string; status: Status; remark: string };
type DayRecord = { enabled: boolean; workMode: WorkMode; tasks: Task[] };
type MonthData = Record<number, DayRecord>;

const statusClass: Record<string, string> = {
  Open: "status-open",
  "In Progress": "status-progress",
  Passed: "status-passed",
  Fail: "status-fail",
  Stopper: "status-stopper",
  Cancel: "status-cancel",
  Done: "status-done",
};

const makeTask = (): Task => ({
  id: crypto.randomUUID(), activity: "", link: "", results: "", status: "", remark: "",
});

const createMonth = (days: number): MonthData =>
  Object.fromEntries(Array.from({ length: days }, (_, index) => [
    index + 1,
    { enabled: true, workMode: "", tasks: [makeTask(), makeTask(), makeTask()] },
  ]));

const monthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
const daysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();

export default function Home() {
  const [view, setView] = useState<View>("dashboard");
  const [month, setMonth] = useState(() => new Date(2026, 6, 1));
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [data, setData] = useState<MonthData>(() => createMonth(31));
  const [hydrated, setHydrated] = useState(false);
  const [saved, setSaved] = useState(true);
  const [addCount, setAddCount] = useState("1");
  const [exportOpen, setExportOpen] = useState(false);
  const [exportPeriod, setExportPeriod] = useState<ExportPeriod>("month");
  const [exportDay, setExportDay] = useState(1);
  const [exportEndDay, setExportEndDay] = useState(1);
  const [exportDashboard, setExportDashboard] = useState(true);
  const [exportEntries, setExportEntries] = useState(true);
  const [exporting, setExporting] = useState<"excel" | "pdf" | null>(null);
  const [exportError, setExportError] = useState("");

  const key = monthKey(month);
  const totalDays = daysInMonth(month);

  useEffect(() => {
    const stored = localStorage.getItem(`submission-center:${key}`);
    setData(stored ? JSON.parse(stored) : createMonth(totalDays));
    setSelectedDay(null);
    setHydrated(true);
    setSaved(true);
  }, [key, totalDays]);

  useEffect(() => {
    if (!hydrated) return;
    setSaved(false);
    const timer = window.setTimeout(() => {
      localStorage.setItem(`submission-center:${key}`, JSON.stringify(data));
      setSaved(true);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [data, hydrated, key]);

  const counts = useMemo(() => {
    const next = Object.fromEntries(STATUSES.map((status) => [status, 0])) as Record<(typeof STATUSES)[number], number>;
    let total = 0;
    Object.values(data).forEach((day) => {
      if (!day.enabled) return;
      day.tasks.forEach((task) => {
        if (!task.link.trim()) return;
        total += 1;
        if (task.status) next[task.status] += 1;
      });
    });
    return { total, ...next };
  }, [data]);

  const dailyTotals = useMemo(() =>
    Array.from({ length: totalDays }, (_, index) => {
      const day = data[index + 1];
      return day?.enabled ? day.tasks.filter((task) => task.link.trim()).length : 0;
    }), [data, totalDays]);

  const maxDaily = Math.max(...dailyTotals, 1);
  const current = selectedDay ? data[selectedDay] : null;
  const monthLabel = month.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const fullDate = selectedDay ? new Date(month.getFullYear(), month.getMonth(), selectedDay) : null;

  const updateDay = (day: number, patch: Partial<DayRecord>) =>
    setData((value) => ({ ...value, [day]: { ...value[day], ...patch } }));

  const updateTask = (id: string, field: keyof Task, value: string) => {
    if (!selectedDay || !current) return;
    updateDay(selectedDay, {
      tasks: current.tasks.map((task) => task.id === id ? { ...task, [field]: value } : task),
    });
  };

  const removeTask = (id: string) => {
    if (!selectedDay || !current) return;
    updateDay(selectedDay, { tasks: current.tasks.filter((task) => task.id !== id) });
  };

  const changeMonth = (value: string) => {
    const [year, monthNumber] = value.split("-").map(Number);
    setHydrated(false);
    setMonth(new Date(year, monthNumber - 1, 1));
  };

  const addRows = () => {
    if (!selectedDay || !current) return;
    const parsedCount = Number(addCount);
    const safeCount = Math.min(100, Math.max(1, Number.isFinite(parsedCount) ? Math.floor(parsedCount) : 1));
    updateDay(selectedDay, {
      tasks: [...current.tasks, ...Array.from({ length: safeCount }, () => makeTask())],
    });
    setAddCount(String(safeCount));
  };

  const openExport = () => {
    const day = selectedDay || 1;
    setExportDay(day);
    setExportEndDay(day);
    setExportPeriod(view === "days" && selectedDay ? "day" : "month");
    setExportDashboard(view === "dashboard");
    setExportEntries(true);
    setExportError("");
    setExportOpen(true);
  };

  const runExport = async (format: "excel" | "pdf") => {
    if (!exportDashboard && !exportEntries) return;
    setExporting(format);
    setExportError("");
    try {
      const payload = {
        month,
        period: exportPeriod,
        day: exportDay,
        endDay: exportEndDay,
        includeDashboard: exportDashboard,
        includeEntries: exportEntries,
        days: data,
        statuses: STATUSES,
      };
      if (format === "excel") await exportExcel(payload);
      else await exportPdf(payload);
      setExportOpen(false);
    } catch {
      setExportError("สร้างไฟล์ไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      setExporting(null);
    }
  };

  return (
    <main className="app-shell">
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
          <button className={view === "days" ? "active" : ""} onClick={() => setView("days")}>
            Day Control
          </button>
        </nav>
        <div className="topbar-actions">
          <label className="month-control">
            <span>Month</span>
            <input type="month" value={key} onChange={(event) => changeMonth(event.target.value)} />
          </label>
          <span className={`save-state ${saved ? "is-saved" : ""}`}>
            <i aria-hidden="true" />{saved ? "Saved on this device" : "Saving…"}
          </span>
          <button className="export-trigger" type="button" onClick={openExport}>
            <span aria-hidden="true">↓</span> Export
          </button>
        </div>
      </header>

      {view === "dashboard" ? (
        <div className="page-view dashboard-view">
          <section className="page-intro">
            <div>
              <p className="section-kicker">{monthLabel}</p>
              <h2>Monthly dashboard</h2>
              <p>ภาพรวมผลการตรวจสอบและปริมาณงานในแต่ละวัน</p>
            </div>
            <div className="headline-total">
              <span>Total items</span><strong>{counts.total}</strong>
            </div>
          </section>

          <section className="status-ledger" aria-label="Status summary">
            {STATUSES.map((status) => (
              <div className={`status-count ${statusClass[status]}`} key={status}>
                <span>{status}</span><strong>{counts[status]}</strong>
              </div>
            ))}
          </section>

          <section className="month-chart" aria-labelledby="month-chart-title">
            <div className="chart-heading">
              <div>
                <p className="section-kicker">DAILY VOLUME</p>
                <h2 id="month-chart-title">Items by day</h2>
              </div>
              <button className="text-action" onClick={() => setView("days")}>Manage working days →</button>
            </div>
            <div className="bar-field">
              {dailyTotals.map((total, index) => (
                <button
                  className={!data[index + 1]?.enabled ? "is-disabled" : ""}
                  key={index}
                  onClick={() => { setSelectedDay(index + 1); setView("days"); }}
                  aria-label={`Day ${index + 1}, ${total} items`}
                >
                  <i style={{ height: `${Math.max(total ? 10 : 2, (total / maxDaily) * 100)}%` }} />
                  <span>{index + 1}</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      ) : (
        <div className="page-view day-control-view">
          <section className="calendar-panel">
            <div className="panel-heading">
              <div>
                <p className="section-kicker">{monthLabel}</p>
                <h2>Choose a working day</h2>
                <p className="panel-note">เลือกวันก่อน แล้วกำหนดว่าใช้งานหรือไม่ใช้งาน</p>
              </div>
              {selectedDay && current && (
                <div className="use-control">
                  <span>Day status</span>
                  <div className="use-toggle" role="group" aria-label="Day status">
                    <button
                      type="button"
                      className={current.enabled ? "active use" : ""}
                      onClick={() => updateDay(selectedDay, { enabled: true })}
                    >Use</button>
                    <button
                      type="button"
                      className={!current.enabled ? "active not-use" : ""}
                      onClick={() => updateDay(selectedDay, { enabled: false })}
                    >Not Use</button>
                  </div>
                </div>
              )}
            </div>

            <div className="day-grid" role="list" aria-label={`Days in ${monthLabel}`}>
              {Array.from({ length: totalDays }, (_, index) => {
                const dayNumber = index + 1;
                const record = data[dayNumber];
                const isSelected = selectedDay === dayNumber;
                const isEnabled = record?.enabled ?? true;
                const itemCount = dailyTotals[index];
                return (
                  <button
                    type="button"
                    className={`day-cell ${isSelected ? "is-selected" : ""} ${!isEnabled ? "is-disabled" : ""}`}
                    onClick={() => setSelectedDay(dayNumber)}
                    key={dayNumber}
                    role="listitem"
                    aria-pressed={isSelected}
                  >
                    <span className="day-number">{String(dayNumber).padStart(2, "0")}</span>
                    <span className="day-meta">{isEnabled ? `${itemCount} item${itemCount === 1 ? "" : "s"}` : "Not in use"}</span>
                    <span className="day-bar" aria-hidden="true"><i style={{ width: `${(itemCount / maxDaily) * 100}%` }} /></span>
                  </button>
                );
              })}
            </div>
          </section>

          {!selectedDay || !current ? (
            <section className="selection-empty" aria-live="polite">
              <span>01—31</span>
              <div>
                <h2>Select a day to continue</h2>
                <p>เลือกวันจากปฏิทินด้านบนเพื่อกำหนด Use / Not Use และเริ่มกรอกงาน</p>
              </div>
            </section>
          ) : current.enabled ? (
            <>
              <section className="day-context">
                <div>
                  <p className="section-kicker">DAY {String(selectedDay).padStart(2, "0")}</p>
                  <h2>{fullDate?.toLocaleDateString("en-US", { weekday: "long", day: "2-digit", month: "long" })}</h2>
                </div>
                <fieldset className="work-mode-picker">
                  <legend>Work mode</legend>
                  <div>
                    {WORK_MODES.map((mode) => (
                      <label key={mode}>
                        <input
                          type="radio"
                          name={`work-mode-${selectedDay}`}
                          value={mode}
                          checked={current.workMode === mode}
                          onChange={() => updateDay(selectedDay, { workMode: mode })}
                        />
                        <span className="choice-box" aria-hidden="true" />
                        <span>{mode}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div className="day-stat"><span>Items logged</span><strong>{dailyTotals[selectedDay - 1]}</strong></div>
              </section>

              <section className="task-section" aria-labelledby="task-title">
                <div className="task-heading">
                  <div><p className="section-kicker">DAILY SUBMISSION</p><h2 id="task-title">Work entries</h2></div>
                  <div className="add-row-control">
                    <label>
                      <span>Rows</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={addCount}
                        onFocus={(event) => event.currentTarget.select()}
                        onChange={(event) => {
                          const next = event.target.value.replace(/\D/g, "").slice(0, 3);
                          setAddCount(next);
                        }}
                        onBlur={() => {
                          const parsed = Number(addCount);
                          setAddCount(String(Math.min(100, Math.max(1, parsed || 1))));
                        }}
                        aria-label="Number of rows to add"
                      />
                    </label>
                    <button className="add-button" type="button" onClick={addRows}>
                      <span aria-hidden="true">＋</span> Add {addCount === "1" ? "row" : "rows"}
                    </button>
                  </div>
                </div>
                <div className="task-table-wrap">
                  <table className="task-table">
                    <thead><tr><th>No.</th><th>Activity</th><th>Link Plane</th><th>Results</th><th>Status</th><th>Remark</th><th><span className="sr-only">Actions</span></th></tr></thead>
                    <tbody>
                      {current.tasks.map((task, index) => (
                        <tr key={task.id}>
                          <td className="row-number" data-label="Entry">{String(index + 1).padStart(2, "0")}</td>
                          <td data-label="Activity"><select aria-label={`Activity row ${index + 1}`} value={task.activity} onChange={(event) => updateTask(task.id, "activity", event.target.value)}><option value="">Select</option>{ACTIVITIES.map((activity) => <option key={activity}>{activity}</option>)}</select></td>
                          <td data-label="Link Plane"><input aria-label={`Link Plane row ${index + 1}`} value={task.link} onChange={(event) => updateTask(task.id, "link", event.target.value)} placeholder="https://…" /></td>
                          <td data-label="Results"><input aria-label={`Results row ${index + 1}`} value={task.results} onChange={(event) => updateTask(task.id, "results", event.target.value)} placeholder="Result or evidence" /></td>
                          <td data-label="Status"><select aria-label={`Status row ${index + 1}`} className={task.status ? statusClass[task.status] : ""} value={task.status} onChange={(event) => updateTask(task.id, "status", event.target.value)}><option value="">Select status</option>{STATUSES.map((status) => <option key={status}>{status}</option>)}</select></td>
                          <td data-label="Remark"><input aria-label={`Remark row ${index + 1}`} value={task.remark} onChange={(event) => updateTask(task.id, "remark", event.target.value)} placeholder="Add a note" /></td>
                          <td className="row-action"><button className="remove-button" type="button" aria-label={`Remove row ${index + 1}`} onClick={() => removeTask(task.id)} disabled={current.tasks.length === 1}>×</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          ) : (
            <section className="closed-day" role="status">
              <span>NOT IN USE</span>
              <div>
                <p className="section-kicker">DAY {String(selectedDay).padStart(2, "0")}</p>
                <h2>This day is closed</h2>
                <p>วันดังกล่าวจะไม่ถูกนำไปคำนวณใน Dashboard เปลี่ยนเป็น Use ที่มุมขวาเพื่อเปิด Work Entries</p>
              </div>
            </section>
          )}
        </div>
      )}

      {exportOpen && (
        <div className="export-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.currentTarget === event.target && !exporting) setExportOpen(false);
        }}>
          <section className="export-dialog" role="dialog" aria-modal="true" aria-labelledby="export-title">
            <div className="export-heading">
              <div>
                <p className="section-kicker">{monthLabel}</p>
                <h2 id="export-title">Export data</h2>
                <p>เลือกช่วงข้อมูลและรูปแบบไฟล์ที่ต้องการดาวน์โหลด</p>
              </div>
              <button
                className="dialog-close"
                type="button"
                aria-label="Close export dialog"
                onClick={() => setExportOpen(false)}
                disabled={Boolean(exporting)}
              >×</button>
            </div>

            <div className="export-options">
              <fieldset>
                <legend>Period</legend>
                <div className="export-choice-grid">
                  <label>
                    <input type="radio" name="export-period" checked={exportPeriod === "month"} onChange={() => setExportPeriod("month")} />
                    <span><strong>Whole month</strong><small>{monthLabel}</small></span>
                  </label>
                  <label>
                    <input type="radio" name="export-period" checked={exportPeriod === "day"} onChange={() => setExportPeriod("day")} />
                    <span><strong>Single day</strong><small>เฉพาะวันที่เลือก</small></span>
                  </label>
                  <label>
                    <input type="radio" name="export-period" checked={exportPeriod === "range"} onChange={() => setExportPeriod("range")} />
                    <span><strong>Date range</strong><small>เลือกวันเริ่มต้นถึงวันสิ้นสุด</small></span>
                  </label>
                </div>
              </fieldset>

              {exportPeriod !== "month" && (
                <div className={`export-date-fields ${exportPeriod === "day" ? "is-single" : ""}`}>
                  <label className="export-day-select">
                    <span>{exportPeriod === "range" ? "From" : "Choose day"}</span>
                    <input
                      type="date"
                      min={`${key}-01`}
                      max={`${key}-${String(totalDays).padStart(2, "0")}`}
                      value={`${key}-${String(exportDay).padStart(2, "0")}`}
                      onChange={(event) => {
                        const next = Number(event.target.value.slice(-2));
                        setExportDay(next);
                        if (next > exportEndDay) setExportEndDay(next);
                      }}
                    />
                  </label>
                  {exportPeriod === "range" && (
                    <label className="export-day-select">
                      <span>To</span>
                      <input
                        type="date"
                        min={`${key}-${String(exportDay).padStart(2, "0")}`}
                        max={`${key}-${String(totalDays).padStart(2, "0")}`}
                        value={`${key}-${String(exportEndDay).padStart(2, "0")}`}
                        onChange={(event) => setExportEndDay(Number(event.target.value.slice(-2)))}
                      />
                    </label>
                  )}
                </div>
              )}

              <fieldset>
                <legend>Include</legend>
                <div className="export-section-grid">
                  {view === "dashboard" && (
                    <label>
                      <input type="checkbox" checked={exportDashboard} onChange={(event) => setExportDashboard(event.target.checked)} />
                      <span><strong>Dashboard summary</strong><small>ยอดรวม สถานะ และข้อมูลรายวัน</small></span>
                    </label>
                  )}
                  <label>
                    <input type="checkbox" checked={exportEntries} onChange={(event) => setExportEntries(event.target.checked)} />
                    <span><strong>Work entries</strong><small>รายละเอียด Activity, Link, Results และ Status</small></span>
                  </label>
                </div>
              </fieldset>
            </div>

            <div className="export-footer">
              <p className={exportError ? "export-error" : ""} role={exportError ? "alert" : undefined}>
                {exportError || "Excel และ PDF จะจัดหน้าแบบแนวนอน พร้อมตัดหน้าระหว่างแถวเพื่อไม่ให้ข้อมูลขาดครึ่ง"}
              </p>
              <div>
                <button className="secondary-button" type="button" onClick={() => runExport("pdf")} disabled={Boolean(exporting) || (!exportDashboard && !exportEntries)}>
                  {exporting === "pdf" ? "Creating PDF…" : "Export PDF"}
                </button>
                <button className="add-button" type="button" onClick={() => runExport("excel")} disabled={Boolean(exporting) || (!exportDashboard && !exportEntries)}>
                  {exporting === "excel" ? "Creating Excel…" : "Export Excel"}
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      <footer><span>Submission Center</span><span>ข้อมูลเก็บไว้ในเบราว์เซอร์ของอุปกรณ์นี้</span></footer>
    </main>
  );
}
