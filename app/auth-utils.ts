import { supabase } from "./supabase-client";

export type AuthUser = { id: string; email: string; displayName: string; level: 1 | 9 };
export type AdminUser = AuthUser & { createdAt: string; confirmedAt: string | null };
export type AdminOverview = { userCount: number; maxUsers: number };

export class UserLimitError extends Error {}

const profileFor = async (id: string, email: string): Promise<AuthUser> => {
  const { data, error } = await supabase
    .from("submission_profiles")
    .select("display_name, level")
    .eq("id", id)
    .single();
  if (error) throw error;
  return { id, email, displayName: data.display_name, level: data.level as 1 | 9 };
};

export const initializeAuth = async (): Promise<AuthUser | null> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user.email) return null;
  return profileFor(session.user.id, session.user.email);
};

export const login = async (email: string, password: string): Promise<AuthUser> => {
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
  if (error || !data.user?.email) throw new Error("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
  return profileFor(data.user.id, data.user.email);
};

export const register = async (displayName: string, email: string, password: string): Promise<AuthUser | null> => {
  if (!displayName.trim() || !email.trim() || !password) throw new Error("กรุณากรอกข้อมูลให้ครบ");
  if (password.length < 8) throw new Error("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร");
  const { data: available, error: availabilityError } = await supabase.rpc("submission_registration_available");
  if (availabilityError) throw availabilityError;
  if (!available) throw new UserLimitError("ผู้ใช้งานถึงขีดจำกัดแล้ว รออัปเดตครั้งถัดไป");

  const { data, error } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: {
      data: { display_name: displayName.trim() },
      emailRedirectTo: typeof window === "undefined" ? undefined : window.location.origin,
    },
  });
  if (error) {
    if (error.message.includes("SUBMISSION_USER_LIMIT_REACHED")) {
      throw new UserLimitError("ผู้ใช้งานถึงขีดจำกัดแล้ว รออัปเดตครั้งถัดไป");
    }
    throw error;
  }
  if (!data.session || !data.user?.email) return null;
  return profileFor(data.user.id, data.user.email);
};

export const loadAdminOverview = async (): Promise<AdminOverview> => {
  const { data, error } = await supabase.rpc("submission_admin_overview");
  if (error) throw error;
  const row = data?.[0];
  return { userCount: Number(row?.user_count ?? 0), maxUsers: Number(row?.max_users ?? 0) };
};

export const loadAdminUsers = async (): Promise<AdminUser[]> => {
  const { data, error } = await supabase.rpc("submission_admin_list_users");
  if (error) throw error;
  type AdminUserRow = { id: string; email: string; display_name: string; level: number; created_at: string; confirmed_at: string | null };
  return ((data ?? []) as AdminUserRow[]).map((row) => ({
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    level: row.level as 1 | 9,
    createdAt: row.created_at,
    confirmedAt: row.confirmed_at,
  }));
};

export const updateAdminUserLimit = async (maxUsers: number): Promise<void> => {
  const { error } = await supabase.rpc("submission_admin_set_user_limit", { next_max_users: maxUsers });
  if (error) throw error;
};

export const deleteAdminUser = async (userId: string): Promise<void> => {
  const { error } = await supabase.rpc("submission_admin_delete_user", { target_user_id: userId });
  if (error) throw error;
};

export const resendConfirmation = async (email: string): Promise<void> => {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) throw new Error("กรุณากรอกอีเมลก่อนส่งลิงก์ยืนยันอีกครั้ง");
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: normalizedEmail,
    options: {
      emailRedirectTo: typeof window === "undefined" ? undefined : window.location.origin,
    },
  });
  if (error) throw error;
};

export const logout = async () => { await supabase.auth.signOut(); };

export const loadMonthData = async <T>(userId: string, monthKey: string): Promise<T | null> => {
  const { data, error } = await supabase.from("submission_months").select("data").eq("user_id", userId).eq("month_key", monthKey).maybeSingle();
  if (error) throw error;
  return (data?.data as T | undefined) ?? null;
};

export const saveMonthData = async <T>(userId: string, monthKey: string, data: T) => {
  const { error } = await supabase.from("submission_months").upsert({ user_id: userId, month_key: monthKey, data, updated_at: new Date().toISOString() });
  if (error) throw error;
};

export const loadTodoData = async <T>(userId: string): Promise<T[] | null> => {
  const { data, error } = await supabase.from("submission_todos").select("data").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return (data?.data as T[] | undefined) ?? null;
};

export const saveTodoData = async <T>(userId: string, data: T[]) => {
  const { error } = await supabase.from("submission_todos").upsert({ user_id: userId, data, updated_at: new Date().toISOString() });
  if (error) throw error;
};
