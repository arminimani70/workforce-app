import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authApi, HttpError, usersApi } from '../api/client';
import type { CurrentUser, TokenPair } from '../types/api';

const ACCESS_TOKEN_KEY = 'workforce.accessToken';
const REFRESH_TOKEN_KEY = 'workforce.refreshToken';

interface AuthContextValue {
  user: CurrentUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  // Runs an authenticated call with the current access token, transparently refreshing
  // and retrying once on a 401. Every screen that talks to a protected endpoint uses this
  // instead of calling the API client directly, so the refresh logic lives in one place.
  authFetch: <T>(fn: (accessToken: string) => Promise<T>) => Promise<T>;
  // Re-fetches /users/me and updates the cached user — used after a profile edit so the rest
  // of the app (e.g. Home's avatar) reflects it without needing a restart.
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function persistTokens(tokens: TokenPair) {
  await AsyncStorage.multiSet([
    [ACCESS_TOKEN_KEY, tokens.accessToken],
    [REFRESH_TOKEN_KEY, tokens.refreshToken],
  ]);
}

async function clearStoredTokens() {
  await AsyncStorage.multiRemove([ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY]);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const tokensRef = useRef<TokenPair | null>(null);

  const authFetch = useCallback(async <T,>(fn: (accessToken: string) => Promise<T>): Promise<T> => {
    const tokens = tokensRef.current;
    if (!tokens) {
      throw new Error('Not authenticated');
    }

    try {
      return await fn(tokens.accessToken);
    } catch (err) {
      if (!(err instanceof HttpError) || err.status !== 401) {
        throw err;
      }
      const refreshed = await authApi.refresh(tokens.refreshToken);
      tokensRef.current = refreshed;
      await persistTokens(refreshed);
      return fn(refreshed.accessToken);
    }
  }, []);

  // On app start, try to restore a session from previously saved tokens.
  useEffect(() => {
    (async () => {
      const stored = await AsyncStorage.multiGet([ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY]);
      const storedMap = Object.fromEntries(stored);
      const accessToken = storedMap[ACCESS_TOKEN_KEY];
      const refreshToken = storedMap[REFRESH_TOKEN_KEY];

      if (!accessToken || !refreshToken) {
        setIsLoading(false);
        return;
      }

      tokensRef.current = { accessToken, refreshToken };
      try {
        const currentUser = await authFetch((token) => usersApi.me(token));
        setUser(currentUser);
      } catch {
        tokensRef.current = null;
        await clearStoredTokens();
      } finally {
        setIsLoading(false);
      }
    })();
  }, [authFetch]);

  const login = async (email: string, password: string) => {
    const tokens = await authApi.login({ email, password });
    const currentUser = await usersApi.me(tokens.accessToken);
    tokensRef.current = tokens;
    await persistTokens(tokens);
    setUser(currentUser);
  };

  const logout = async () => {
    tokensRef.current = null;
    await clearStoredTokens();
    setUser(null);
  };

  const refreshUser = useCallback(async () => {
    const currentUser = await authFetch((token) => usersApi.me(token));
    setUser(currentUser);
  }, [authFetch]);

  const value = useMemo(
    () => ({ user, isLoading, login, logout, authFetch, refreshUser }),
    [user, isLoading, authFetch, refreshUser],
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
