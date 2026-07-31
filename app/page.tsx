"use client";

import { useEffect, useMemo, useState } from "react";

const STATUSES = ["Open", "In Progress", "Passed", "Fail", "Stopper", "Cancel", "Done"] as const;
const ACTIVITIES = ["Retest", "Open", "Meeting", "Create Testcase", "Smoke Test", "E2E", "Review"] as const;
const WORK_MODES = ["Office", "Onsite", "WFH"] as const;

type Status = (typeof STATUSES)[number] | "";
type Activity = (typeof ACTIVITIES)[number] | "";
type WorkMode = (typeof WORK_MODES)[number] | "";

type Task = {
  id: string;
  activity: Activity;
  link: string;
  results: string;
  status: Status;
  remark: string;
};

type DayRecord = {
  enabled: boolean;
  workMode: WorkMode;
  tasks: Task[];
};

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
  id: crypto.randomUUID(),
  activity: "",
  link: "",
  results: "",
  status: "",
  remark: "",
});

const createMonth = (days: number): MonthData =>
  Object.fromEntries(
    Array.from({ length: days }, (_, index) => [
      index + 1,
      { enabled: true, workMode: "", tasks: [makeTask(), makeTask(), makeTask()] },
    ]),
  );

const monthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
const daysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();

export default function Home() {
  const [month, setMonth] = useState(() => new Date(2026, 6, 1));
  const [selectedDay, setSelectedDay] = useState(1);
  const [data, setData] = useState<MonthData>(() => createMonth(31));
  const [hydrated, setHydrated] = useState(false);
  const [saved, setSaved] = useState(true);

  const key = monthKey(month);
  const totalDays = daysInMonth(month);

  useEffect(() => {
    const stored = localStorage.getItem(`submission-center:${key}`);
    setData(stored ? JSON.parse(stored) : createMonth(totalDays));
    setSelectedDay((day) => Math.min(day, totalDays));
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

  const dailyTotals = useMemo(
    () =>
      Array.from({ length: totalDays }, (_, index) => {
        const day = data[index + 1];
        return day?.enabled ? day.tasks.filter((task) => task.link.trim()).length : 0;
      }),
    [data, totalDays],
  );

  const maxDaily = Math.max(...dailyTotals, 1);
  const current = data[selectedDay] ?? { enabled: true, workMode: "", tasks: [] };
  const monthLabel = month.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const fullDate = new Date(month.getFullYear(), month.getMonth(), selectedDay);

  const updateDay = (day: number, patch: Partial<DayRecord>) =>
    setData((value) => ({ ...value, [day]: { ...value[day], ...patch } }));

  const updateTask = (id: string, field: keyof Task, value: string) =>
    updateDay(selectedDay, {
      tasks: current.tasks.map((task) => (task.id === id ? { ...task, [field]: value } : task)),
    });

  const removeTask = (id: string) =>
    updateDay(selectedDay, { tasks: current.tasks.filter((task) => task.id !== id) });

  const changeMonth = (value: string) => {
    const [year, monthNumber] = value.split("-").map(Number);
    setHydrated(false);
    setMonth(new Date(year, monthNumber - 1, 1));
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
        <div className="topbar-actions">
          <label className="month-control">
            <span>Month</span>
            <input type="month" value={key} onChange={(event) => changeMonth(event.target.value)} />
          </label>
          <span className={`save-state ${saved ? "is-saved" : ""}`}>
            <i aria-hidden="true" />
            {saved ? "Saved on this device" : "Saving…"}
          </span>
        </div>
      </header>

      <section className="overview" aria-labelledby="overview-title">
        <div className="overview-copy">
          <p className="section-kicker">{monthLabel}</p>
          <h2 id="overview-title">Monthly pulse</h2>
          <p>ภาพรวมงานตรวจสอบ พร้อมสถานะของแต่ละวันในเดือนนี้</p>
        </div>
        <div className="headline-total">
          <span>Total items</span>
          <strong>{counts.total}</strong>
        </div>
        <div className="status-ledger" aria-label="Status summary">
          {STATUSES.map((status) => (
            <div className={`status-count ${statusClass[status]}`} key={status}>
              <span>{status}</span>
              <strong>{counts[status]}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="monthly-workspace">
        <div className="calendar-panel">
          <div className="panel-heading">
            <div>
              <p className="section-kicker">DAY CONTROL</p>
              <h2>Choose a working day</h2>
            </div>
            <p className="panel-note">⛔️ Not Use จะปิดการกรอกของวันนั้นและไม่นับในรายงาน</p>
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
                  <span className="day-bar" aria-hidden="true">
                    <i style={{ width: `${(itemCount / maxDaily) * 100}%` }} />
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <aside className="day-settings" aria-labelledby="day-settings-title">
          <p className="section-kicker">DAY {String(selectedDay).padStart(2, "0")}</p>
          <h2 id="day-settings-title">
            {fullDate.toLocaleDateString("en-US", { weekday: "long", day: "2-digit", month: "long" })}
          </h2>
          <div className="use-toggle" role="group" aria-label="Use day">
            <button
              type="button"
              className={current.enabled ? "active use" : ""}
              onClick={() => updateDay(selectedDay, { enabled: true })}
            >
              ✅ Use
            </button>
            <button
              type="button"
              className={!current.enabled ? "active not-use" : ""}
              onClick={() => updateDay(selectedDay, { enabled: false })}
            >
              ⛔️ Not Use
            </button>
          </div>
          <label className="field-label">
            <span>Work mode</span>
            <select
              value={current.workMode}
              onChange={(event) => updateDay(selectedDay, { workMode: event.target.value as WorkMode })}
              disabled={!current.enabled}
            >
              <option value="">Select location</option>
              {WORK_MODES.map((mode) => <option key={mode}>{mode}</option>)}
            </select>
          </label>
          <div className="day-stat">
            <span>Items logged</span>
            <strong>{dailyTotals[selectedDay - 1]}</strong>
          </div>
          {!current.enabled && (
            <div className="disabled-note" role="status">
              <strong>This day is closed.</strong>
              <span>เลือก ✅ Use เพื่อเปิดช่องกรอกข้อมูลอีกครั้ง</span>
            </div>
          )}
        </aside>
      </section>

      <section className={`task-section ${!current.enabled ? "is-locked" : ""}`} aria-labelledby="task-title">
        <div className="task-heading">
          <div>
            <p className="section-kicker">DAILY SUBMISSION</p>
            <h2 id="task-title">Work entries</h2>
          </div>
          <button
            className="add-button"
            type="button"
            onClick={() => updateDay(selectedDay, { tasks: [...current.tasks, makeTask()] })}
            disabled={!current.enabled}
          >
            <span aria-hidden="true">＋</span> Add row
          </button>
        </div>

        <div className="task-table-wrap">
          <table className="task-table">
            <thead>
              <tr>
                <th>No.</th>
                <th>Activity</th>
                <th>Link Plane</th>
                <th>Results</th>
                <th>Status</th>
                <th>Remark</th>
                <th><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {current.tasks.map((task, index) => (
                <tr key={task.id}>
                  <td className="row-number">{String(index + 1).padStart(2, "0")}</td>
                  <td>
                    <select
                      aria-label={`Activity row ${index + 1}`}
                      value={task.activity}
                      onChange={(event) => updateTask(task.id, "activity", event.target.value)}
                      disabled={!current.enabled}
                    >
                      <option value="">Select</option>
                      {ACTIVITIES.map((activity) => <option key={activity}>{activity}</option>)}
                    </select>
                  </td>
                  <td>
                    <input
                      aria-label={`Link Plane row ${index + 1}`}
                      value={task.link}
                      onChange={(event) => updateTask(task.id, "link", event.target.value)}
                      placeholder="https://…"
                      disabled={!current.enabled}
                    />
                  </td>
                  <td>
                    <input
                      aria-label={`Results row ${index + 1}`}
                      value={task.results}
                      onChange={(event) => updateTask(task.id, "results", event.target.value)}
                      placeholder="Result or evidence"
                      disabled={!current.enabled}
                    />
                  </td>
                  <td>
                    <select
                      aria-label={`Status row ${index + 1}`}
                      className={task.status ? statusClass[task.status] : ""}
                      value={task.status}
                      onChange={(event) => updateTask(task.id, "status", event.target.value)}
                      disabled={!current.enabled}
                    >
                      <option value="">Select status</option>
                      {STATUSES.map((status) => <option key={status}>{status}</option>)}
                    </select>
                  </td>
                  <td>
                    <input
                      aria-label={`Remark row ${index + 1}`}
                      value={task.remark}
                      onChange={(event) => updateTask(task.id, "remark", event.target.value)}
                      placeholder="Add a note"
                      disabled={!current.enabled}
                    />
                  </td>
                  <td>
                    <button
                      className="remove-button"
                      type="button"
                      aria-label={`Remove row ${index + 1}`}
                      onClick={() => removeTask(task.id)}
                      disabled={!current.enabled || current.tasks.length === 1}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <footer>
        <span>Submission Center</span>
        <span>ข้อมูลเก็บไว้ในเบราว์เซอร์ของอุปกรณ์นี้</span>
      </footer>
    </main>
  );
}
