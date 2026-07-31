import { useEffect, useState } from "react";
import {
  loadAdminThemeRequests,
  loadThemeStore,
  reviewThemeRequest,
  ThemeProduct,
  ThemeRequest,
  updateThemeProduct,
} from "../theme-store";

export function AdminThemeStore({ userId }: { userId: string }) {
  const [products, setProducts] = useState<ThemeProduct[]>([]);
  const [requests, setRequests] = useState<ThemeRequest[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busyProduct, setBusyProduct] = useState("");

  const refresh = () => Promise.all([loadThemeStore(userId), loadAdminThemeRequests()])
    .then(([store, pending]) => {
      setProducts(store.products);
      setRequests(pending);
      setError("");
    })
    .catch((cause) => setError(cause instanceof Error ? cause.message : "ไม่สามารถโหลดการตั้งค่าธีมได้"));

  useEffect(() => { void refresh(); }, []);

  const toggleStoreVisibility = async (product: ThemeProduct) => {
    setBusyProduct(product.id);
    setError("");
    setMessage("");
    try {
      await updateThemeProduct(product.id, { enabled: !product.enabled });
      setMessage(product.enabled ? "ซ่อนธีมออกจากร้านค้าแล้ว" : "นำธีมขึ้นแสดงในร้านค้าแล้ว");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "ไม่สามารถเปลี่ยนการแสดงผลบนร้านค้าได้");
    } finally {
      setBusyProduct("");
    }
  };

  return (
    <section className="admin-theme-store">
      <header>
        <p className="section-kicker">THEME COMMERCE</p>
        <h2>Theme store</h2>
        <p>กำหนดรูปแบบการแจกหรือขาย ราคา และเลือกว่าธีมใดจะแสดงในร้านค้า</p>
      </header>

      {products.map((product) => (
        <form key={product.id} onSubmit={async (event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          await updateThemeProduct(product.id, {
            distribution_mode: form.get("mode") as ThemeProduct["distribution_mode"],
            price_satang: Math.round(Number(form.get("price")) * 100),
          });
          setMessage("บันทึกรูปแบบการจำหน่ายและราคาแล้ว");
          await refresh();
        }}>
          <img src={product.preview_url} alt="" />
          <div>
            <strong>{product.name}</strong>
            <small>{product.description}</small>
          </div>
          <label>
            Distribution
            <select name="mode" defaultValue={product.distribution_mode}>
              <option value="request">แจก / Admin approval</option>
              <option value="paid">ขาย / Paid by Stripe</option>
            </select>
          </label>
          <label>
            Price (THB)
            <input name="price" type="number" min="0" step="1" defaultValue={product.price_satang / 100} />
          </label>
          <button
            className={`store-visibility ${product.enabled ? "is-visible" : "is-hidden"}`}
            type="button"
            aria-pressed={product.enabled}
            disabled={busyProduct === product.id}
            onClick={() => void toggleStoreVisibility(product)}
          >
            {busyProduct === product.id ? "Updating…" : product.enabled ? "Hide from store" : "Show in store"}
          </button>
          <button type="submit">Save →</button>
        </form>
      ))}

      {!error && products.length === 0 && <p className="theme-store-state">ไม่พบสินค้า Theme</p>}

      <div className="theme-request-list">
        <h3>Pending requests ({requests.length})</h3>
        {requests.length ? requests.map((request) => (
          <div key={request.id}>
            <span><strong>{request.product_id}</strong><small>User: {request.user_id}</small></span>
            <button onClick={async () => { await reviewThemeRequest(request.id, "approved"); setMessage("อนุมัติและปลดล็อกธีมแล้ว"); await refresh(); }}>Approve</button>
            <button className="admin-delete" onClick={async () => { await reviewThemeRequest(request.id, "rejected"); await refresh(); }}>Reject</button>
          </div>
        )) : <p>No pending requests</p>}
      </div>

      {error && <p className="admin-message is-error" role="alert">{error}</p>}
      {message && <p className="admin-message is-success">{message}</p>}
    </section>
  );
}
