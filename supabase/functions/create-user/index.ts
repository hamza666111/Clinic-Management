import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, accept",
  "Access-Control-Max-Age": "86400",
  Vary: "Origin",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const CORE_USER_ROLES = ["admin", "clinic_admin", "doctor", "assistant", "receptionist"];
    const normalizeRoleName = (value: string) => value.trim().toLowerCase().replace(/\s+/g, "_");

    const isMissingTableError = (
      errorLike: { message?: string; code?: string; status?: number } | string | null | undefined,
      table: string
    ) => {
      if (!errorLike) return false;

      const tableName = table.toLowerCase();
      const buildMessage = (message: string) => {
        const msg = message.toLowerCase();
        return (
          msg.includes(`public.${tableName}`) ||
          msg.includes(`relation "${tableName}"`) ||
          msg.includes(`table '${tableName}'`) ||
          msg.includes(`could not find the table 'public.${tableName}'`) ||
          (msg.includes('not found') && msg.includes(tableName))
        );
      };

      if (typeof errorLike === 'string') {
        return buildMessage(errorLike);
      }

      const status = errorLike.status;
      const code = (errorLike.code || '').toUpperCase();
      return status === 404 || code === '42P01' || code === 'PGRST205' || buildMessage(errorLike.message || '');
    };

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const resolveDynamicRoleId = async (roleName: string, clinicId?: string | null) => {
      try {
        if (clinicId) {
          const clinicRoleRes = await supabaseAdmin
            .from("roles")
            .select("id")
            .eq("name", roleName)
            .eq("clinic_id", clinicId)
            .maybeSingle();

          if (!clinicRoleRes.error && clinicRoleRes.data?.id) {
            return clinicRoleRes.data.id as string;
          }

          if (clinicRoleRes.error && !isMissingTableError(clinicRoleRes.error.message || "", "roles")) {
            throw clinicRoleRes.error;
          }
        }

        const globalRoleRes = await supabaseAdmin
          .from("roles")
          .select("id")
          .eq("name", roleName)
          .is("clinic_id", null)
          .maybeSingle();

        if (!globalRoleRes.error && globalRoleRes.data?.id) {
          return globalRoleRes.data.id as string;
        }

        if (globalRoleRes.error && !isMissingTableError(globalRoleRes.error.message || "", "roles")) {
          throw globalRoleRes.error;
        }

        const systemRoleRes = await supabaseAdmin
          .from("roles")
          .select("id")
          .eq("name", roleName)
          .eq("is_system_default", true)
          .maybeSingle();

        if (systemRoleRes.error) {
          if (isMissingTableError(systemRoleRes.error.message || "", "roles")) {
            return null;
          }
          throw systemRoleRes.error;
        }

        return (systemRoleRes.data?.id as string | undefined) || null;
      } catch (err) {
        console.error("resolveDynamicRoleId failed:", err);
        return null;
      }
    };

    const isKnownRole = async (roleName: string, clinicId?: string | null) => {
      if (CORE_USER_ROLES.includes(roleName)) {
        return true;
      }

      try {
        const checkModernRole = async () => {
          if (clinicId) {
            const clinicRoleRes = await supabaseAdmin
              .from("roles")
              .select("id")
              .eq("name", roleName)
              .eq("clinic_id", clinicId)
              .maybeSingle();

            if (!clinicRoleRes.error && clinicRoleRes.data?.id) {
              return { found: true, missingTable: false };
            }

            if (clinicRoleRes.error && !isMissingTableError(clinicRoleRes.error.message || "", "roles")) {
              throw clinicRoleRes.error;
            }
          }

          const globalRoleRes = await supabaseAdmin
            .from("roles")
            .select("id")
            .eq("name", roleName)
            .is("clinic_id", null)
            .maybeSingle();

          if (globalRoleRes.error) {
            if (isMissingTableError(globalRoleRes.error.message || "", "roles")) {
              return { found: false, missingTable: true };
            }
            throw globalRoleRes.error;
          }

          if (globalRoleRes.data?.id) {
            return { found: true, missingTable: false };
          }

          const systemRoleRes = await supabaseAdmin
            .from("roles")
            .select("id")
            .eq("name", roleName)
            .eq("is_system_default", true)
            .maybeSingle();

          if (systemRoleRes.error) {
            if (isMissingTableError(systemRoleRes.error.message || "", "roles")) {
              return { found: false, missingTable: true };
            }
            throw systemRoleRes.error;
          }

          return { found: Boolean(systemRoleRes.data?.id), missingTable: false };
        };

        const modernCheck = await checkModernRole();
        if (!modernCheck.missingTable) {
          return modernCheck.found;
        }

        if (!clinicId) {
          return false;
        }

        const legacyRoleRes = await supabaseAdmin
          .from("clinic_roles")
          .select("id")
          .eq("role_name", roleName)
          .eq("clinic_id", clinicId)
          .maybeSingle();

        if (legacyRoleRes.error) {
          if (isMissingTableError(legacyRoleRes.error.message || "", "clinic_roles")) {
            return false;
          }
          throw legacyRoleRes.error;
        }

        return Boolean(legacyRoleRes.data?.id);
      } catch (err) {
        console.error("isKnownRole failed:", err);
        return false;
      }
    };

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized: No Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !caller) {
      return new Response(JSON.stringify({ error: "Unauthorized: " + (authError?.message || "no user found") }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: callerProfile } = await supabaseAdmin
      .from("users_profile")
      .select("role, clinic_id")
      .eq("id", caller.id)
      .maybeSingle();

    if (!callerProfile || (callerProfile.role !== "admin" && callerProfile.role !== "clinic_admin")) {
      return new Response(JSON.stringify({ error: `Access denied. Role: ${callerProfile?.role || "no profile found"}` }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let body: {
      action?: string;
      user_id?: string;
      role_id?: string;
      name?: string;
      email?: string;
      password?: string;
      role?: string;
      role_name?: string;
      clinic_id?: string | null;
      is_active?: boolean;
      schema_mode?: 'roles' | 'clinic_roles';
    };

    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const action = body.action || "create";

    if (action === "create_role") {
      const rawRoleName = (body.role_name || body.role || "").trim().toLowerCase();
      const normalizedRoleName = rawRoleName.replace(/\s+/g, "_");

      if (!normalizedRoleName) {
        return new Response(JSON.stringify({ error: "role_name is required." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!/^[a-z0-9_]+$/.test(normalizedRoleName)) {
        return new Response(JSON.stringify({ error: "Role name can only include lowercase letters, numbers, and underscores." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const schemaHint = body.schema_mode === "roles" || body.schema_mode === "clinic_roles"
        ? body.schema_mode
        : "roles";

      let targetClinicId = body.clinic_id || null;

      if (schemaHint === "roles") {
        targetClinicId = null;
      } else if (callerProfile.role === "clinic_admin") {
        if (!callerProfile.clinic_id) {
          return new Response(JSON.stringify({ error: "Clinic admin profile is missing clinic_id." }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        targetClinicId = callerProfile.clinic_id;
      }

      if (schemaHint === "clinic_roles" && !targetClinicId) {
        return new Response(JSON.stringify({ error: "clinic_id is required for legacy role creation." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const createLegacyRole = async () => {
        const result = await supabaseAdmin
          .from("clinic_roles")
          .insert([{ role_name: normalizedRoleName, clinic_id: targetClinicId, is_default: false }])
          .select("id, role_name, is_default, clinic_id")
          .single();

        if (result.error) {
          if (isMissingTableError({ message: result.error.message, code: result.error.code, status: result.status }, "clinic_roles")) {
            return { missingTable: true as const, role: null as null };
          }
          throw result.error;
        }

        return {
          missingTable: false as const,
          role: {
            id: result.data.id as string,
            name: result.data.role_name as string,
            is_system_default: Boolean(result.data.is_default),
            clinic_id: (result.data.clinic_id as string | null) || null,
          },
        };
      };

      const createModernRole = async () => {
        let existingRoleQuery = supabaseAdmin
          .from("roles")
          .select("id")
          .eq("name", normalizedRoleName);

        if (targetClinicId) {
          existingRoleQuery = existingRoleQuery.eq("clinic_id", targetClinicId);
        } else {
          existingRoleQuery = existingRoleQuery.is("clinic_id", null);
        }

        const existingRoleResult = await existingRoleQuery.maybeSingle();

        if (existingRoleResult.error) {
          if (!isMissingTableError({ message: existingRoleResult.error.message, code: existingRoleResult.error.code, status: existingRoleResult.status }, "roles")) {
            throw existingRoleResult.error;
          }

          return { missingTable: true as const, role: null as null };
        }

        if (existingRoleResult.data?.id) {
          const duplicateError = new Error("Role already exists") as Error & { code?: string };
          duplicateError.code = "23505";
          throw duplicateError;
        }

        const result = await supabaseAdmin
          .from("roles")
          .insert([{ name: normalizedRoleName, clinic_id: targetClinicId, is_system_default: false }])
          .select("id, name, is_system_default, clinic_id")
          .single();

        if (result.error) {
          if (isMissingTableError({ message: result.error.message, code: result.error.code, status: result.status }, "roles")) {
            return { missingTable: true as const, role: null as null };
          }
          throw result.error;
        }

        return {
          missingTable: false as const,
          role: {
            id: result.data.id as string,
            name: result.data.name as string,
            is_system_default: Boolean(result.data.is_system_default),
            clinic_id: (result.data.clinic_id as string | null) || null,
          },
        };
      };

      try {
        let createdRole: { id: string; name: string; is_system_default: boolean; clinic_id: string | null } | null = null;
        let resolvedSchema: "roles" | "clinic_roles" = schemaHint;

        if (schemaHint === "roles") {
          const modern = await createModernRole();
          if (!modern.missingTable) {
            createdRole = modern.role;
            resolvedSchema = "roles";
          } else {
            const legacy = await createLegacyRole();
            if (legacy.missingTable) {
              throw new Error("Neither roles nor clinic_roles table exists.");
            }
            createdRole = legacy.role;
            resolvedSchema = "clinic_roles";
          }
        } else {
          const legacy = await createLegacyRole();
          if (!legacy.missingTable) {
            createdRole = legacy.role;
            resolvedSchema = "clinic_roles";
          } else {
            const modern = await createModernRole();
            if (modern.missingTable) {
              throw new Error("Neither clinic_roles nor roles table exists.");
            }
            createdRole = modern.role;
            resolvedSchema = "roles";
          }
        }

        return new Response(JSON.stringify({ success: true, role: createdRole, schema_mode: resolvedSchema }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (createRoleErr) {
        const errorObj = createRoleErr as { message?: string; code?: string };
        const code = (errorObj.code || "").toUpperCase();

        if (code === "23505") {
          return new Response(JSON.stringify({ error: "This role already exists." }), {
            status: 409,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ error: errorObj.message || "Failed to create role." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (action === "delete_role") {
      const normalizedRoleName = normalizeRoleName(String(body.role_name || ""));
      const roleId = body.role_id || null;

      if (!roleId && !normalizedRoleName) {
        return new Response(JSON.stringify({ error: "role_id or role_name is required." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const schemaHint = body.schema_mode === "roles" || body.schema_mode === "clinic_roles"
        ? body.schema_mode
        : "roles";

      const ensureRoleNotInUse = async (roleName: string) => {
        const inUseResult = await supabaseAdmin
          .from("users_profile")
          .select("id", { count: "exact", head: true })
          .eq("role", roleName);

        if (inUseResult.error) {
          throw inUseResult.error;
        }

        if ((inUseResult.count || 0) > 0) {
          throw new Error("Cannot remove this role because it is assigned to one or more users.");
        }
      };

      try {
        if (schemaHint === "roles") {
          let modernRoleLookup = supabaseAdmin
            .from("roles")
            .select("id, name, is_system_default")
            .limit(1);

          if (roleId) {
            modernRoleLookup = modernRoleLookup.eq("id", roleId);
          } else {
            modernRoleLookup = modernRoleLookup.eq("name", normalizedRoleName).is("clinic_id", null);
          }

          const modernRole = await modernRoleLookup.maybeSingle();

          if (modernRole.error) {
            if (!isMissingTableError({ message: modernRole.error.message, code: modernRole.error.code, status: modernRole.status }, "roles")) {
              throw modernRole.error;
            }
          } else if (modernRole.data) {
            if (modernRole.data.is_system_default) {
              return new Response(JSON.stringify({ error: "System default roles cannot be removed." }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              });
            }

            await ensureRoleNotInUse(modernRole.data.name);

            const { error: deleteModernError } = await supabaseAdmin
              .from("roles")
              .delete()
              .eq("id", modernRole.data.id);

            if (deleteModernError) {
              throw deleteModernError;
            }

            return new Response(JSON.stringify({ success: true }), {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }

        if (!normalizedRoleName) {
          return new Response(JSON.stringify({ error: "role_name is required for legacy role deletion." }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (CORE_USER_ROLES.includes(normalizedRoleName)) {
          return new Response(JSON.stringify({ error: "System default roles cannot be removed." }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        await ensureRoleNotInUse(normalizedRoleName);

        let legacyDelete = supabaseAdmin
          .from("clinic_roles")
          .delete()
          .eq("role_name", normalizedRoleName);

        if (callerProfile.role === "clinic_admin" && callerProfile.clinic_id) {
          legacyDelete = supabaseAdmin
            .from("clinic_roles")
            .delete()
            .eq("role_name", normalizedRoleName)
            .eq("clinic_id", callerProfile.clinic_id);
        }

        const { error: deleteLegacyError } = await legacyDelete;

        if (deleteLegacyError) {
          throw deleteLegacyError;
        }

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (deleteRoleErr) {
        const errorObj = deleteRoleErr as { message?: string };
        return new Response(JSON.stringify({ error: errorObj.message || "Failed to delete role." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (action === "update_password") {
      const { user_id, password } = body;
      if (!user_id || !password) {
        return new Response(JSON.stringify({ error: "user_id and password are required." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (password.length < 6) {
        return new Response(JSON.stringify({ error: "Password must be at least 6 characters." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { error } = await supabaseAdmin.auth.admin.updateUserById(user_id, { password });
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete") {
      const { user_id } = body;
      if (!user_id) {
        return new Response(JSON.stringify({ error: "user_id is required." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (user_id === caller.id) {
        return new Response(JSON.stringify({ error: "You cannot delete your own account." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { error: delError } = await supabaseAdmin.auth.admin.deleteUser(user_id);
      if (delError) {
        return new Response(JSON.stringify({ error: delError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update_profile") {
      const { user_id, name, role, clinic_id, is_active } = body;
      if (!user_id) {
        return new Response(JSON.stringify({ error: "user_id is required." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const normalizedRole = role !== undefined ? normalizeRoleName(String(role)) : undefined;

      if (role !== undefined && !normalizedRole) {
        return new Response(JSON.stringify({ error: "Invalid role selected." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (callerProfile.role === "clinic_admin" && normalizedRole === "admin") {
        return new Response(JSON.stringify({ error: "Clinic admins cannot assign admin role." }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const updateData: Record<string, unknown> = {};
      if (name !== undefined) updateData.name = name;
      if (normalizedRole !== undefined) updateData.role = normalizedRole;
      if (clinic_id !== undefined) updateData.clinic_id = clinic_id;
      if (is_active !== undefined) updateData.is_active = is_active;

      if (role !== undefined || clinic_id !== undefined) {
        const { data: currentProfile, error: currentProfileError } = await supabaseAdmin
          .from("users_profile")
          .select("role, clinic_id")
          .eq("id", user_id)
          .maybeSingle();

        if (currentProfileError) {
          return new Response(JSON.stringify({ error: currentProfileError.message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const nextRole = normalizedRole || currentProfile?.role || "receptionist";
        const nextClinicId = clinic_id !== undefined ? clinic_id : currentProfile?.clinic_id || null;

        const roleIsAllowed = await isKnownRole(nextRole, nextClinicId);
        if (!roleIsAllowed) {
          return new Response(JSON.stringify({ error: "Invalid role selected." }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        updateData.dynamic_role_id = await resolveDynamicRoleId(nextRole, nextClinicId);
      }

      const { error: profileError } = await supabaseAdmin
        .from("users_profile")
        .update(updateData)
        .eq("id", user_id);

      if (profileError) {
        return new Response(JSON.stringify({ error: profileError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (name !== undefined || role !== undefined) {
        const metaUpdate: Record<string, unknown> = {};
        if (name !== undefined) metaUpdate.name = name;
        if (normalizedRole !== undefined) metaUpdate.role = normalizedRole;
        await supabaseAdmin.auth.admin.updateUserById(user_id, { user_metadata: metaUpdate });
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { name, email, password, role, clinic_id } = body;

    if (!email || !password || !name) {
      return new Response(JSON.stringify({ error: "Name, email, and password are required." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (password.length < 6) {
      return new Response(JSON.stringify({ error: "Password must be at least 6 characters." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const finalRole = normalizeRoleName(String(role || "receptionist"));

    const targetClinicId = callerProfile.role === "clinic_admin"
      ? callerProfile.clinic_id || null
      : (clinic_id || null);

    if (finalRole !== "admin" && !targetClinicId) {
      return new Response(JSON.stringify({ error: "Please select a clinic for this user." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const roleIsAllowed = await isKnownRole(finalRole, targetClinicId);
    if (!roleIsAllowed) {
      return new Response(JSON.stringify({ error: "Invalid role selected." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (callerProfile.role === "clinic_admin" && finalRole === "admin") {
      return new Response(JSON.stringify({ error: "Clinic admins cannot assign admin role." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const dynamicRoleId = await resolveDynamicRoleId(finalRole, targetClinicId);

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, role: finalRole },
    });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: profileError } = await supabaseAdmin.from("users_profile").upsert({
      id: data.user.id,
      name,
      email,
      role: finalRole,
      clinic_id: targetClinicId,
      dynamic_role_id: dynamicRoleId,
      is_active: true,
    });

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(data.user.id);
      return new Response(JSON.stringify({ error: "Profile error: " + profileError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ user: data.user }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Unexpected error: " + String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
