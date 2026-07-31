import { useState } from "react";
import { AuthUser, saveTheme } from "../auth-utils";
import { DEFAULT_THEME, ThemeSettings } from "../theme-utils";
import { ThemeStore } from "./ThemeStore";

const SWATCHES = ["#667461", "#315f73", "#76547d", "#a05c45", "#886f32", "#365f50"];

export function ThemeSettingsView({ user, onThemeChange }: { user: AuthUser; onThemeChange: (theme: ThemeSettings) => void }) {
  const [theme, setTheme] = useState<ThemeSettings>(user.theme);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const change = (patch: Partial<ThemeSettings>) => {
    const next = { ...theme, ...patch };
    setTheme(next);
    onThemeChange(next);
    setNotice("");
  };

  const persist = async () => {
    setSaving(true); setError(""); setNotice("");
    try {
      await saveTheme(user.id, theme);
      setNotice("บันทึกธีมสำหรับบัญชีนี้แล้ว");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "ไม่สามารถบันทึกธีมได้");
    } finally { setSaving(false); }
  };

  const reset = () => change(DEFAULT_THEME);

  return (
    <section className="theme-settings" aria-labelledby="theme-title">
      <header className="theme-heading">
        <div><p className="section-kicker">PERSONAL APPEARANCE</p><h2 id="theme-title">Theme studio</h2><p>เลือกแม่สีให้ระบบสร้างเฉด หรือควบคุมสีหลักของพื้นที่ทำงานด้วยตัวเอง</p></div>
        <div className="theme-preview" aria-label="Theme preview"><span /><span /><span /><strong>Aa</strong></div>
      </header>

      <fieldset className="theme-mode">
        <legend>Color method</legend>
        <label><input type="radio" name="theme-mode" checked={theme.mode === "auto"} onChange={() => change({ mode: "auto" })} /><span><strong>Auto shades</strong><small>เลือกแม่สีเดียว ระบบสร้าง Canvas, Text และเส้นแบ่งให้</small></span></label>
        <label><input type="radio" name="theme-mode" checked={theme.mode === "custom"} onChange={() => change({ mode: "custom" })} /><span><strong>Custom colors</strong><small>กำหนดสีของแต่ละส่วนด้วยตัวเอง</small></span></label>
      </fieldset>

      <section className="theme-colors">
        <div className="theme-primary">
          <div><p className="section-kicker">PRIMARY COLOR</p><h3>{theme.mode === "auto" ? "Choose a color family" : "Interface primary"}</h3></div>
          <label className="color-field"><input type="color" value={theme.primary} onChange={(event) => change({ primary: event.target.value })} /><span>{theme.primary}</span></label>
          <div className="theme-swatches" aria-label="Suggested primary colors">{SWATCHES.map((color) => <button key={color} type="button" aria-label={`Use ${color}`} aria-pressed={theme.primary === color} style={{ background: color }} onClick={() => change({ primary: color })} />)}</div>
        </div>

        {theme.mode === "custom" && <div className="custom-color-grid">
          {([['canvas', 'Canvas'], ['surface', 'Surface'], ['text', 'Text'], ['accent', 'Accent']] as const).map(([field, label]) => (
            <label key={field}><span>{label}</span><div><input type="color" value={theme[field]} onChange={(event) => change({ [field]: event.target.value })} /><code>{theme[field]}</code></div></label>
          ))}
        </div>}
      </section>

      {error && <p className="admin-message is-error" role="alert">{error}</p>}
      {notice && <p className="admin-message is-success" role="status">{notice}</p>}
      <footer className="theme-actions"><button type="button" className="theme-reset" onClick={reset}>Reset default</button><button type="button" className="theme-save" onClick={() => void persist()} disabled={saving}>{saving ? "Saving…" : "Save theme →"}</button></footer>
      <ThemeStore user={{...user,theme}} onThemeChange={(next)=>{setTheme(next);onThemeChange(next)}} />
    </section>
  );
}
