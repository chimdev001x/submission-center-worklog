import { supabase } from "./supabase-client";

export type ThemeProduct = { id:string; name:string; description:string; distribution_mode:"request"|"paid"; price_satang:number; enabled:boolean; preview_url:string; theme_config:Record<string,string> };
export type ThemeRequest = { id:string; user_id:string; product_id:string; status:"pending"|"approved"|"rejected"; created_at:string };

export async function loadThemeStore(userId:string) {
  const [{data:products,error:pError},{data:requests,error:rError},{data:entitlements,error:eError}] = await Promise.all([
    supabase.from("submission_theme_products").select("*"),
    supabase.from("submission_theme_requests").select("*"),
    supabase.from("submission_theme_entitlements").select("product_id").eq("user_id",userId),
  ]);
  if(pError||rError||eError) throw pError||rError||eError;
  return {products:(products??[]) as ThemeProduct[],requests:(requests??[]) as ThemeRequest[],entitlements:new Set((entitlements??[]).map(x=>x.product_id))};
}

export async function requestTheme(userId:string, productId:string){
  const {error}=await supabase.from("submission_theme_requests").upsert({user_id:userId,product_id:productId,status:"pending"},{onConflict:"user_id,product_id"});
  if(error) throw error;
}

export async function startThemeCheckout(productId:string){
  const {data:{session}}=await supabase.auth.getSession();
  const response=await fetch("/api/theme-checkout",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${session?.access_token??""}`},body:JSON.stringify({productId})});
  const body=await response.json();
  if(!response.ok) throw new Error(body.error||"ไม่สามารถเริ่มชำระเงินได้");
  window.location.assign(body.url);
}

export async function updateThemeProduct(id:string, patch:Partial<ThemeProduct>){const {error}=await supabase.from("submission_theme_products").update({...patch,updated_at:new Date().toISOString()}).eq("id",id);if(error)throw error;}
export async function loadAdminThemeRequests(){const {data,error}=await supabase.from("submission_theme_requests").select("*").eq("status","pending").order("created_at");if(error)throw error;return (data??[]) as ThemeRequest[];}
export async function reviewThemeRequest(id:string,status:"approved"|"rejected"){const {error}=await supabase.rpc("submission_admin_review_theme_request",{target_request_id:id,next_status:status});if(error)throw error;}
