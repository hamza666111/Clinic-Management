import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from 'react';
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
const ROLE_SCHEMA_PREFERENCE_KEY = 'clinic_management:role_schema_mode';
const PERMISSION_SCHEMA_PREFERENCE_KEY = 'clinic_management:permission_schema_mode';

const isMissingColumnError = (message: string, column: string) => {
  const msg = message.toLowerCase();
  return msg.includes(column.toLowerCase()) && (msg.includes('column') || msg.includes('does not exist'));
};

type SupabaseLikeError = {
  message?: string;
  details?: string;
  hint?: string;
  code?: string;
  status?: number;
  statusCode?: number;
};

const isMissingTableError = (errorLike: SupabaseLikeError | string | null | undefined, table: string) => {
  if (!errorLike) return false;

  const tableName = table.toLowerCase();
  const buildMessage = (message: string) => {
    const msg = message.toLowerCase();
    return (
      msg.includes(`public.${tableName}`) ||
      msg.includes(`relation "${tableName}"`) ||
      msg.includes(`table '${tableName}'`) ||
      msg.includes(`table "public.${tableName}"`) ||
      msg.includes(`could not find the table 'public.${tableName}'`) ||
      (msg.includes('not found') && msg.includes(tableName))
    );
  };

  if (typeof errorLike === 'string') {
    return buildMessage(errorLike);
  }

  const status = errorLike.status ?? errorLike.statusCode;
  const code = (errorLike.code || '').toUpperCase();
  const message = [errorLike.message, errorLike.details, errorLike.hint].filter(Boolean).join(' ');

  return status === 404 || code === '42P01' || code === 'PGRST205' || buildMessage(message);
};

const getStoredRoleSchemaPreference = (): 'roles' | 'clinic_roles' => {
  if (typeof window === 'undefined') return 'clinic_roles';

  const value = window.localStorage.getItem(ROLE_SCHEMA_PREFERENCE_KEY);
  if (value === 'roles' || value === 'clinic_roles') {
    return value;
  }

  return 'clinic_roles';
};

const storeRoleSchemaPreference = (mode: 'roles' | 'clinic_roles') => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(ROLE_SCHEMA_PREFERENCE_KEY, mode);
};

const getStoredPermissionSchemaPreference = (): 'modern' | 'legacy' => {
  if (typeof window === 'undefined') return 'legacy';

  const value = window.localStorage.getItem(PERMISSION_SCHEMA_PREFERENCE_KEY);
  if (value === 'modern' || value === 'legacy') {
    return value;
  }

  return getStoredRoleSchemaPreference() === 'clinic_roles' ? 'legacy' : 'modern';
};

const storePermissionSchemaPreference = (mode: 'modern' | 'legacy') => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(PERMISSION_SCHEMA_PREFERENCE_KEY, mode);
};

type RawUserProfile = Omit<UserProfile, 'dynamic_role_id'> & {
  dynamic_role_id?: string | null;
  clinic_role_id?: string | null;
};

type ModernPermissionRow = {
  permission_key: string | null;
  can_read: boolean | null;
  can_write: boolean | null;
};

type LegacyPermissionRow = {
  page_key: string | null;
  can_view: boolean | null;
  can_edit: boolean | null;
  can_delete: boolean | null;
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const roleSchemaPreferenceRef = useRef<'roles' | 'clinic_roles'>(getStoredRoleSchemaPreference());
  const permissionSchemaPreferenceRef = useRef<'modern' | 'legacy'>(getStoredPermissionSchemaPreference());
  const setRoleSchemaPreference = useCallback((mode: 'roles' | 'clinic_roles') => {
    roleSchemaPreferenceRef.current = mode;
    storeRoleSchemaPreference(mode);
  }, []);
  const setPermissionSchemaPreference = useCallback((mode: 'modern' | 'legacy') => {
    permissionSchemaPreferenceRef.current = mode;
    storePermissionSchemaPreference(mode);
  }, []);

  const fetchRolePermissions = useCallback(async (
    roleId: string,
    roleName?: string,
    clinicId?: string | null
  ): Promise<Record<string, boolean>> => {
    const mapModernRows = (rows: ModernPermissionRow[]) => {
      const permMap: Record<string, boolean> = {};

      rows.forEach((row) => {
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
    };

    const mapLegacyRows = (rows: LegacyPermissionRow[]) => {
      const permMap: Record<string, boolean> = {};

      rows.forEach((row) => {
        const enabled = Boolean(row.can_view || row.can_edit || row.can_delete);
        const keys = resolvePermissionKeys(String(row.page_key || ''));
        keys.forEach((key) => {
          permMap[key] = enabled;
        });
      });

      return permMap;
    };

    const fetchModernPermissions = async (): Promise<{ permMap: Record<string, boolean> | null; shouldFallback: boolean }> => {
      const modernResult = await supabase
        .from('role_permissions')
        .select('permission_key, can_read, can_write')
        .eq('role_id', roleId);

      if (!modernResult.error) {
        setPermissionSchemaPreference('modern');
        return { permMap: mapModernRows((modernResult.data || []) as ModernPermissionRow[]), shouldFallback: false };
      }

      const modernMessage = modernResult.error.message || '';
      if (isMissingTableError(modernResult.error, 'role_permissions')) {
        setPermissionSchemaPreference('modern');
        return { permMap: {}, shouldFallback: false };
      }

      const shouldFallbackToLegacy =
        isMissingColumnError(modernMessage, 'permission_key') ||
        isMissingColumnError(modernMessage, 'can_read') ||
        isMissingColumnError(modernMessage, 'can_write');

      if (shouldFallbackToLegacy) {
        setPermissionSchemaPreference('legacy');
        return { permMap: null, shouldFallback: true };
      }

      throw modernResult.error;
    };

    const fetchLegacyPermissionsByRoleId = async (
      targetRoleId: string
    ): Promise<{ permMap: Record<string, boolean> | null; shouldFallback: boolean }> => {
      const legacyResult = await supabase
        .from('role_permissions')
        .select('page_key, can_view, can_edit, can_delete')
        .eq('role_id', targetRoleId);

      if (!legacyResult.error) {
        setPermissionSchemaPreference('legacy');
        return { permMap: mapLegacyRows((legacyResult.data || []) as LegacyPermissionRow[]), shouldFallback: false };
      }

      const legacyMessage = legacyResult.error.message || '';
      if (isMissingTableError(legacyResult.error, 'role_permissions')) {
        setPermissionSchemaPreference('legacy');
        return { permMap: {}, shouldFallback: false };
      }

      const shouldFallbackToModern =
        isMissingColumnError(legacyMessage, 'page_key') ||
        isMissingColumnError(legacyMessage, 'can_view') ||
        isMissingColumnError(legacyMessage, 'can_edit') ||
        isMissingColumnError(legacyMessage, 'can_delete');

      if (shouldFallbackToModern) {
        setPermissionSchemaPreference('modern');
        return { permMap: null, shouldFallback: true };
      }

      throw legacyResult.error;
    };

    const resolveLegacyRoleId = async (): Promise<string | null> => {
      if (!roleName || !clinicId) return null;

      const legacyRoleResult = await supabase
        .from('clinic_roles')
        .select('id')
        .eq('role_name', roleName)
        .eq('clinic_id', clinicId)
        .maybeSingle();

      if (legacyRoleResult.error) {
        if (isMissingTableError({ ...legacyRoleResult.error, status: legacyRoleResult.status }, 'clinic_roles')) {
          return null;
        }
        throw legacyRoleResult.error;
      }

      return legacyRoleResult.data?.id || null;
    };

    try {
      if (permissionSchemaPreferenceRef.current === 'legacy') {
        const legacyByCurrentRoleId = await fetchLegacyPermissionsByRoleId(roleId);

        if (legacyByCurrentRoleId.permMap) {
          if (Object.keys(legacyByCurrentRoleId.permMap).length > 0 || !roleName || !clinicId) {
            return legacyByCurrentRoleId.permMap;
          }

          const legacyRoleId = await resolveLegacyRoleId();
          if (legacyRoleId && legacyRoleId !== roleId) {
            const legacyByResolvedRoleId = await fetchLegacyPermissionsByRoleId(legacyRoleId);
            if (legacyByResolvedRoleId.permMap) {
              return legacyByResolvedRoleId.permMap;
            }
          }

          return legacyByCurrentRoleId.permMap;
        }

        if (legacyByCurrentRoleId.shouldFallback) {
          const modern = await fetchModernPermissions();
          if (modern.permMap) {
            return modern.permMap;
          }
        }

        return {};
      }

      const modern = await fetchModernPermissions();
      if (modern.permMap) {
        return modern.permMap;
      }

      if (modern.shouldFallback) {
        const legacyByCurrentRoleId = await fetchLegacyPermissionsByRoleId(roleId);
        if (legacyByCurrentRoleId.permMap) {
          if (Object.keys(legacyByCurrentRoleId.permMap).length > 0 || !roleName || !clinicId) {
            return legacyByCurrentRoleId.permMap;
          }

          const legacyRoleId = await resolveLegacyRoleId();
          if (legacyRoleId && legacyRoleId !== roleId) {
            const legacyByResolvedRoleId = await fetchLegacyPermissionsByRoleId(legacyRoleId);
            if (legacyByResolvedRoleId.permMap) {
              return legacyByResolvedRoleId.permMap;
            }
          }

          return legacyByCurrentRoleId.permMap;
        }
      }

      return {};
    } catch (error) {
      console.error('Error fetching role permissions:', error);
      return {};
    }
  }, [setPermissionSchemaPreference]);

  const resolveRoleIdForProfile = useCallback(async (profileData: RawUserProfile): Promise<string | null> => {
    if (profileData.dynamic_role_id) return profileData.dynamic_role_id;
    if (profileData.clinic_role_id) return profileData.clinic_role_id;

    try {
      const resolveFromModernRoles = async (): Promise<{ id: string | null; missingTable: boolean }> => {
        if (profileData.clinic_id) {
          const clinicRoleResult = await supabase
            .from('roles')
            .select('id')
            .eq('name', profileData.role)
            .eq('clinic_id', profileData.clinic_id)
            .maybeSingle();

          if (!clinicRoleResult.error && clinicRoleResult.data?.id) {
            return { id: clinicRoleResult.data.id, missingTable: false };
          }

          if (clinicRoleResult.error) {
            if (isMissingTableError({ ...clinicRoleResult.error, status: clinicRoleResult.status }, 'roles')) {
              return { id: null, missingTable: true };
            }
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
          if (isMissingTableError({ ...systemRoleResult.error, status: systemRoleResult.status }, 'roles')) {
            return { id: null, missingTable: true };
          }
          console.error('Error looking up system role:', systemRoleResult.error);
          return { id: null, missingTable: false };
        }

        return { id: systemRoleResult.data?.id || null, missingTable: false };
      };

      const resolveFromLegacyRoles = async (): Promise<{ id: string | null; missingTable: boolean }> => {
        if (!profileData.clinic_id) {
          return { id: null, missingTable: false };
        }

        const legacyRoleResult = await supabase
          .from('clinic_roles')
          .select('id')
          .eq('role_name', profileData.role)
          .eq('clinic_id', profileData.clinic_id)
          .maybeSingle();

        if (legacyRoleResult.error) {
          if (isMissingTableError({ ...legacyRoleResult.error, status: legacyRoleResult.status }, 'clinic_roles')) {
            return { id: null, missingTable: true };
          }
          console.error('Error looking up legacy clinic role:', legacyRoleResult.error);
          return { id: null, missingTable: false };
        }

        return { id: legacyRoleResult.data?.id || null, missingTable: false };
      };

      if (roleSchemaPreferenceRef.current === 'clinic_roles') {
        const legacy = await resolveFromLegacyRoles();
        if (!legacy.missingTable) {
          return legacy.id;
        }
        setRoleSchemaPreference('roles');
      }

      const modern = await resolveFromModernRoles();
      if (!modern.missingTable) {
        setRoleSchemaPreference('roles');
        return modern.id;
      }

      setRoleSchemaPreference('clinic_roles');
      const legacy = await resolveFromLegacyRoles();
      return legacy.id;
    } catch (error) {
      console.error('Failed to resolve role id:', error);
      return null;
    }
  }, [setRoleSchemaPreference]);

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
        const permissionOverrides = roleId
          ? await fetchRolePermissions(roleId, profileData.role, profileData.clinic_id)
          : {};

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
