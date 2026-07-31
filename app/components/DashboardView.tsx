export function DashboardView({ model }: { model: any }) {
  const { monthLabel, counts, STATUSES, statusClass, setView, dailyTotals, data, setSelectedDay, maxDaily, todoCounts, dashboardTodos, monthlyTodos, overdueLabel } = model;
  return (
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
    
    <section className="dashboard-todos" aria-labelledby="dashboard-todos-title">
    <div className="chart-heading dashboard-todos-heading">
    <div>
    <p className="section-kicker">MONTHLY TASKS</p>
    <h2 id="dashboard-todos-title">To Do List</h2>
    </div>
    <button className="text-action" type="button" onClick={() => setView("todos")}>Manage To Do List →</button>
    </div>
    
    <div className="dashboard-todos-body">
    <div className="dashboard-todos-summary">
    <div className="dashboard-todo-counts" aria-label="To do summary">
    <span><small>All</small><strong>{todoCounts.total}</strong></span>
    <span><small>Open</small><strong>{todoCounts.open}</strong></span>
    <span><small>Done</small><strong>{todoCounts.done}</strong></span>
    </div>
    </div>
    
    <div className="dashboard-todo-preview">
    {dashboardTodos.length ? (
    <ul>
    {dashboardTodos.map((todo) => (
    <li key={todo.id} className={todo.completed ? "is-complete" : ""}>
    <span className="dashboard-todo-state" aria-hidden="true">{todo.completed ? "✓" : ""}</span>
    <div>
    <strong>{todo.title}</strong>
    <p>
    <span className={`todo-priority priority-${todo.priority.toLowerCase()}`}>{todo.priority}</span>
    <span>{new Date(`${todo.dueDate}T00:00:00`).toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" })}</span>
    {!todo.completed && <span className="todo-not-completed">Not completed</span>}
    {!todo.completed && todo.originalDueDate && <span className="todo-overdue">{overdueLabel(todo)} • moved from {todo.originalDueDate}</span>}
    {todo.completedAt && <span className="todo-completed-time">Completed {new Date(todo.completedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>}
    </p>
    </div>
    </li>
    ))}
    </ul>
    ) : (
    <div className="dashboard-todo-empty"><span>00</span><p>ยังไม่มี To Do ใน {monthLabel}</p></div>
    )}
    {monthlyTodos.length > dashboardTodos.length && <p className="dashboard-todo-more">+{monthlyTodos.length - dashboardTodos.length} more tasks</p>}
    </div>
    </div>
    </section>
    </div>
  );
}
