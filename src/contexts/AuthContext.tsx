import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { UserProfile } from '../lib/types';
import { mergePermissionsWithDefaults, resolvePermissionKeys } from '../lib/portalPermissions';

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

const isMissingColumnError = (message: string, column: string) => {
  const msg = message.toLowerCase();
  return msg.includes(column.toLowerCase()) && (msg.includes('column') || msg.includes('does not exist'));
};

const isMissingTableError = (message: string, table: string) => {
  const msg = message.toLowerCase();
  return msg.includes(`public.${table}`) || msg.includes(`relation "${table}"`) || msg.includes(`table '${table}'`);
};

type RawUserProfile = Omit<UserProfile, 'dynamic_role_id'> & {
  dynamic_role_id?: string | null;
  clinic_role_id?: string | null;
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  const fetchRolePermissions = useCallback(async (roleId: string): Promise<Record<string, boolean>> => {
    try {
      const modernResult = await supabase
        .from('role_permissions')
        .select('permission_key, can_read, can_write')
        .eq('role_id', roleId);

      if (!modernResult.error) {
        const permMap: Record<string, boolean> = {};
        modernResult.data?.forEach((row: any) => {
          const enabled = Boolean(row.can_read || row.can_write);
          const keys = resolvePermissionKeys(String(row.permission_key || ''));

          if (!keys.length && row.permission_key) {
            permMap[String(row.permission_key)] = enabled;
            return;
          }

          keys.forEach((key) => {
            permMap[key] = enabled;
          });
        });
        return permMap;
      }

      const modernMessage = modernResult.error.message || '';
      if (isMissingTableError(modernMessage, 'role_permissions')) {
        return {};
      }

      const shouldFallbackToLegacy =
        isMissingColumnError(modernMessage, 'permission_key') ||
        isMissingColumnError(modernMessage, 'can_read') ||
        isMissingColumnError(modernMessage, 'can_write');

      if (!shouldFallbackToLegacy) {
        throw modernResult.error;
      }

      const legacyResult = await supabase
        .from('role_permissions')
        .select('page_key, can_view, can_edit, can_delete')
        .eq('role_id', roleId);

      if (legacyResult.error) {
        const legacyMessage = legacyResult.error.message || '';
        if (isMissingTableError(legacyMessage, 'role_permissions')) {
          return {};
        }
        throw legacyResult.error;
      }

      const permMap: Record<string, boolean> = {};
      legacyResult.data?.forEach((row: any) => {
        const enabled = Boolean(row.can_view || row.can_edit || row.can_delete);
        const keys = resolvePermissionKeys(String(row.page_key || ''));
        keys.forEach((key) => {
          permMap[key] = enabled;
        });
      });

      return permMap;
    } catch (error) {
      console.error('Error fetching role permissions:', error);
      return {};
    }
  }, []);

  const resolveRoleIdForProfile = useCallback(async (profileData: RawUserProfile): Promise<string | null> => {
    if (profileData.dynamic_role_id) return profileData.dynamic_role_id;
    if (profileData.clinic_role_id) return profileData.clinic_role_id;

    try {
      if (profileData.clinic_id) {
        const clinicRoleResult = await supabase
          .from('roles')
          .select('id')
          .eq('name', profileData.role)
          .eq('clinic_id', profileData.clinic_id)
          .maybeSingle();

        if (!clinicRoleResult.error && clinicRoleResult.data?.id) {
          return clinicRoleResult.data.id;
        }

        if (clinicRoleResult.error && !isMissingTableError(clinicRoleResult.error.message || '', 'roles')) {
          console.error('Error looking up clinic role:', clinicRoleResult.error);
        }
      }

      const systemRoleResult = await supabase
        .from('roles')
        .select('id')
        .eq('name', profileData.role)
        .eq('is_system_default', true)
        .maybeSingle();

      if (systemRoleResult.error) {
        if (!isMissingTableError(systemRoleResult.error.message || '', 'roles')) {
          console.error('Error looking up system role:', systemRoleResult.error);
        }
        return null;
      }

      return systemRoleResult.data?.id || null;
    } catch (error) {
      console.error('Failed to resolve role id:', error);
      return null;
    }
  }, []);

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
        const profileData = data as RawUserProfile;
        setProfile(profileData as UserProfile);

        const roleId = await resolveRoleIdForProfile(profileData);
        const permissionOverrides = roleId ? await fetchRolePermissions(roleId) : {};

        setPermissions(mergePermissionsWithDefaults(profileData.role, permissionOverrides));

        return profileData;
      }

      setPermissions({});
      return null;
    } catch (err) {
      console.error('Profile fetch exception:', err);
      return null;
    }
  }, [fetchRolePermissions, resolveRoleIdForProfile]);

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
