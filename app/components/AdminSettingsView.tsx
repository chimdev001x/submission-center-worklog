import { FormEvent, useEffect, useState } from "react";
import { AdminOverview, AdminUser, AuthUser, deleteAdminUser, loadAdminOverview, loadAdminUsers, updateAdminUserLevel, updateAdminUserLimit, UserLevel } from "../auth-utils";

export function AdminSettingsView({ user }: { user: AuthUser }) {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [limit, setLimit] = useState("10");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [updatingLevelId, setUpdatingLevelId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = async () => {
    setLoading(true);
    setError("");
    try {
      const [nextOverview, nextUsers] = await Promise.all([loadAdminOverview(), loadAdminUsers()]);
      setOverview(nextOverview);
      setUsers(nextUsers);
      setLimit(String(nextOverview.maxUsers));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "ไม่สามารถโหลดข้อมูลผู้ใช้ได้");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Loading this server-owned directory is the external synchronization for this view.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, []);

  const saveLimit = async (event: FormEvent) => {
    event.preventDefault();
    const nextLimit = Number(limit);
    if (!Number.isInteger(nextLimit) || nextLimit < 1) {
      setError("จำนวนผู้ใช้ต้องเป็นเลขจำนวนเต็มอย่างน้อย 1");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await updateAdminUserLimit(nextLimit);
      await refresh();
      setNotice("อัปเดตจำนวนผู้ใช้สูงสุดแล้ว");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "ไม่สามารถบันทึกจำนวนผู้ใช้ได้");
    } finally {
      setSaving(false);
    }
  };

  const removeUser = async (target: AdminUser) => {
    if (!window.confirm(`ลบบัญชี ${target.displayName} (${target.email}) และข้อมูลทั้งหมดหรือไม่?`)) return;
    setDeletingId(target.id);
    setError("");
    setNotice("");
    try {
      await deleteAdminUser(target.id);
      await refresh();
      setNotice(`ลบบัญชี ${target.displayName} แล้ว`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "ไม่สามารถลบผู้ใช้ได้");
    } finally {
      setDeletingId(null);
    }
  };

  const changeLevel = async (account: AdminUser, level: UserLevel) => {
    setUpdatingLevelId(account.id);
    setError("");
    setNotice("");
    try {
      await updateAdminUserLevel(account.id, level);
      setUsers((current) => current.map((item) => item.id === account.id ? { ...item, level } : item));
      setNotice(`อัปเดต ${account.displayName} เป็น Level ${level} แล้ว`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "ไม่สามารถเปลี่ยน Level ได้");
    } finally {
      setUpdatingLevelId(null);
    }
  };

  return (
    <section className="admin-settings" aria-labelledby="admin-settings-title">
      <header className="admin-settings-heading">
        <div>
          <p className="section-kicker">SYSTEM ACCESS</p>
          <h2 id="admin-settings-title">Admin settings</h2>
          <p>จัดการจำนวนบัญชีและสิทธิ์การสมัครใช้งานของระบบ</p>
        </div>
        <div className="admin-capacity" aria-label="User capacity">
          <span>USERS</span>
          <strong>{overview ? `${overview.userCount} / ${overview.maxUsers}` : "—"}</strong>
          <small>{overview && overview.userCount >= overview.maxUsers ? "Registration closed" : "Registration available"}</small>
        </div>
      </header>

      <form className="admin-limit-form" onSubmit={saveLimit}>
        <label><span>Maximum users</span><input type="number" min="1" step="1" value={limit} onChange={(event) => setLimit(event.target.value)} /></label>
        <button type="submit" disabled={saving}>{saving ? "Saving…" : "Save limit →"}</button>
      </form>

      {error && <p className="admin-message is-error" role="alert">{error}</p>}
      {notice && <p className="admin-message is-success" role="status">{notice}</p>}

      <div className="admin-users-heading"><span>USER DIRECTORY</span><strong>{overview?.userCount ?? 0} accounts</strong></div>
      {loading ? <p className="admin-loading">Loading users…</p> : (
        <div className="admin-users-table-wrap">
          <table className="admin-users-table">
            <thead><tr><th>User</th><th>Level</th><th>Status</th><th>Created</th><th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>{users.map((account) => (
              <tr key={account.id}>
                <td><strong>{account.displayName}</strong><small>{account.email}</small></td>
                <td><select className={`admin-level-select level-${account.level}`} aria-label={`Level for ${account.displayName}`} value={account.level} disabled={account.id === user.id || updatingLevelId === account.id} onChange={(event) => void changeLevel(account, Number(event.target.value) as UserLevel)}><option value={1}>Level 1</option><option value={2}>Level 2</option><option value={9}>Level 9</option></select></td>
                <td><span className={account.confirmedAt ? "user-confirmed" : "user-pending"}>{account.confirmedAt ? "Confirmed" : "Pending email"}</span></td>
                <td>{new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(account.createdAt))}</td>
                <td><button type="button" className="admin-delete" disabled={account.id === user.id || deletingId === account.id} onClick={() => void removeUser(account)}>{account.id === user.id ? "Current admin" : deletingId === account.id ? "Deleting…" : "Delete"}</button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}
