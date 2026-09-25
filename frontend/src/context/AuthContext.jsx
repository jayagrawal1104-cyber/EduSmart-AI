import { createContext, useContext, useEffect, useState } from 'react';

const AuthContext = createContext(null);
const STORAGE_KEY = 'campus_dashboard_auth';

function readStoredAuth() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.token || !parsed?.user) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  // Guards against a flash-redirect to a login page before we've had a
  // chance to read localStorage on first mount.
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    const stored = readStoredAuth();
    if (stored) {
      setToken(stored.token);
      setUser(stored.user);
    }
    setInitializing(false);
  }, []);

  /**
   * Normalizes any of the backend login/creation responses into a single
   * { token, user } shape and persists it.
   * Backend responses look like:
   *   { token, admin: {...}, institution: {...} }
   *   { token, student: {...}, institution: {...} }
   *   { token, faculty: {...}, institution: {...} }
   *   { token, superAdmin: {...} }
   */
  function login(response) {
    const role =
      (response.admin && 'admin') ||
      (response.student && 'student') ||
      (response.faculty && 'faculty') ||
      (response.superAdmin && 'superadmin');

    const account = response.admin || response.student || response.faculty || response.superAdmin;

    const nextUser = {
      id: account.id,
      name: account.name,
      email: account.email,
      role,
      institutionId: response.institution?.id ?? null,
      institutionName: response.institution?.name ?? null,
      institutionCode: response.institution?.code ?? null,
    };

    setToken(response.token);
    setUser(nextUser);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: response.token, user: nextUser }));
  }

  function logout() {
    setToken(null);
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
  }

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        role: user?.role ?? null,
        isAuthenticated: !!token,
        initializing,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}