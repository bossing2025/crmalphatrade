import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();

    if (body?.health_check === true) {
      return new Response(JSON.stringify({ status: "ok", function: "db-proxy" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !caller) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: callerRoles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id);

    const hasAccess = callerRoles?.some((r) =>
      ["super_admin", "manager"].includes(r.role)
    );
    if (!hasAccess) {
      return new Response(JSON.stringify({ error: "Not authorized" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { table, operation, data, filters, select, order, limit: queryLimit } = body;

    if (!table || !operation) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: table, operation" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const allowedTables = [
      "affiliates", "advertisers", "advertiser_distribution_settings",
      "advertiser_integration_configs", "advertiser_payouts", "advertiser_email_rejections",
      "affiliate_distribution_rules", "affiliate_payouts", "affiliate_submission_failures",
      "leads", "lead_distributions", "lead_pools", "lead_pool_leads",
      "injections", "injection_leads", "injection_pools", "injection_pool_leads",
      "crm_types", "role_permissions", "user_roles", "user_permissions",
      "profiles", "advertiser_conversions", "global_sent_leads",
      "rejected_leads", "callback_logs", "distribution_round_robin",
    ];

    if (!allowedTables.includes(table)) {
      return new Response(
        JSON.stringify({ error: "Table '" + table + "' is not allowed" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let result;
    const selectFields = select || "*";

    switch (operation) {
      case "select": {
        let query = supabaseAdmin.from(table).select(selectFields);
        if (filters) {
          for (const [key, value] of Object.entries(filters)) {
            if (typeof value === "object" && value !== null && !Array.isArray(value)) {
              const filterObj = value;
              if ("neq" in filterObj) query = query.neq(key, filterObj.neq);
              if ("gt" in filterObj) query = query.gt(key, filterObj.gt);
              if ("gte" in filterObj) query = query.gte(key, filterObj.gte);
              if ("lt" in filterObj) query = query.lt(key, filterObj.lt);
              if ("lte" in filterObj) query = query.lte(key, filterObj.lte);
              if ("like" in filterObj) query = query.like(key, filterObj.like);
              if ("ilike" in filterObj) query = query.ilike(key, filterObj.ilike);
              if ("in" in filterObj) query = query.in(key, filterObj.in);
              if ("is" in filterObj) query = query.is(key, filterObj.is);
            } else {
              query = query.eq(key, value);
            }
          }
        }
        if (order) {
          query = query.order(order.column, { ascending: order.ascending });
        }
        if (queryLimit) {
          query = query.limit(queryLimit);
        }
        const { data: selectData, error } = await query;
        if (error) throw error;
        result = selectData;
        break;
      }
      case "select_single": {
        let query = supabaseAdmin.from(table).select(selectFields);
        if (filters) {
          for (const [key, value] of Object.entries(filters)) {
            query = query.eq(key, value);
          }
        }
        const { data: singleData, error } = await query.maybeSingle();
        if (error) throw error;
        result = singleData;
        break;
      }
      case "insert": {
        const query = supabaseAdmin.from(table).insert(data).select(selectFields);
        const { data: insertData, error } = Array.isArray(data)
          ? await query
          : await query.single();
        if (error) throw error;
        result = insertData;
        break;
      }
      case "update": {
        if (!filters || !filters.id) {
          throw new Error("Update requires filters.id");
        }
        let query = supabaseAdmin.from(table).update(data);
        for (const [key, value] of Object.entries(filters)) {
          query = query.eq(key, value);
        }
        const { data: updateData, error } = await query.select(selectFields).single();
        if (error) throw error;
        result = updateData;
        break;
      }
      case "delete": {
        if (!filters || Object.keys(filters).length === 0) {
          throw new Error("Delete requires at least one filter");
        }
        let query = supabaseAdmin.from(table).delete();
        for (const [key, value] of Object.entries(filters)) {
          query = query.eq(key, value);
        }
        const { error } = await query;
        if (error) throw error;
        result = { success: true };
        break;
      }
      case "upsert": {
        const { data: upsertData, error } = await supabaseAdmin
          .from(table)
          .upsert(data)
          .select(selectFields);
        if (error) throw error;
        result = upsertData;
        break;
      }
      default:
        throw new Error("Unknown operation: " + operation);
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
