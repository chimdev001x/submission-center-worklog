import { useEffect, useRef } from "react";

type ConfirmDialogProps = {
  title: string;
  message: string;
  confirmLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({ title, message, confirmLabel = "Delete", busy = false, onConfirm, onCancel }: ConfirmDialogProps) {
  const cancelButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    cancelButton.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      previousFocus?.focus();
    };
  }, [busy, onCancel]);

  return (
    <div className="confirm-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.currentTarget === event.target && !busy) onCancel();
    }}>
      <section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-message">
        <p className="section-kicker">CONFIRM DELETE</p>
        <h2 id="confirm-title">{title}</h2>
        <p id="confirm-message">{message}</p>
        <div className="confirm-actions">
          <button ref={cancelButton} className="confirm-cancel" type="button" onClick={onCancel} disabled={busy}>Cancel</button>
          <button className="confirm-delete" type="button" onClick={onConfirm} disabled={busy}>{busy ? "Deleting…" : confirmLabel}</button>
        </div>
      </section>
    </div>
  );
}
