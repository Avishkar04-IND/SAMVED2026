import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);

  // Restore session on app load
  useEffect(() => {
    try {
      const stored = localStorage.getItem('safetynet_user');
      if (stored) setUser(JSON.parse(stored));
    } catch { localStorage.removeItem('safetynet_user'); }
  }, []);

  const login = (userData) => {
    // Normalize: always store both id fields clearly
    const normalized = {
      ...userData,
      id:   userData.workerId || userData.supervisorId || userData.id,
      role: userData.role,
    };
    localStorage.setItem('safetynet_user', JSON.stringify(normalized));
    setUser(normalized);
  };

  const logout = () => {
    localStorage.removeItem('safetynet_user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);