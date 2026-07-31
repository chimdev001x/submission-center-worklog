export function TodoView({ model }: { model: any }) {
  const { monthLabel, todoCounts, totalDays, selectedTodoDay, key, todoToday, todoDailyTotals, todoDailyOpenTotals, setSelectedTodoDay, cancelTodoEdit, isSelectedTodoPast, selectedTodoDate, todoTitle, setTodoTitle, TODO_PRIORITIES, todoPriority, setTodoPriority, addTodo, todoFilter, setTodoFilter, visibleTodos, editingTodoId, setTodos, saveTodoEdit, editingTodoTitle, setEditingTodoTitle, editingTodoPriority, setEditingTodoPriority, startTodoEdit, overdueLabel } = model;
  return (
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
    <p>งานที่เลยกำหนดจะทำต่อในวันปัจจุบัน และยังเก็บประวัติแบบอ่านอย่างเดียวไว้ในวันที่เคยกำหนด</p>
    </div>
    <div className="todo-day-grid" aria-label={`Task days in ${monthLabel}`}>
    {Array.from({ length: totalDays }, (_, index) => {
    const day = index + 1;
    const isSelected = selectedTodoDay === day;
    const dateKey = `${key}-${String(day).padStart(2, "0")}`;
    const isPast = dateKey < todoToday;
    const total = todoDailyTotals[index];
    const open = todoDailyOpenTotals[index];
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
    {visibleTodos.map((todo) => {
    const isHistorical = todo.dueDate !== selectedTodoDate;
    return (
    <li key={todo.id} className={`${todo.completed ? "is-complete" : ""} ${editingTodoId === todo.id ? "is-editing" : ""} ${isHistorical ? "is-history" : ""}`}>
    <label className="todo-check">
    <input type="checkbox" checked={todo.completed} disabled={isHistorical || isSelectedTodoPast || editingTodoId === todo.id} onChange={() => {
    if (isHistorical || isSelectedTodoPast) return;
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
    <span>{new Date(`${selectedTodoDate}T00:00:00`).toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" })}</span>
    {isHistorical && <span className="todo-history-note">History • carried forward to {todo.dueDate}</span>}
    {todo.completedAt && <span className="todo-completed-time">Completed {new Date(todo.completedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>}
    {!isHistorical && todo.originalDueDate && <span className="todo-overdue">{overdueLabel(todo)} • moved from {todo.originalDueDate}</span>}
    </div>
    </div>
    <div className="todo-row-actions">
    <button className="todo-edit-button" type="button" disabled={isHistorical || isSelectedTodoPast} onClick={() => startTodoEdit(todo)}>Edit</button>
    <button className="todo-delete" type="button" disabled={isHistorical || isSelectedTodoPast} onClick={() => {
    if (isHistorical || isSelectedTodoPast) return;
    setTodos((items) => items.filter((item) => item.id !== todo.id));
    if (editingTodoId === todo.id) cancelTodoEdit();
    }} aria-label={`Delete ${todo.title}`}>×</button>
    </div>
    </>
    )}
    </li>
    );
    })}
    </ul>
    ) : (
    <div className="todo-empty">
    <span>{todoFilter === "done" ? "00" : "✓"}</span>
    <div><h3>{todoFilter === "all" ? "No tasks yet" : `No ${todoFilter} tasks`}</h3><p>เพิ่มงานใหม่จากช่องด้านบน แล้วรายการจะปรากฏที่นี่</p></div>
    </div>
    )}
    </section>
    </div>
  );
}
