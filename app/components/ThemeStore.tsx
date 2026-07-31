import {useEffect,useState} from "react";
import {AuthUser,saveTheme} from "../auth-utils";
import {ThemeSettings} from "../theme-utils";
import {loadThemeStore,requestTheme,startThemeCheckout,ThemeProduct} from "../theme-store";

export function ThemeStore({user,onThemeChange}:{user:AuthUser;onThemeChange:(theme:ThemeSettings)=>void}){
 const [products,setProducts]=useState<ThemeProduct[]>([]);const [requests,setRequests]=useState<any[]>([]);const [owned,setOwned]=useState(new Set<string>());const [message,setMessage]=useState("");const [busy,setBusy]=useState("");
 const refresh=()=>loadThemeStore(user.id).then(x=>{setProducts(x.products);setRequests(x.requests);setOwned(x.entitlements)}).catch(e=>setMessage(e.message));
 useEffect(()=>{refresh()},[]);
 const useTheme=async(p:ThemeProduct)=>{const next={...user.theme,...p.theme_config,mode:"custom",productId:p.id} as ThemeSettings;onThemeChange(next);await saveTheme(user.id,next);setMessage("เปิดใช้ธีมแล้ว");};
 return <section className="theme-store"><header><p className="section-kicker">THEME STORE</p><h2>Collect a new workspace</h2><p>ธีมที่ได้รับสิทธิ์จะใช้ได้กับทุกหน้าของบัญชีนี้</p></header><div className="theme-product-grid">{products.map(p=>{const req=requests.find(r=>r.product_id===p.id);const has=owned.has(p.id);return <article key={p.id}><img src={p.preview_url} alt={`ตัวอย่างธีม ${p.name}`}/><div><p className="section-kicker">SANRIO COLLECTION</p><h3>{p.name}</h3><p>{p.description}</p><strong>{p.distribution_mode==="paid"?`฿${(p.price_satang/100).toFixed(2)}`:"Request access"}</strong></div><button disabled={!!busy||req?.status==="pending"} onClick={async()=>{setBusy(p.id);setMessage("");try{if(has)await useTheme(p);else if(p.distribution_mode==="paid")await startThemeCheckout(p.id);else{await requestTheme(user.id,p.id);await refresh();setMessage("ส่งคำขอให้ Admin แล้ว")}}catch(e){setMessage(e instanceof Error?e.message:"เกิดข้อผิดพลาด")}finally{setBusy("")}}}>{has?"Use theme →":req?.status==="pending"?"Waiting for approval":p.distribution_mode==="paid"?"Buy with Stripe →":"Request theme →"}</button></article>})}</div>{message&&<p className="admin-message is-success">{message}</p>}</section>
}
