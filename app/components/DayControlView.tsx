export function DayControlView({ model }: { model: any }) {
  const { monthLabel, key, todoToday, selectedDay, current, updateDay, totalDays, data, dailyTotals, setSelectedDay, fullDate, WORK_MODES, addCount, setAddCount, addRows, ACTIVITIES, updateTask, statusClass, STATUSES, removeTask } = model;
  const weekdays = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
  const firstWeekday = new Date(`${key}-01T00:00:00`).getDay();
  const calendarCells = Math.ceil((firstWeekday + totalDays) / 7) * 7;
  return (
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
    
    <div className="calendar-weekdays" aria-hidden="true">{weekdays.map((weekday) => <span key={weekday}>{weekday}</span>)}</div>
    <div className="day-grid month-calendar-grid" aria-label={`Days in ${monthLabel}`}>
    {Array.from({ length: calendarCells }, (_, cellIndex) => {
    const dayNumber = cellIndex - firstWeekday + 1;
    if (dayNumber < 1 || dayNumber > totalDays) return <span className="calendar-blank" aria-hidden="true" key={`blank-${cellIndex}`} />;
    const index = dayNumber - 1;
    const record = data[dayNumber];
    const isSelected = selectedDay === dayNumber;
    const isEnabled = record?.enabled ?? true;
    const itemCount = dailyTotals[index];
    const dateKey = `${key}-${String(dayNumber).padStart(2, "0")}`;
    const isToday = dateKey === todoToday;
    const isWeekend = cellIndex % 7 === 0 || cellIndex % 7 === 6;
    return (
    <button
    type="button"
    className={`day-cell calendar-date ${isSelected ? "is-selected" : ""} ${isToday ? "is-today" : ""} ${isWeekend ? "is-weekend" : ""} ${!isEnabled ? "is-disabled" : ""}`}
    onClick={() => setSelectedDay(dayNumber)}
    key={dayNumber}
    aria-pressed={isSelected}
    aria-label={`${new Date(`${dateKey}T00:00:00`).toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long" })}, ${isEnabled ? `${itemCount} items` : "Not in use"}`}
    >
    <span className="day-number">{dayNumber}</span>
    <span className="day-meta">{isEnabled ? `${itemCount} item${itemCount === 1 ? "" : "s"}` : "Not in use"}</span>
    <span className="calendar-dot" aria-hidden="true" style={{ opacity: itemCount || !isEnabled ? 1 : 0 }} />
    </button>
    );
    })}
    </div>
    </section>
    
    {!selectedDay || !current ? (
    <section className="selection-empty" aria-live="polite">
    <span>01—{String(totalDays).padStart(2, "0")}</span>
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
  );
}
