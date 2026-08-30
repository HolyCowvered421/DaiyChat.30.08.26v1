'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase, Profile, UserMemory } from './client';

type AuthContextType = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  memory: UserMemory | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  refreshMemory: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  memory: null,
  loading: true,
  refreshProfile: async () => {},
  refreshMemory: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [memory, setMemory] = useState<UserMemory | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (uid: string, currentUser: User | null = null) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', uid)
      .maybeSingle();

    if (data) {
      setProfile(data as Profile);
      return;
    }

    if (error) {
      console.error('Profile load failed:', error);
    }

    const fallbackName = currentUser?.user_metadata?.display_name || currentUser?.email?.split('@')[0] || 'User';
    const { data: createdProfile, error: upsertError } = await supabase
      .from('profiles')
      .upsert(
        {
          id: uid,
          display_name: fallbackName,
          avatar_url: null,
          onboarding_completed: false,
        },
        { onConflict: 'id' }
      )
      .select('*')
      .single();

    if (upsertError) {
      console.error('Profile restore failed:', upsertError);
      setProfile(null);
      return;
    }

    setProfile(createdProfile as Profile);
  }, []);

  const loadMemory = useCallback(async (uid: string) => {
    const { data } = await supabase
      .from('user_memory')
      .select('*')
      .eq('user_id', uid)
      .maybeSingle();
    setMemory(data as UserMemory | null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (session?.user?.id) await loadProfile(session.user.id);
  }, [session, loadProfile]);

  const refreshMemory = useCallback(async () => {
    if (session?.user?.id) await loadMemory(session.user.id);
  }, [session, loadMemory]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
    setMemory(null);
  }, []);

  useEffect(() => {
    let active = true;

    const syncAuthState = async (nextSession: Session | null) => {
      if (!active) return;

      const nextUser = nextSession?.user ?? null;
      setSession(nextSession);
      setUser(nextUser);

      if (nextUser?.id) {
        await loadProfile(nextUser.id, nextUser);
        await loadMemory(nextUser.id);
      } else {
        setProfile(null);
        setMemory(null);
      }

      setLoading(false);
    };

    const initializeAuth = async () => {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      await syncAuthState(currentSession);
    };

    initializeAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      await syncAuthState(nextSession);
    });

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, [loadProfile, loadMemory]);

  return (
    <AuthContext.Provider
      value={{ session, user, profile, memory, loading, refreshProfile, refreshMemory, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
