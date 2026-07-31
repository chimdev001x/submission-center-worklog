"use client";

import { useEffect, useMemo, useState } from "react";
import { exportExcel, exportPdf } from "./export-utils";
import { downloadImportTemplate, ImportedRow, parseImportFile } from "./import-utils";
import { DashboardView } from "./components/DashboardView";
import { DayControlView } from "./components/DayControlView";
import { TodoView } from "./components/TodoView";
import { AppHeader } from "./components/AppHeader";
import { AuthScreen } from "./components/AuthScreen";
import { AdminSettingsView } from "./components/AdminSettingsView";
import { ThemeSettingsView } from "./components/ThemeSettingsView";
import { AuthUser, initializeAuth, loadMonthData, loadTodoData, logout, recordActivity, saveMonthData, saveTodoData } from "./auth-utils";
import { applyTheme, DEFAULT_THEME } from "./theme-utils";

const STATUSES = ["Open", "In Progress", "Passed", "Fail", "Stopper", "Cancel", "Done"] as const;
const ACTIVITIES = ["Retest", "Open", "Meeting", "Create Testcase", "Smoke Test", "E2E", "Review"] as const;
const WORK_MODES = ["Office", "Onsite", "WFH"] as const;
const TODO_PRIORITIES = ["Low", "Medium", "High"] as const;
const TODO_PRIORITY_RANK: Record<TodoPriority, number> = { High: 0, Medium: 1, Low: 2 };

type View = "dashboard" | "days" | "todos" | "theme" | "settings";
type ExportPeriod = "month" | "day" | "range";
type ImportMode = "dates" | "month" | "day";
type Status = (typeof STATUSES)[number] | "";
type Activity = (typeof ACTIVITIES)[number] | "";
type WorkMode = (typeof WORK_MODES)[number] | "";
type Task = { id: string; activity: Activity; link: string; results: string; status: Status; remark: string };
type DayRecord = { enabled: boolean; workMode: WorkMode; tasks: Task[] };
type MonthData = Record<number, DayRecord>;
type TodoPriority = (typeof TODO_PRIORITIES)[number];
type TodoItem = { id: string; title: string; dueDate: string; originalDueDate?: string; historyDates?: string[]; carriedAt?: number; priority: TodoPriority; completed: boolean; completedAt?: number; createdAt: number };

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
const todoDates = (todo: TodoItem) => Array.from(new Set([
  todo.dueDate,
  ...(todo.historyDates ?? []),
  ...(todo.originalDueDate ? [todo.originalDueDate] : []),
]));

export default function Home() {
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    initializeAuth().then((sessionUser) => {
      setUser(sessionUser);
      if (sessionUser?.level === 1) setView("dashboard");
      setAuthReady(true);
    });
  }, []);

  useEffect(() => { applyTheme(user?.theme ?? DEFAULT_THEME); }, [user?.theme]);

  useEffect(() => {
    if (!user?.id) return;
    const touch = () => {
      if (document.visibilityState === "visible") void recordActivity().catch(() => undefined);
    };
    touch();
    const timer = window.setInterval(touch, 60_000);
    document.addEventListener("visibilitychange", touch);
    window.addEventListener("focus", touch);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", touch);
      window.removeEventListener("focus", touch);
    };
  }, [user?.id]);

  const key = monthKey(month);
  const totalDays = daysInMonth(month);

  useEffect(() => {
    if (!user || user.level < 9) return;
    let cancelled = false;
    const stored = localStorage.getItem(`submission-center:${key}`);
    setHydrated(false);
    loadMonthData<MonthData>(user.id, key).then((remote) => {
      if (cancelled) return;
      const next = remote ?? (stored ? JSON.parse(stored) as MonthData : createMonth(totalDays));
      setData(next);
      setSelectedDay(null);
      setHydrated(true);
      setSaved(true);
      if (!remote && stored) void saveMonthData(user.id, key, next);
    }).catch(() => {
      if (cancelled) return;
      setData(stored ? JSON.parse(stored) : createMonth(totalDays));
      setHydrated(true);
    });
    return () => { cancelled = true; };
  }, [key, totalDays, user]);

  useEffect(() => {
    if (!hydrated) return;
    setSaved(false);
    const timer = window.setTimeout(() => {
      localStorage.setItem(`submission-center:${key}`, JSON.stringify(data));
      if (user) void saveMonthData(user.id, key, data).then(() => setSaved(true)).catch(() => setSaved(false));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [data, hydrated, key, user]);

  useEffect(() => {
    if (!user) return;
    const storageKey = user.level === 9 ? "submission-center:todos" : `submission-center:todos:${user.id}`;
    const accountStored = localStorage.getItem(storageKey);
    let cancelled = false;
    setTodosHydrated(false);
    loadTodoData<TodoItem>(user.id).then((remote) => {
      if (cancelled) return;
      const parsed = remote ?? (accountStored ? JSON.parse(accountStored) as TodoItem[] : []);
      setTodos(parsed);
      setTodosHydrated(true);
      if (!remote && accountStored) void saveTodoData(user.id, parsed);
    }).catch(() => {
      if (cancelled) return;
      setTodos(accountStored ? JSON.parse(accountStored) as TodoItem[] : []);
      setTodosHydrated(true);
    });
    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => {
    if (!todosHydrated) return;
    if (!user) return;
    const storageKey = user.level === 9 ? "submission-center:todos" : `submission-center:todos:${user.id}`;
    localStorage.setItem(storageKey, JSON.stringify(todos));
    void saveTodoData(user.id, todos).catch(() => undefined);
  }, [todos, todosHydrated, user]);

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
          return {
            ...todo,
            originalDueDate: todo.originalDueDate || todo.dueDate,
            historyDates: Array.from(new Set([...(todo.historyDates ?? []), todo.dueDate])),
            dueDate: today,
            carriedAt: Date.now(),
          };
        });
        return changed ? next : currentTodos;
      });
    };
    carryOverdueTasks();
    const timer = window.setInterval(carryOverdueTasks, 60_000);
    return () => window.clearInterval(timer);
  }, [todosHydrated]);

  useEffect(() => {
    const closeMobileMenu = (event: KeyboardEvent | Event) => {
      if ((event instanceof KeyboardEvent && event.key === "Escape") || (!(event instanceof KeyboardEvent) && window.innerWidth > 720)) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener("keydown", closeMobileMenu);
    window.addEventListener("resize", closeMobileMenu);
    return () => {
      window.removeEventListener("keydown", closeMobileMenu);
      window.removeEventListener("resize", closeMobileMenu);
    };
  }, []);

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
    notCompleted: monthlyTodos.filter((todo) => !todo.completed).length,
    done: monthlyTodos.filter((todo) => todo.completed).length,
  }), [monthlyTodos]);
  const dashboardTodos = useMemo(() => [...monthlyTodos]
    .sort((a, b) => Number(a.completed) - Number(b.completed) || TODO_PRIORITY_RANK[a.priority] - TODO_PRIORITY_RANK[b.priority] || a.dueDate.localeCompare(b.dueDate) || a.createdAt - b.createdAt)
    .slice(0, 6), [monthlyTodos]);
  const todoDailyTotals = useMemo(() => Array.from({ length: totalDays }, (_, index) => {
    const date = `${key}-${String(index + 1).padStart(2, "0")}`;
    return todos.filter((todo) => todoDates(todo).includes(date)).length;
  }), [key, todos, totalDays]);
  const todoDailyOpenTotals = useMemo(() => Array.from({ length: totalDays }, (_, index) => {
    const date = `${key}-${String(index + 1).padStart(2, "0")}`;
    return todos.filter((todo) => !todo.completed && todoDates(todo).includes(date)).length;
  }), [key, todos, totalDays]);
  const visibleTodos = useMemo(() => todos
    .filter((todo) => todoDates(todo).includes(selectedTodoDate))
    .filter((todo) => todoFilter === "all" || (todoFilter === "done" ? todo.completed : !todo.completed))
    .sort((a, b) => TODO_PRIORITY_RANK[a.priority] - TODO_PRIORITY_RANK[b.priority] || a.createdAt - b.createdAt), [selectedTodoDate, todoFilter, todos]);

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

  const handleAuthenticated = (nextUser: AuthUser) => {
    setTodosHydrated(false);
    setUser(nextUser);
    setView("dashboard");
  };

  const handleLogout = () => {
    void logout();
    setMobileMenuOpen(false);
    setTodosHydrated(false);
    setTodos([]);
    setUser(null);
    applyTheme(DEFAULT_THEME);
  };

  if (!authReady) return <main className="auth-loading" aria-live="polite">Loading workspace…</main>;
  if (!user) return <AuthScreen onAuthenticated={handleAuthenticated} />;

  const isAdmin = user.level >= 9;

  return (
    <main className="app-shell">
      <AppHeader model={{ view, setView, mobileMenuOpen, setMobileMenuOpen, key, changeMonth, saved, openImport, openExport, user, onLogout: handleLogout }} />

      {view === "dashboard" ? (
        <DashboardView model={{ monthLabel, counts, STATUSES, statusClass, setView, dailyTotals, data, setSelectedDay, maxDaily, todoCounts, dashboardTodos, monthlyTodos, overdueLabel, todoOnly: !isAdmin }} />
      ) : isAdmin && view === "days" ? (
        <DayControlView model={{ monthLabel, key, todoToday, selectedDay, current, updateDay, totalDays, data, dailyTotals, setSelectedDay, fullDate, WORK_MODES, addCount, setAddCount, addRows, ACTIVITIES, updateTask, statusClass, STATUSES, removeTask }} />
      ) : isAdmin && view === "settings" ? (
        <AdminSettingsView user={user} />
      ) : user.level >= 2 && view === "theme" ? (
        <ThemeSettingsView user={user} onThemeChange={(theme) => setUser((currentUser) => currentUser ? { ...currentUser, theme } : currentUser)} />
      ) : (
        <TodoView model={{ monthLabel, todoCounts, totalDays, selectedTodoDay, key, todoToday, todoDailyTotals, todoDailyOpenTotals, setSelectedTodoDay, cancelTodoEdit, isSelectedTodoPast, selectedTodoDate, todoTitle, setTodoTitle, TODO_PRIORITIES, todoPriority, setTodoPriority, addTodo, todoFilter, setTodoFilter, visibleTodos, editingTodoId, setTodos, saveTodoEdit, editingTodoTitle, setEditingTodoTitle, editingTodoPriority, setEditingTodoPriority, startTodoEdit, overdueLabel }} />
      )}

      {isAdmin && importOpen && (
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

      {isAdmin && exportOpen && (
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
