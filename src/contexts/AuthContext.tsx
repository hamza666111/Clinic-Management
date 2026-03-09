import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { UserProfile } from '../lib/types';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  permissions: Record<string, boolean>;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('users_profile')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching profile:', error);

        if (error.message?.includes('Invalid Refresh Token') || error.message?.includes('JWT') || error.message?.includes('Refresh Token Not Found')) {
          console.log('Auth error in profile fetch, signing out');
          localStorage.removeItem('supabase.auth.token');
          await supabase.auth.signOut({ scope: 'local' });
          return null;
        }

        return null;
      }

      if (data) {
        setProfile(data as UserProfile);
        
        // Fetch custom role permissions if applicable
        if (data.dynamic_role_id) {
          const { data: permsData } = await supabase
            .from('role_permissions')
            .select('permission_key, can_read')
            .eq('role_id', data.dynamic_role_id);
            
          const permMap: Record<string, boolean> = {};
          permsData?.forEach(p => {
            permMap[p.permission_key] = p.can_read;
          });
          setPermissions(permMap);
        } else {
          // Fallbacks for standard legacy roles
          const permMap: Record<string, boolean> = {
            view_revenue: ['admin', 'clinic_admin'].includes(data.role),
            manage_appointments: true,
            manage_billing: ['admin', 'clinic_admin', 'doctor', 'receptionist'].includes(data.role),
            manage_patients: true,
            manage_staff: ['admin', 'clinic_admin'].includes(data.role),
            manage_services: ['admin', 'clinic_admin', 'doctor', 'receptionist'].includes(data.role)
          };
          setPermissions(permMap);
        }
        
        return data;
      }
      return null;
    } catch (err) {
      console.error('Profile fetch exception:', err);
      return null;
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  }, [user, fetchProfile]);

  useEffect(() => {
    let mounted = true;

    const safeStopLoading = () => {
      if (mounted) setLoading(false);
    };

    const initializeAuth = async () => {
      try {
        const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();

        if (!mounted) return;

        if (sessionError) {
          console.error('Session error:', sessionError);
          if (sessionError.message?.includes('Invalid Refresh Token') || sessionError.message?.includes('JWT') || sessionError.message?.includes('Refresh Token Not Found')) {
            console.log('Invalid session detected, clearing auth state');
            localStorage.removeItem('supabase.auth.token');
            void supabase.auth.signOut({ scope: 'local' });
            setSession(null);
            setUser(null);
            setProfile(null);
            setPermissions({});
          }
        } else if (currentSession?.user) {
          setSession(currentSession);
          setUser(currentSession.user);
          // Do not block initial route rendering on profile query latency.
          void fetchProfile(currentSession.user.id);
        }
      } catch (err) {
        console.error('Auth initialization error:', err);
        localStorage.removeItem('supabase.auth.token');
        void supabase.auth.signOut({ scope: 'local' });
      } finally {
        safeStopLoading();
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!mounted) return;

      if (event === 'TOKEN_REFRESHED') {
        if (newSession?.user) {
          setSession(newSession);
          setUser(newSession.user);
        }
        safeStopLoading();
        return;
      }

      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (newSession?.user) {
        // Keep auth responsive even if profile/permissions query is slow.
        void fetchProfile(newSession.user.id);
      } else {
        setProfile(null);
        setPermissions({});
      }

      if (event === 'SIGNED_OUT') {
        setProfile(null);
        setPermissions({});
        setUser(null);
        setSession(null);
      }

      safeStopLoading();
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const signIn = async (email: string, password: string): Promise<{ error: Error | null }> => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        console.error('Sign in error:', error);
        return { error: new Error(error.message) };
      }

      if (!data.user) {
        return { error: new Error('No user returned from sign in') };
      }

      const profileData = await fetchProfile(data.user.id);

      if (!profileData) {
        await supabase.auth.signOut();
        return { error: new Error('User profile not found. Please contact administrator.') };
      }

      if (!profileData.is_active) {
        await supabase.auth.signOut();
        return { error: new Error('Your account has been deactivated. Please contact administrator.') };
      }

      setSession(data.session);
      setUser(data.user);

      return { error: null };
    } catch (err) {
      console.error('Sign in exception:', err);
      return { error: err instanceof Error ? err : new Error('An unexpected error occurred') };
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      setProfile(null);
      setPermissions({});
      setUser(null);
      setSession(null);
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, permissions, loading, signIn, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
