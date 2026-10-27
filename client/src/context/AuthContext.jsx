import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authService } from '../services/api';
import { TOKEN_KEY, USER_KEY } from '../utils/constants';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem(USER_KEY);
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const handleUnauthorized = () => {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      setUser(null);
      setIsLoading(false);
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, []);

  // Restore authenticated user on mount if token exists
  useEffect(() => {
    let isMounted = true;

    const restoreSession = async () => {
      const token = localStorage.getItem(TOKEN_KEY);
      if (!token) {
        if (isMounted) {
          setUser(null);
          setIsLoading(false);
        }
        return;
      }

      try {
        const response = await authService.getMe();
        // Server response could be { user } or { data: { user } } or just user object
        const currentUser = response.data?.user || response.user || response.data || response;
        if (isMounted) {
          setUser(currentUser);
          localStorage.setItem(USER_KEY, JSON.stringify(currentUser));
        }
      } catch (error) {
        console.error('Failed to restore session:', error);
        if (isMounted) {
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(USER_KEY);
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    restoreSession();

    return () => {
      isMounted = false;
    };
  }, []);

  // Login handler
  const login = useCallback(async (employeeId, password) => {
    setIsLoading(true);
    try {
      const response = await authService.login(employeeId, password);
      // Response structure handling
      const token = response.token || response.data?.token;
      const loggedUser = response.user || response.data?.user || response.data;

      if (token) {
        localStorage.setItem(TOKEN_KEY, token);
      }
      if (loggedUser) {
        localStorage.setItem(USER_KEY, JSON.stringify(loggedUser));
        setUser(loggedUser);
      }

      return response;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Login with Email OTP handler
  const loginWithOtp = useCallback(async (email, employeeId, otp) => {
    setIsLoading(true);
    try {
      const response = await authService.verifyLoginOtp(email, employeeId, otp);
      const token = response.token || response.data?.token;
      const loggedUser = response.user || response.data?.user || response.data;

      if (token) {
        localStorage.setItem(TOKEN_KEY, token);
      }
      if (loggedUser) {
        localStorage.setItem(USER_KEY, JSON.stringify(loggedUser));
        setUser(loggedUser);
      }

      return response;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Logout handler
  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      await authService.logout().catch(() => {});
    } finally {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      setUser(null);
      setIsLoading(false);
    }
  }, []);

  // Refresh user data handler
  const refreshUser = useCallback(async () => {
    try {
      const response = await authService.getMe();
      const currentUser = response.data?.user || response.user || response.data || response;
      setUser(currentUser);
      localStorage.setItem(USER_KEY, JSON.stringify(currentUser));
      return currentUser;
    } catch (error) {
      console.error('Failed to refresh user:', error);
      throw error;
    }
  }, []);

  const value = {
    user,
    isAuthenticated: Boolean(user && localStorage.getItem(TOKEN_KEY)),
    isLoading,
    login,
    loginWithOtp,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
