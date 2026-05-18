import { supabaseRest, verifySupabaseUser } from "@/lib/server/supabase-rest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type InspirationRow = {
  id: string;
  product_id: string;
  data: Record<string, unknown> | null;
};

type ProfileRow = {
  role: string | null;
  is_active: boolean | null;
};

type UserProductRow = {
  product_id: string;
};

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

type RouteContext = {
  params: Promise<{ insId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { insId } = await context.params;
    const body = (await request.json()) as Record<string, unknown>;
    const productId = cleanString(body.productId);
    const patch = body.patch && typeof body.patch === "object" && !Array.isArray(body.patch)
      ? (body.patch as Record<string, unknown>)
      : {};

    if (!productId) return json({ error: "productId is required" }, 400);
    if (!Object.keys(patch).length) return json({ error: "patch is required" }, 400);

    const access = await assertProductAccess(request, productId);
    if (!access.ok) return json({ error: access.error }, access.status);

    const rows = await supabaseRest<InspirationRow[]>(
      `/inspirations?id=eq.${encodeURIComponent(insId)}&product_id=eq.${encodeURIComponent(
        productId
      )}&select=id,product_id,data&limit=1`
    );
    const existing = rows?.[0];
    if (!existing) return json({ error: "Inspiration not found" }, 404);

    const data = { ...(existing.data || {}), ...patch, id: insId };
    const updateBody: Record<string, unknown> = { data };
    if ("sourceUrl" in patch || "url" in patch) updateBody.url = patch.sourceUrl || patch.url || "";
    if ("title" in patch || "formatName" in patch) updateBody.title = patch.title || patch.formatName || null;
    if ("platform" in patch) updateBody.platform = patch.platform || null;
    if ("addedBy" in patch) updateBody.added_by = patch.addedBy || null;
    if ("status" in patch) updateBody.status = patch.status || "saved";

    const updated = await supabaseRest<InspirationRow[]>(
      `/inspirations?id=eq.${encodeURIComponent(insId)}&product_id=eq.${encodeURIComponent(
        productId
      )}&select=id,product_id,data`,
      {
        method: "PATCH",
        prefer: "return=representation",
        body: updateBody
      }
    );

    return json({ ok: true, inspiration: updated?.[0] || null });
  } catch (error) {
    console.error("[inspirations PATCH]", error);
    return json(
      {
        error: "Inspiration update failed",
        detail: error instanceof Error ? error.message : String(error)
      },
      statusFromError(error)
    );
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { insId } = await context.params;
    const url = new URL(request.url);
    const productId = cleanString(url.searchParams.get("productId"));

    if (!productId) return json({ error: "productId is required" }, 400);

    const access = await assertProductAccess(request, productId);
    if (!access.ok) return json({ error: access.error }, access.status);

    await Promise.all([
      supabaseRest(
        `/inspirations?id=eq.${encodeURIComponent(insId)}&product_id=eq.${encodeURIComponent(productId)}`,
        { method: "DELETE" }
      ),
      supabaseRest(
        `/inspiration_queue?ins_id=eq.${encodeURIComponent(insId)}&product_id=eq.${encodeURIComponent(productId)}`,
        { method: "DELETE" }
      ),
      supabaseRest(
        `/inspiration_results?ins_id=eq.${encodeURIComponent(insId)}&product_id=eq.${encodeURIComponent(productId)}`,
        { method: "DELETE" }
      )
    ]);

    return json({ ok: true, deleted: true, id: insId });
  } catch (error) {
    console.error("[inspirations DELETE]", error);
    return json(
      {
        error: "Inspiration delete failed",
        detail: error instanceof Error ? error.message : String(error)
      },
      statusFromError(error)
    );
  }
}
