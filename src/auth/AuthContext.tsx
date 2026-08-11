import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authApi, HttpError, usersApi } from '../api/client';
import type { CurrentUser } from '../types/api';

const ACCESS_TOKEN_KEY = 'workforce.accessToken';
const REFRESH_TOKEN_KEY = 'workforce.refreshToken';

interface AuthContextValue {
  user: CurrentUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (params: {
    organizationName: string;
    fullName: string;
    email: string;
    password: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function persistTokens(accessToken: string, refreshToken: string) {
  await AsyncStorage.setMany({
    [ACCESS_TOKEN_KEY]: accessToken,
    [REFRESH_TOKEN_KEY]: refreshToken,
  });
}

async function clearTokens() {
  await AsyncStorage.removeMany([ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY]);
}

// Fetch the current user, transparently refreshing the access token once on a 401.
async function fetchCurrentUser(accessToken: string, refreshToken: string) {
  try {
    return { user: await usersApi.me(accessToken), accessToken, refreshToken };
  } catch (err) {
    if (err instanceof HttpError && err.status === 401) {
      const refreshed = await authApi.refresh(refreshToken);
      const user = await usersApi.me(refreshed.accessToken);
      return { user, accessToken: refreshed.accessToken, refreshToken: refreshed.refreshToken };
    }
    throw err;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On app start, try to restore a session from previously saved tokens.
  useEffect(() => {
    (async () => {
      const stored = await AsyncStorage.getMany([ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY]);
      const accessToken = stored[ACCESS_TOKEN_KEY];
      const refreshToken = stored[REFRESH_TOKEN_KEY];

      if (!accessToken || !refreshToken) {
        setIsLoading(false);
        return;
      }

      try {
        const result = await fetchCurrentUser(accessToken, refreshToken);
        await persistTokens(result.accessToken, result.refreshToken);
        setUser(result.user);
      } catch {
        await clearTokens();
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const login = async (email: string, password: string) => {
    const tokens = await authApi.login({ email, password });
    const currentUser = await usersApi.me(tokens.accessToken);
    await persistTokens(tokens.accessToken, tokens.refreshToken);
    setUser(currentUser);
  };

  const register = async (params: {
    organizationName: string;
    fullName: string;
    email: string;
    password: string;
  }) => {
    const tokens = await authApi.register(params);
    const currentUser = await usersApi.me(tokens.accessToken);
    await persistTokens(tokens.accessToken, tokens.refreshToken);
    setUser(currentUser);
  };

  const logout = async () => {
    await clearTokens();
    setUser(null);
  };

  const value = useMemo(
    () => ({ user, isLoading, login, register, logout }),
    [user, isLoading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
