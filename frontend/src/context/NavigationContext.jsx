import { createContext, useContext, useState } from 'react';
const NavigationContext = createContext(null);
const NAV_STORAGE_KEY = 'campus_dashboard_nav';

// Reads the last page/params the user was on so a page reload can restore
// it instead of always bouncing back to the landing page.
function readStoredNav() {
  try {
    const raw = sessionStorage.getItem(NAV_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.currentPage !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function NavigationProvider({
  children
}) {
  const [currentPage, setCurrentPage] = useState(() => readStoredNav()?.currentPage ?? 'landing');
  const [role, setRole] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [navParams, setNavParams] = useState(() => readStoredNav()?.navParams ?? null);
  function navigate(page, params = null) {
    setCurrentPage(page);
    setNavParams(params);
    try {
      sessionStorage.setItem(NAV_STORAGE_KEY, JSON.stringify({
        currentPage: page,
        navParams: params
      }));
    } catch {
      // sessionStorage unavailable (e.g. private browsing) — safe to ignore,
      // it just means the reload-restore won't work this session.
    }
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  }
  return <NavigationContext.Provider value={{
    currentPage,
    navigate,
    role,
    setRole,
    searchOpen,
    setSearchOpen,
    navParams
  }}>
      {children}
    </NavigationContext.Provider>;
}
export function useNav() {
  const ctx = useContext(NavigationContext);
  if (!ctx) throw new Error('useNav must be used within NavigationProvider');
  return ctx;
}