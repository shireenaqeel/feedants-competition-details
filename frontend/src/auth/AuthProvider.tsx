import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { setAuthToken, setUnauthorizedHandler } from '@/api/client';
import { endpoints } from '@/api/endpoints';
import type { User } from '@/api/types';
import { useLanguage } from '@/i18n/LanguageProvider';
import type { Lang } from '@/i18n/strings';
import { tokenStorage } from './tokenStorage';

interface AuthContextValue {
  user: User | null;
  ready: boolean;
  login: (phone: string) => Promise<void>;
  signup: (name: string, phone: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Replace the cached user after a profile edit. */
  setUser: (user: User) => void;
  /** Switch language and, when logged in, remember it on the profile. */
  changeLanguage: (lang: Lang) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { setLang } = useLanguage();
  const [user, setUserState] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  const applyUser = useCallback(
    (me: User) => {
      setUserState(me);
      setLang(me.language);
    },
    [setLang],
  );

  const logout = useCallback(async () => {
    setAuthToken(null);
    setUserState(null);
    await tokenStorage.clear();
    queryClient.removeQueries({ predicate: (q) => ['referral', 'me', 'myRegistrations', 'myCompetitions', 'editable'].includes(String(q.queryKey[0])) });
    await queryClient.invalidateQueries({ queryKey: ['competition'] });
  }, [queryClient]);

  // Restore the session on launch.
  useEffect(() => {
    (async () => {
      try {
        const token = await tokenStorage.get();
        if (token) {
          setAuthToken(token);
          applyUser((await endpoints.me()).user);
        }
      } catch {
        setAuthToken(null);
        await tokenStorage.clear();
      } finally {
        setReady(true);
      }
    })();
    // Runs once on launch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // An expired/invalid token anywhere logs the user out.
  useEffect(() => {
    setUnauthorizedHandler(() => void logout());
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  const startSession = useCallback(
    async ({ token, user: me }: { token: string; user: User }) => {
      setAuthToken(token);
      await tokenStorage.set(token);
      applyUser(me);
      await queryClient.invalidateQueries({ queryKey: ['competition'] });
    },
    [queryClient, applyUser],
  );
  const login = useCallback(async (phone: string) => startSession(await endpoints.login(phone)), [startSession]);
  const signup = useCallback(async (name: string, phone: string) => startSession(await endpoints.signup(name, phone)), [startSession]);

  const changeLanguage = useCallback(
    (lang: Lang) => {
      setLang(lang);
      if (user && user.language !== lang) {
        setUserState({ ...user, language: lang });
        endpoints.updateMe({ language: lang }).catch(() => undefined); // best effort; the UI already switched
      }
    },
    [setLang, user],
  );

  const value = useMemo(
    () => ({ user, ready, login, signup, logout, setUser: setUserState, changeLanguage }),
    [user, ready, login, signup, logout, changeLanguage],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
