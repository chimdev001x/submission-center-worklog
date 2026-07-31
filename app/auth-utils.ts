import { supabase } from "./supabase-client";

export type AuthUser = { id: string; email: string; displayName: string; level: 1 | 9 };

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

export const register = async (displayName: string, email: string, password: string): Promise<AuthUser> => {
  if (!displayName.trim() || !email.trim() || !password) throw new Error("กรุณากรอกข้อมูลให้ครบ");
  if (password.length < 8) throw new Error("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร");
  const { data, error } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: {
      data: { display_name: displayName.trim() },
      emailRedirectTo: typeof window === "undefined" ? undefined : window.location.origin,
    },
  });
  if (error) throw error;
  if (!data.session || !data.user?.email) throw new Error("สมัครสำเร็จ กรุณายืนยันอีเมล แล้วกลับมา Login");
  return profileFor(data.user.id, data.user.email);
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
