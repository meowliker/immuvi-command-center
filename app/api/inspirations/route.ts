import { supabaseRest, verifySupabaseUser } from "@/lib/server/supabase-rest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Inspiration = Record<string, unknown> & {
  id?: string;
  sourceUrl?: string;
  url?: string;
  title?: string;
  formatName?: string;
  platform?: string;
  addedBy?: string;
  status?: string;
};

type InspirationRow = {
  id: string;
  data: Record<string, unknown> | null;
};

type ProfileRow = {
  role: string | null;
  is_active: boolean | null;
};

type UserProductRow = {
  product_id: string;
};

const SERVER_OWNED_KEYS = ["_clickupDocPageUrl", "_clickupDocId", "_inspoDocCreated"];

function json(body: unknown, status = 200) {
  return Response.json(body, { status });
}

function bearerToken(request: Request) {
  const auth = request.headers.get("authorization") || "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || "";
}

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function statusFromError(error: unknown) {
  if (error instanceof Error && "status" in error && typeof error.status === "number") return error.status;
  return 500;
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

function rowFromInspiration(productId: string, inspiration: Inspiration, serverData: Record<string, unknown> = {}) {
  const blob: Record<string, unknown> = {};
  Object.keys(inspiration).forEach((key) => {
    const value = inspiration[key];
    if (value !== undefined) blob[key] = value;
  });

  SERVER_OWNED_KEYS.forEach((key) => {
    const serverValue = serverData[key];
    const localValue = blob[key];
    if (
      serverValue !== undefined &&
      serverValue !== null &&
      serverValue !== "" &&
      (localValue === undefined || localValue === null || localValue === "")
    ) {
      blob[key] = serverValue;
    }
  });

  return {
    id: inspiration.id,
    product_id: productId,
    url: inspiration.sourceUrl || inspiration.url || "",
    title: inspiration.title || inspiration.formatName || null,
    platform: inspiration.platform || null,
    added_by: inspiration.addedBy || null,
    status: inspiration.status || "saved",
    data: blob
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const productId = cleanString(body.productId);
    const inspirations = Array.isArray(body.inspirations) ? (body.inspirations as Inspiration[]) : [];

    if (!productId) return json({ error: "productId is required" }, 400);
    if (!inspirations.length) return json({ ok: true, count: 0 });

    const access = await assertProductAccess(request, productId);
    if (!access.ok) return json({ error: access.error }, access.status);

    const ids = inspirations.map((item) => cleanString(item.id)).filter(Boolean);
    const serverDataById: Record<string, Record<string, unknown>> = {};
    if (ids.length) {
      const rows = await supabaseRest<InspirationRow[]>(
        `/inspirations?product_id=eq.${encodeURIComponent(productId)}&id=in.(${ids
          .map(encodeURIComponent)
          .join(",")})&select=id,data`
      );
      (rows || []).forEach((row) => {
        serverDataById[row.id] = row.data || {};
      });
    }

    const rows = inspirations
      .filter((item) => cleanString(item.id))
      .map((item) => rowFromInspiration(productId, item, serverDataById[cleanString(item.id)]));

    const saved = await supabaseRest(
      `/inspirations?on_conflict=id`,
      {
        method: "POST",
        prefer: "resolution=merge-duplicates,return=minimal",
        body: rows
      }
    );

    return json({ ok: true, count: rows.length, saved });
  } catch (error) {
    console.error("[inspirations POST]", error);
    return json(
      {
        error: "Inspiration save failed",
        detail: error instanceof Error ? error.message : String(error)
      },
      statusFromError(error)
    );
  }
}
