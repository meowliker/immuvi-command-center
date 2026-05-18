import { supabaseRest, verifySupabaseUser } from "@/lib/server/supabase-rest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type"
};

type ProfileRow = {
  role: string | null;
  is_active: boolean | null;
};

type UserProductRow = {
  product_id: string;
};

function jsonResponse(body: unknown, status: number) {
  return Response.json(body, {
    status,
    headers: corsHeaders
  });
}

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function bearerToken(request: Request) {
  const auth = request.headers.get("authorization") || "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || "";
}

function serverClickUpToken() {
  return process.env.CLICKUP_API_KEY || process.env.CLICKUP_TOKEN || "";
}

async function assertProductAccess(request: Request, productId: string) {
  const token = bearerToken(request);
  if (!token) return { ok: false as const, status: 401, error: "Missing bearer token" };

  const user = await verifySupabaseUser(token);
  if (!user?.id) return { ok: false as const, status: 401, error: "Invalid session" };

  const profiles = await supabaseRest<ProfileRow[]>(
    `/profiles?id=eq.${encodeURIComponent(user.id)}&select=role,is_active&limit=1`
  );
  const profile = profiles?.[0];
  if (!profile?.is_active) return { ok: false as const, status: 403, error: "Inactive user" };
  if (profile.role === "admin") return { ok: true as const };

  const rows = await supabaseRest<UserProductRow[]>(
    `/user_products?user_id=eq.${encodeURIComponent(user.id)}&product_id=eq.${encodeURIComponent(
      productId
    )}&select=product_id&limit=1`
  );
  if (!rows?.length) return { ok: false as const, status: 403, error: "No access to product" };

  return { ok: true as const };
}

async function handle(request: Request) {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  try {
    const url = new URL(request.url);
    const path = url.searchParams.get("path");
    const apiVersion = url.searchParams.get("v") === "3" ? "v3" : "v2";
    const useServerToken = url.searchParams.get("server") === "1";

    if (!path || !path.startsWith("/")) {
      return jsonResponse(
        { error: "Missing or invalid ?path= parameter (must start with /)" },
        400
      );
    }

    let clickUpAuthorization = request.headers.get("authorization") || "";
    if (useServerToken) {
      const productId = cleanString(url.searchParams.get("productId"));
      if (!productId) return jsonResponse({ error: "productId is required for server ClickUp calls" }, 400);

      const access = await assertProductAccess(request, productId);
      if (!access.ok) return jsonResponse({ error: access.error }, access.status);

      clickUpAuthorization = serverClickUpToken();
      if (!clickUpAuthorization) {
        return jsonResponse({ error: "Missing server ClickUp token" }, 500);
      }
    }

    const passthrough = new URLSearchParams();
    url.searchParams.forEach((value, key) => {
      if (key !== "path" && key !== "v" && key !== "server" && key !== "productId") passthrough.append(key, value);
    });

    const queryString = passthrough.toString();
    const target = `https://api.clickup.com/api/${apiVersion}${path}${
      queryString ? `?${queryString}` : ""
    }`;

    if (!clickUpAuthorization) {
      return jsonResponse(
        { error: "Missing Authorization header (ClickUp personal token)" },
        401
      );
    }

    const body =
      request.method === "GET" || request.method === "HEAD"
        ? undefined
        : await request.text();

    const upstream = await fetch(target, {
      method: request.method,
      headers: {
        Authorization: clickUpAuthorization,
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body
    });

    const text = await upstream.text();
    const headers = new Headers(corsHeaders);
    const contentType = upstream.headers.get("content-type");
    if (contentType) headers.set("Content-Type", contentType);

    return new Response(text, {
      status: upstream.status,
      headers
    });
  } catch (error) {
    console.error("[api/clickup] error:", error);
    return jsonResponse(
      {
        error: "Proxy error",
        detail: error instanceof Error ? error.message : String(error)
      },
      502
    );
  }
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export const OPTIONS = handle;
