"use client";

import { useEffect, useMemo, useState } from "react";
import { exportExcel, exportPdf } from "./export-utils";
import { downloadImportTemplate, ImportedRow, parseImportFile } from "./import-utils";

const STATUSES = ["Open", "In Progress", "Passed", "Fail", "Stopper", "Cancel", "Done"] as const;
const ACTIVITIES = ["Retest", "Open", "Meeting", "Create Testcase", "Smoke Test", "E2E", "Review"] as const;
const WORK_MODES = ["Office", "Onsite", "WFH"] as const;
const TODO_PRIORITIES = ["Low", "Medium", "High"] as const;
const TODO_PRIORITY_RANK: Record<TodoPriority, number> = { High: 0, Medium: 1, Low: 2 };

type View = "dashboard" | "days" | "todos";
type ExportPeriod = "month" | "day" | "range";
type ImportMode = "dates" | "month" | "day";
type Status = (typeof STATUSES)[number] | "";
type Activity = (typeof ACTIVITIES)[number] | "";
type WorkMode = (typeof WORK_MODES)[number] | "";
type Task = { id: string; activity: Activity; link: string; results: string; status: Status; remark: string };
type DayRecord = { enabled: boolean; workMode: WorkMode; tasks: Task[] };
type MonthData = Record<number, DayRecord>;
type TodoPriority = (typeof TODO_PRIORITIES)[number];
type TodoItem = { id: string; title: string; dueDate: string; originalDueDate?: string; carriedAt?: number; priority: TodoPriority; completed: boolean; completedAt?: number; createdAt: number };

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
const localDateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

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
  const [importOpen, setImportOpen] = useState(false);
  const [importMode, setImportMode] = useState<ImportMode>("dates");
  const [importDay, setImportDay] = useState(1);
  const [importRows, setImportRows] = useState<ImportedRow[]>([]);
  const [importFileName, setImportFileName] = useState("");
  const [importError, setImportError] = useState("");
  const [importing, setImporting] = useState(false);
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [todosHydrated, setTodosHydrated] = useState(false);
  const [todoTitle, setTodoTitle] = useState("");
  const [selectedTodoDay, setSelectedTodoDay] = useState(() => new Date().getDate());
  const [todoPriority, setTodoPriority] = useState<TodoPriority>("Medium");
  const [todoFilter, setTodoFilter] = useState<"all" | "open" | "done">("all");
  const [todoClock, setTodoClock] = useState(() => Date.now());
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null);
  const [editingTodoTitle, setEditingTodoTitle] = useState("");
  const [editingTodoPriority, setEditingTodoPriority] = useState<TodoPriority>("Medium");

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

  useEffect(() => {
    const stored = localStorage.getItem("submission-center:todos");
    const parsed = stored ? JSON.parse(stored) as TodoItem[] : [];
    setTodos(parsed);
    setTodosHydrated(true);
  }, []);

  useEffect(() => {
    if (!todosHydrated) return;
    localStorage.setItem("submission-center:todos", JSON.stringify(todos));
  }, [todos, todosHydrated]);

  useEffect(() => {
    if (!todosHydrated) return;
    const carryOverdueTasks = () => {
      setTodoClock(Date.now());
      const today = localDateKey(new Date());
      setTodos((currentTodos) => {
        let changed = false;
        const next = currentTodos.map((todo) => {
          if (todo.completed || !todo.dueDate || todo.dueDate >= today) return todo;
          changed = true;
          return { ...todo, originalDueDate: todo.originalDueDate || todo.dueDate, dueDate: today, carriedAt: Date.now() };
        });
        return changed ? next : currentTodos;
      });
    };
    carryOverdueTasks();
    const timer = window.setInterval(carryOverdueTasks, 60_000);
    return () => window.clearInterval(timer);
  }, [todosHydrated]);

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
  const selectedTodoDate = `${key}-${String(Math.min(selectedTodoDay, totalDays)).padStart(2, "0")}`;
  const todoToday = localDateKey(new Date(todoClock));
  const isSelectedTodoPast = selectedTodoDate < todoToday;

  const resolvedImportRows = useMemo(() => importRows.map((row) => {
    const dateMatchesMonth = row.date ? row.date.slice(0, 7) === key : false;
    const targetDay = importMode === "day" ? importDay : importMode === "dates" ? (dateMatchesMonth ? row.day : null) : row.day;
    let issue = "";
    if (!targetDay || targetDay < 1 || targetDay > totalDays) issue = "ไม่พบวันที่ที่ใช้ได้";
    else if (importMode === "dates" && !dateMatchesMonth) issue = `วันที่ไม่อยู่ใน ${monthLabel}`;
    else if (row.status && !STATUSES.some((status) => status.toLowerCase() === row.status.toLowerCase())) issue = "Status ไม่ตรงกับรายการที่รองรับ";
    else if (row.activity && !ACTIVITIES.some((activity) => activity.toLowerCase() === row.activity.toLowerCase())) issue = "Activity ไม่ตรงกับรายการที่รองรับ";
    else if (row.workMode && !WORK_MODES.some((mode) => mode.toLowerCase() === row.workMode.toLowerCase())) issue = "Work mode ไม่ถูกต้อง";
    return { row, targetDay, issue };
  }), [importDay, importMode, importRows, key, monthLabel, totalDays]);

  const validImportRows = resolvedImportRows.filter((item) => !item.issue && item.targetDay);
  const monthlyTodos = useMemo(() => todos.filter((todo) => todo.dueDate.startsWith(key)), [key, todos]);
  const todoCounts = useMemo(() => ({
    total: monthlyTodos.length,
    open: monthlyTodos.filter((todo) => !todo.completed).length,
    done: monthlyTodos.filter((todo) => todo.completed).length,
  }), [monthlyTodos]);
  const todoDailyTotals = useMemo(() => Array.from({ length: totalDays }, (_, index) =>
    monthlyTodos.filter((todo) => Number(todo.dueDate.slice(-2)) === index + 1).length
  ), [monthlyTodos, totalDays]);
  const visibleTodos = useMemo(() => todos
    .filter((todo) => todo.dueDate === selectedTodoDate)
    .filter((todo) => todoFilter === "all" || (todoFilter === "done" ? todo.completed : !todo.completed))
    .sort((a, b) => TODO_PRIORITY_RANK[a.priority] - TODO_PRIORITY_RANK[b.priority] || Number(a.completed) - Number(b.completed) || a.createdAt - b.createdAt), [selectedTodoDate, todoFilter, todos]);

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
    setSelectedTodoDay(1);
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

  const openImport = () => {
    setImportDay(selectedDay || 1);
    setImportMode(selectedDay ? "day" : "dates");
    setImportRows([]);
    setImportFileName("");
    setImportError("");
    setImportOpen(true);
  };

  const chooseImportFile = async (file?: File) => {
    if (!file) return;
    setImporting(true);
    setImportError("");
    try {
      const rows = await parseImportFile(file);
      setImportRows(rows);
      setImportFileName(file.name);
      if (!rows.length) setImportError("ไม่พบแถวข้อมูลในไฟล์");
    } catch (error) {
      setImportRows([]);
      setImportFileName(file.name);
      setImportError(error instanceof Error ? error.message : "อ่านไฟล์ไม่สำเร็จ");
    } finally {
      setImporting(false);
    }
  };

  const applyImport = () => {
    if (!validImportRows.length) return;
    const grouped = new Map<number, typeof validImportRows>();
    validImportRows.forEach((item) => {
      const day = item.targetDay as number;
      grouped.set(day, [...(grouped.get(day) || []), item]);
    });
    setData((previous) => {
      const next = { ...previous };
      grouped.forEach((items, day) => {
        const currentDay = next[day] || { enabled: true, workMode: "", tasks: [] };
        const importedTasks = items.map(({ row }) => ({
          id: crypto.randomUUID(),
          activity: (ACTIVITIES.find((value) => value.toLowerCase() === row.activity.toLowerCase()) || "") as Activity,
          link: row.link,
          results: row.results,
          status: (STATUSES.find((value) => value.toLowerCase() === row.status.toLowerCase()) || "") as Status,
          remark: row.remark,
        }));
        const existingTasks = currentDay.tasks.filter((task) => Object.entries(task).some(([field, value]) => field !== "id" && String(value).trim()));
        next[day] = {
          enabled: items[0].row.enabled,
          workMode: (WORK_MODES.find((value) => value.toLowerCase() === items[0].row.workMode.toLowerCase()) || currentDay.workMode) as WorkMode,
          tasks: [...existingTasks, ...importedTasks],
        };
      });
      return next;
    });
    setSelectedDay(validImportRows[0].targetDay as number);
    setImportOpen(false);
    setView("days");
  };

  const addTodo = () => {
    const title = todoTitle.trim();
    if (!title || isSelectedTodoPast) return;
    setTodos((currentTodos) => [...currentTodos, {
      id: crypto.randomUUID(), title, dueDate: selectedTodoDate, priority: todoPriority, completed: false, createdAt: Date.now(),
    }]);
    setTodoTitle("");
    setTodoPriority("Medium");
  };

  const startTodoEdit = (todo: TodoItem) => {
    if (isSelectedTodoPast) return;
    setEditingTodoId(todo.id);
    setEditingTodoTitle(todo.title);
    setEditingTodoPriority(todo.priority);
  };

  const cancelTodoEdit = () => {
    setEditingTodoId(null);
    setEditingTodoTitle("");
  };

  const saveTodoEdit = () => {
    const title = editingTodoTitle.trim();
    if (!editingTodoId || !title || isSelectedTodoPast) return;
    setTodos((items) => items.map((item) => item.id === editingTodoId
      ? { ...item, title, priority: editingTodoPriority }
      : item));
    cancelTodoEdit();
  };

  const overdueLabel = (todo: TodoItem) => {
    if (!todo.originalDueDate) return "";
    const elapsedHours = Math.max(0, Math.floor((todoClock - new Date(`${todo.originalDueDate}T00:00:00`).getTime()) / 3_600_000));
    const days = Math.floor(elapsedHours / 24);
    const hours = elapsedHours % 24;
    return `Late by ${days} day${days === 1 ? "" : "s"} ${hours} hour${hours === 1 ? "" : "s"}`;
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
          <button className={view === "todos" ? "active" : ""} onClick={() => setView("todos")}>
            To Do List
          </button>
        </nav>
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
      ) : view === "days" ? (
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
      ) : (
        <div className="page-view todo-view">
          <section className="todo-intro">
            <div>
              <p className="section-kicker">{monthLabel}</p>
              <h2>To Do List</h2>
              <p>เลือกวันที่ทำงาน เพิ่มรายการ และติดตามงานที่ถูกเลื่อนไปวันถัดไปโดยอัตโนมัติ</p>
            </div>
            <div className="todo-summary" aria-label="To do summary">
              <div><span>All</span><strong>{todoCounts.total}</strong></div>
              <div><span>Open</span><strong>{todoCounts.open}</strong></div>
              <div><span>Done</span><strong>{todoCounts.done}</strong></div>
            </div>
          </section>

          <section className="todo-calendar" aria-labelledby="todo-calendar-title">
            <div className="todo-calendar-heading">
              <div><p className="section-kicker">TASK SCHEDULE</p><h2 id="todo-calendar-title">Choose a task day</h2></div>
              <p>งานที่เลยกำหนดและยังไม่เสร็จจะย้ายไปวันปัจจุบัน พร้อมซ่อนจากวันเดิม</p>
            </div>
            <div className="todo-day-grid" aria-label={`Task days in ${monthLabel}`}>
              {Array.from({ length: totalDays }, (_, index) => {
                const day = index + 1;
                const isSelected = selectedTodoDay === day;
                const dateKey = `${key}-${String(day).padStart(2, "0")}`;
                const isPast = dateKey < todoToday;
                const total = todoDailyTotals[index];
                const open = monthlyTodos.filter((todo) => Number(todo.dueDate.slice(-2)) === day && !todo.completed).length;
                return (
                  <button key={day} type="button" aria-pressed={isSelected} className={`${isSelected ? "is-selected" : ""} ${isPast ? "is-past" : ""}`} onClick={() => { setSelectedTodoDay(day); cancelTodoEdit(); }}>
                    <span>{String(day).padStart(2, "0")}</span>
                    <small>{total} item{total === 1 ? "" : "s"}{open ? ` • ${open} open` : ""}{isPast ? " • Read only" : ""}</small>
                    <i aria-hidden="true"><b style={{ width: `${total ? Math.max(14, (total / Math.max(...todoDailyTotals, 1)) * 100) : 0}%` }} /></i>
                  </button>
                );
              })}
            </div>
          </section>

          <section className={`todo-compose ${isSelectedTodoPast ? "is-locked" : ""}`} aria-labelledby="todo-compose-title">
            <div>
              <p className="section-kicker">{isSelectedTodoPast ? "READ ONLY" : "NEW ITEM"}</p>
              <h2 id="todo-compose-title">{isSelectedTodoPast ? "Past date is locked" : "Add task"} — {new Date(`${selectedTodoDate}T00:00:00`).toLocaleDateString("en-US", { day: "2-digit", month: "long" })}</h2>
              {isSelectedTodoPast && <p className="todo-lock-note">ดูประวัติได้ แต่ไม่สามารถสร้าง แก้ไข เปลี่ยนสถานะ หรือลบข้อมูลของวันที่ผ่านมาแล้ว</p>}
            </div>
            <form onSubmit={(event) => { event.preventDefault(); addTodo(); }}>
              <label className="todo-title-field">
                <span>Task</span>
                <input value={todoTitle} onChange={(event) => setTodoTitle(event.target.value)} placeholder="Write a clear next action…" autoComplete="off" disabled={isSelectedTodoPast} />
              </label>
              <fieldset className="todo-priority-picker" disabled={isSelectedTodoPast}>
                <legend>Priority</legend>
                <div>
                  {TODO_PRIORITIES.map((priority) => (
                    <label key={priority} className={`priority-${priority.toLowerCase()}`}>
                      <input type="radio" name="todo-priority" value={priority} checked={todoPriority === priority} onChange={() => setTodoPriority(priority)} />
                      <strong>{priority}</strong>
                    </label>
                  ))}
                </div>
              </fieldset>
              <button className="add-button" type="submit" disabled={isSelectedTodoPast || !todoTitle.trim()}>Add task</button>
            </form>
          </section>

          <section className="todo-list-section" aria-labelledby="todo-list-title">
            <div className="todo-list-heading">
              <div><p className="section-kicker">TASK BOARD</p><h2 id="todo-list-title">Your tasks</h2></div>
              <div className="todo-filters" role="group" aria-label="Filter tasks">
                {(["all", "open", "done"] as const).map((filter) => (
                  <button key={filter} type="button" className={todoFilter === filter ? "active" : ""} onClick={() => setTodoFilter(filter)}>
                    {filter[0].toUpperCase() + filter.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {visibleTodos.length ? (
              <ul className="todo-list">
                {visibleTodos.map((todo) => (
                  <li key={todo.id} className={`${todo.completed ? "is-complete" : ""} ${editingTodoId === todo.id ? "is-editing" : ""}`}>
                    <label className="todo-check">
                      <input type="checkbox" checked={todo.completed} disabled={isSelectedTodoPast || editingTodoId === todo.id} onChange={() => {
                        if (isSelectedTodoPast) return;
                        setTodos((items) => items.map((item) => item.id === todo.id
                          ? { ...item, completed: !item.completed, completedAt: item.completed ? undefined : Date.now() }
                          : item));
                      }} />
                      <span aria-hidden="true" />
                      <span className="sr-only">Mark {todo.title} as {todo.completed ? "open" : "done"}</span>
                    </label>
                    {editingTodoId === todo.id ? (
                      <form className="todo-edit-form" onSubmit={(event) => { event.preventDefault(); saveTodoEdit(); }}>
                        <label className="todo-edit-field">
                          <span>Task name</span>
                          <input aria-label="Edit task name" value={editingTodoTitle} onChange={(event) => setEditingTodoTitle(event.target.value)} autoFocus />
                        </label>
                        <fieldset className="todo-priority-picker todo-edit-priority">
                          <legend>Priority</legend>
                          <div>
                            {TODO_PRIORITIES.map((priority) => (
                              <label key={priority} className={`priority-${priority.toLowerCase()}`}>
                                <input type="radio" name={`edit-priority-${todo.id}`} value={priority} checked={editingTodoPriority === priority} onChange={() => setEditingTodoPriority(priority)} />
                                <strong>{priority}</strong>
                              </label>
                            ))}
                          </div>
                        </fieldset>
                        <div className="todo-edit-actions">
                          <button className="todo-cancel" type="button" onClick={cancelTodoEdit}>Cancel</button>
                          <button className="todo-save" type="submit" disabled={!editingTodoTitle.trim()}>Save</button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <div className="todo-copy">
                          <strong>{todo.title}</strong>
                          <div>
                            <span className={`todo-priority priority-${todo.priority.toLowerCase()}`}>{todo.priority}</span>
                            <span>{new Date(`${todo.dueDate}T00:00:00`).toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" })}</span>
                            {todo.completedAt && <span className="todo-completed-time">Completed {new Date(todo.completedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>}
                            {todo.originalDueDate && <span className="todo-overdue">{overdueLabel(todo)} • moved from {todo.originalDueDate}</span>}
                          </div>
                        </div>
                        <div className="todo-row-actions">
                          <button className="todo-edit-button" type="button" disabled={isSelectedTodoPast} onClick={() => startTodoEdit(todo)}>Edit</button>
                          <button className="todo-delete" type="button" disabled={isSelectedTodoPast} onClick={() => {
                            if (isSelectedTodoPast) return;
                            setTodos((items) => items.filter((item) => item.id !== todo.id));
                            if (editingTodoId === todo.id) cancelTodoEdit();
                          }} aria-label={`Delete ${todo.title}`}>×</button>
                        </div>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="todo-empty">
                <span>{todoFilter === "done" ? "00" : "✓"}</span>
                <div><h3>{todoFilter === "all" ? "No tasks yet" : `No ${todoFilter} tasks`}</h3><p>เพิ่มงานใหม่จากช่องด้านบน แล้วรายการจะปรากฏที่นี่</p></div>
              </div>
            )}
          </section>
        </div>
      )}

      {importOpen && (
        <div className="export-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.currentTarget === event.target && !importing) setImportOpen(false);
        }}>
          <section className="export-dialog import-dialog" role="dialog" aria-modal="true" aria-labelledby="import-title">
            <div className="export-heading">
              <div>
                <p className="section-kicker">{monthLabel}</p>
                <h2 id="import-title">Import template</h2>
                <p>รองรับ Excel (.xlsx) และ CSV พร้อมตรวจข้อมูลก่อนนำเข้า</p>
              </div>
              <button className="dialog-close" type="button" aria-label="Close import dialog" onClick={() => setImportOpen(false)} disabled={importing}>×</button>
            </div>

            <div className="export-options">
              <fieldset>
                <legend>Import mode</legend>
                <div className="export-choice-grid">
                  <label>
                    <input type="radio" name="import-mode" checked={importMode === "dates"} onChange={() => setImportMode("dates")} />
                    <span><strong>Dates in file</strong><small>ใช้วันที่ที่ระบุในแต่ละแถว</small></span>
                  </label>
                  <label>
                    <input type="radio" name="import-mode" checked={importMode === "month"} onChange={() => setImportMode("month")} />
                    <span><strong>Whole month</strong><small>ใช้คอลัมน์ Day หรือ Date</small></span>
                  </label>
                  <label>
                    <input type="radio" name="import-mode" checked={importMode === "day"} onChange={() => setImportMode("day")} />
                    <span><strong>One day</strong><small>นำทุกแถวลงวันที่เดียว</small></span>
                  </label>
                </div>
              </fieldset>

              {importMode === "day" && (
                <label className="export-day-select">
                  <span>Target date</span>
                  <input
                    type="date"
                    min={`${key}-01`}
                    max={`${key}-${String(totalDays).padStart(2, "0")}`}
                    value={`${key}-${String(importDay).padStart(2, "0")}`}
                    onChange={(event) => setImportDay(Number(event.target.value.slice(-2)))}
                  />
                </label>
              )}

              <div className="template-actions">
                <label className="file-drop">
                  <input type="file" accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" onChange={(event) => chooseImportFile(event.target.files?.[0])} />
                  <span aria-hidden="true">↑</span>
                  <strong>{importFileName || "Choose Excel or CSV"}</strong>
                  <small>{importing ? "Reading file…" : "คอลัมน์ที่รองรับ: Date, Day, Work Mode, Activity, Link Plane, Results, Status, Remark"}</small>
                </label>
                <button className="text-action" type="button" onClick={() => downloadImportTemplate(month)}>Download {monthLabel} template →</button>
              </div>

              {importRows.length > 0 && (
                <div className="import-preview">
                  <div className="import-preview-heading">
                    <div><span>Preview</span><strong>{validImportRows.length} valid / {importRows.length} rows</strong></div>
                    <p>ข้อมูลเดิมอยู่ก่อน • ข้อมูลจากไฟล์ต่อท้าย</p>
                  </div>
                  <div className="import-preview-table-wrap">
                    <table className="import-preview-table">
                      <thead><tr><th>Row</th><th>Target</th><th>Activity</th><th>Link Plane</th><th>Status</th><th>Check</th></tr></thead>
                      <tbody>
                        {resolvedImportRows.slice(0, 8).map(({ row, targetDay, issue }) => (
                          <tr key={row.sourceRow} className={issue ? "has-error" : ""}>
                            <td>{row.sourceRow}</td>
                            <td>{targetDay ? `${key}-${String(targetDay).padStart(2, "0")}` : "-"}</td>
                            <td>{row.activity || "-"}</td>
                            <td>{row.link || "-"}</td>
                            <td>{row.status || "-"}</td>
                            <td>{issue || "Ready"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {importRows.length > 8 && <p className="preview-more">และอีก {importRows.length - 8} แถว</p>}
                </div>
              )}
              {importError && <p className="import-error" role="alert">{importError}</p>}
            </div>

            <div className="export-footer">
              <p>ข้อมูลจะถูกบันทึกลงเดือนที่กำลังเปิดอยู่ ({monthLabel}) และแสดงบน Dashboard ทันที</p>
              <div>
                <button className="secondary-button" type="button" onClick={() => setImportOpen(false)} disabled={importing}>Cancel</button>
                <button className="add-button" type="button" onClick={applyImport} disabled={importing || !validImportRows.length}>
                  Import {validImportRows.length || ""} row{validImportRows.length === 1 ? "" : "s"}
                </button>
              </div>
            </div>
          </section>
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
