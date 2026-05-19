'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { createSupabaseBrowserClient } from './supabase-client';
import type { DbUser, UserType } from './types';

interface AuthContextType {
  user:        User | null;
  session:     Session | null;
  dbUser:      DbUser | null;
  loading:     boolean;
  isAdmin:     boolean;
  isVerifier:  boolean;
  signUp:      (email: string, password: string, fullName: string) => Promise<{ error: string | null }>;
  signIn:      (email: string, password: string) => Promise<{ error: string | null }>;
  signOut:     () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,    setUser]    = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [dbUser,  setDbUser]  = useState<DbUser | null>(null);
  const [loading, setLoading] = useState(true);

  const supabase = createSupabaseBrowserClient();

  async function fetchDbUser(userId: string) {
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('auth_id', userId)
      .single();
    setDbUser(data ?? null);
  }

  async function refreshUser() {
    if (user) await fetchDbUser(user.id);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) fetchDbUser(session.user.id);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchDbUser(session.user.id);
      } else {
        setDbUser(null);
      }
    });

    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function signUp(email: string, password: string, fullName: string) {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    return { error: error?.message ?? null };
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  const userType: UserType | undefined = dbUser?.user_type;

  return (
    <AuthContext.Provider value={{
      user,
      session,
      dbUser,
      loading,
      isAdmin:    userType === 'admin',
      isVerifier: userType === 'verifier',
      signUp,
      signIn,
      signOut,
      refreshUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
