import { FormEvent, useState } from "react";
import { AuthUser, login, register, resendConfirmation, UserLimitError } from "../auth-utils";

export function AuthScreen({ onAuthenticated }: { onAuthenticated: (user: AuthUser) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setNotice("");
    try {
      if (mode === "login") {
        onAuthenticated(await login(email, password));
      } else {
        const user = await register(displayName, email, password);
        if (user) onAuthenticated(user);
        else {
          setNotice("สมัครสำเร็จ กรุณายืนยันอีเมล แล้วกลับมา Login");
          setPassword("");
        }
      }
    } catch (cause) {
      if (cause instanceof UserLimitError) setNotice(cause.message);
      else setError(cause instanceof Error ? cause.message : "ไม่สามารถเข้าสู่ระบบได้");
    } finally {
      setSubmitting(false);
    }
  };

  const resend = async () => {
    setSubmitting(true);
    setError("");
    setNotice("");
    try {
      await resendConfirmation(email);
      setNotice("ส่งอีเมลยืนยันใหม่แล้ว กรุณาเปิดลิงก์ล่าสุดในกล่องอีเมล");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "ไม่สามารถส่งอีเมลยืนยันใหม่ได้");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="auth-shell">
      <section className="auth-brand" aria-labelledby="auth-title">
        <div>
          <p className="eyebrow">PERSONAL WORK LOG</p>
          <h1 id="auth-title">Submission<br />Center</h1>
        </div>
        <p>จัดการงานรายวัน สถานะการส่งงาน และรายการที่ต้องทำไว้ในพื้นที่ส่วนตัวของคุณ</p>
      </section>
      <section className="auth-panel">
        <div className="auth-panel-heading">
          <p className="section-kicker">ACCOUNT ACCESS</p>
          <h2>{mode === "login" ? "Welcome back" : "Create account"}</h2>
          {mode === "login" && <p>เข้าสู่ระบบเพื่อเปิดพื้นที่ทำงานของคุณ</p>}
        </div>
        <div className="auth-tabs" role="tablist" aria-label="Account access">
          <button type="button" role="tab" aria-selected={mode === "login"} className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setError(""); }}>Login</button>
          <button type="button" role="tab" aria-selected={mode === "register"} className={mode === "register" ? "active" : ""} onClick={() => { setMode("register"); setError(""); }}>Register</button>
        </div>
        <form className="auth-form" onSubmit={submit}>
          {mode === "register" && <label><span>Display name</span><input value={displayName} onChange={(event) => setDisplayName(event.target.value)} autoComplete="name" required /></label>}
          <label><span>Email</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label>
          <label><span>Password</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={mode === "register" ? 8 : undefined} required /></label>
          {error && <p className="auth-error" role="alert">{error}</p>}
          {notice && <p className="auth-notice" role="status">{notice}</p>}
          <button className="auth-submit" type="submit" disabled={submitting}>{submitting ? "Please wait…" : mode === "login" ? "Login →" : "Create Level 1 account →"}</button>
          {mode === "login" && <button className="auth-resend" type="button" disabled={submitting} onClick={resend}>Resend confirmation email</button>}
        </form>
      </section>
    </main>
  );
}
