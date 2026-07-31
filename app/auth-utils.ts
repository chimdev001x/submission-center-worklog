export type AuthUser = { id: string; username: string; displayName: string; level: 1 | 9 };
type StoredUser = AuthUser & { passwordHash: string };

const USERS_KEY = "submission-center:users";
const SESSION_KEY = "submission-center:session";
const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "Admin@123";

const hashPassword = async (password: string) => {
  const bytes = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
};

const readUsers = (): StoredUser[] => {
  try { return JSON.parse(localStorage.getItem(USERS_KEY) || "[]"); }
  catch { return []; }
};

const publicUser = (user: StoredUser): AuthUser => ({
  id: user.id,
  username: user.username,
  displayName: user.displayName,
  level: user.level,
});

export const initializeAuth = async (): Promise<AuthUser | null> => {
  const users = readUsers();
  if (!users.some((user) => user.username === ADMIN_USERNAME)) {
    users.push({
      id: "admin",
      username: ADMIN_USERNAME,
      displayName: "Administrator",
      level: 9,
      passwordHash: await hashPassword(ADMIN_PASSWORD),
    });
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }
  const sessionId = localStorage.getItem(SESSION_KEY);
  const sessionUser = users.find((user) => user.id === sessionId);
  return sessionUser ? publicUser(sessionUser) : null;
};

export const login = async (username: string, password: string): Promise<AuthUser> => {
  const normalized = username.trim().toLowerCase();
  const passwordHash = await hashPassword(password);
  const user = readUsers().find((item) => item.username === normalized && item.passwordHash === passwordHash);
  if (!user) throw new Error("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
  localStorage.setItem(SESSION_KEY, user.id);
  return publicUser(user);
};

export const register = async (displayName: string, username: string, password: string): Promise<AuthUser> => {
  const users = readUsers();
  const normalized = username.trim().toLowerCase();
  if (!displayName.trim() || !normalized || !password) throw new Error("กรุณากรอกข้อมูลให้ครบ");
  if (!/^[a-z0-9._-]{3,24}$/.test(normalized)) throw new Error("Username ต้องมี 3–24 ตัว และใช้ a-z, 0-9, จุด, _ หรือ -");
  if (password.length < 8) throw new Error("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร");
  if (users.some((user) => user.username === normalized)) throw new Error("Username นี้ถูกใช้งานแล้ว");
  const user: StoredUser = {
    id: crypto.randomUUID(),
    username: normalized,
    displayName: displayName.trim(),
    level: 1,
    passwordHash: await hashPassword(password),
  };
  users.push(user);
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
  localStorage.setItem(SESSION_KEY, user.id);
  return publicUser(user);
};

export const logout = () => localStorage.removeItem(SESSION_KEY);
