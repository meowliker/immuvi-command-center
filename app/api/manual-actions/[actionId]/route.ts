import { supabaseRest, verifySupabaseUser } from "@/lib/server/supabase-rest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ManualActionPayload = Record<string, unknown> & {
  id?: string;
  adId?: string;
  sourceAdId?: string;
  sourceAngle?: string;
  sourcePersona?: string;
  dueDate?: string;
  liveStatus?: string;
};

type ManualActionRow = {
  id: string;
  product_id: string;
  payload: ManualActionPayload | null;
  live_status: string | null;
};

type ProfileRow = {
  role: string | null;
  is_active: boolean | null;
};

type UserProductRow = {
  product_id: string;
};

type AdRow = {
  id: string;
  status: string | null;
  last_status_change_at: number | string | null;
};

type MatrixCellRow = {
  id: string;
  meta: Record<string, unknown> | null;
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

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

async function updateLinkedAdStatus(productId: string, adId: string, status: string, changedAt: number) {
  if (!adId || !status) return null;

  const updated = await supabaseRest<AdRow[]>(
    `/ads?id=eq.${encodeURIComponent(adId)}&product_id=eq.${encodeURIComponent(
      productId
    )}&select=id,status,last_status_change_at`,
    {
      method: "PATCH",
      prefer: "return=representation",
      body: {
        status,
        last_status_change_at: changedAt,
        updated_at: new Date(changedAt).toISOString()
      }
    }
  );

  return updated?.[0] || null;
}

async function updateLinkedMatrixStatus(
  productId: string,
  adId: string,
  angleId: string,
  personaId: string,
  status: string
) {
  if (!adId || !angleId || !personaId || !status) return null;

  const rows = await supabaseRest<MatrixCellRow[]>(
    `/matrix_cells?product_id=eq.${encodeURIComponent(productId)}&angle_id=eq.${encodeURIComponent(
      angleId
    )}&persona_id=eq.${encodeURIComponent(personaId)}&select=id,meta&limit=1`
  );
  const cell = rows?.[0];
  if (!cell) return null;

  const meta = { ...asRecord(cell.meta) };
  const perAd = { ...asRecord(meta.per_ad) };
  perAd[adId] = {
    ...asRecord(perAd[adId]),
    status,
    actionStatus: status
  };
  meta.per_ad = perAd;

  const updated = await supabaseRest<MatrixCellRow[]>(
    `/matrix_cells?id=eq.${encodeURIComponent(cell.id)}&select=id,meta`,
    {
      method: "PATCH",
      prefer: "return=representation",
      body: { meta }
    }
  );

  return updated?.[0] || null;
}

async function assertProductAccess(request: Request, productId: string) {
  const token = bearerToken(request);
  if (!token) return { ok: false as const, status: 401, error: "Missing bearer token" };

  const user = await verifySupabaseUser(token);
  if (!user?.id) return { ok: false as const, status: 401, error: "Invalid session" };

  const profilePath = `/profiles?id=eq.${encodeURIComponent(user.id)}&select=role,is_active&limit=1`;
  const profiles = await supabaseRest<ProfileRow[]>(profilePath);
  const profile = profiles?.[0];
  if (!profile?.is_active) return { ok: false as const, status: 403, error: "Inactive user" };
  if (profile.role === "admin") return { ok: true as const, userId: user.id };

  const accessPath = `/user_products?user_id=eq.${encodeURIComponent(user.id)}&product_id=eq.${encodeURIComponent(
    productId
  )}&select=product_id&limit=1`;
  const rows = await supabaseRest<UserProductRow[]>(accessPath);
  if (!rows?.length) return { ok: false as const, status: 403, error: "No access to product" };

  return { ok: true as const, userId: user.id };
}

async function findManualAction(productId: string, actionId: string, dbId?: string) {
  const select = "select=id,product_id,payload,live_status";
  const rows = dbId
    ? await supabaseRest<ManualActionRow[]>(
        `/manual_actions?id=eq.${encodeURIComponent(dbId)}&product_id=eq.${encodeURIComponent(productId)}&${select}&limit=1`
      )
    : await supabaseRest<ManualActionRow[]>(
        `/manual_actions?product_id=eq.${encodeURIComponent(productId)}&payload->>id=eq.${encodeURIComponent(
          actionId
        )}&${select}&limit=1`
      );

  return rows?.[0] || null;
}

type RouteContext = {
  params: Promise<{ actionId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { actionId } = await context.params;
    const body = (await request.json()) as Record<string, unknown>;
    const productId = cleanString(body.productId);
    const dbId = cleanString(body.dbId);
    const status = cleanString(body.status);
    const dueDate = cleanString(body.dueDate);

    if (!productId) return json({ error: "productId is required" }, 400);
    if (!status && !dueDate) return json({ error: "status or dueDate is required" }, 400);

    const access = await assertProductAccess(request, productId);
    if (!access.ok) return json({ error: access.error }, access.status);

    const row = await findManualAction(productId, actionId, dbId);
    if (!row) return json({ error: "Manual action not found" }, 404);

    const payload: ManualActionPayload = { ...(row.payload || {}) };
    const changedAt = Date.now();
    if (status) {
      payload.liveStatus = status;
      payload._liveStatusChangedAt = changedAt;
    }
    if (dueDate) payload.dueDate = dueDate;

    const updateBody: Record<string, unknown> = { payload };
    if (status) updateBody.live_status = status;

    const updated = await supabaseRest<ManualActionRow[]>(
      `/manual_actions?id=eq.${encodeURIComponent(row.id)}&select=id,product_id,payload,live_status`,
      {
        method: "PATCH",
        prefer: "return=representation",
        body: updateBody
      }
    );

    const linked: Record<string, unknown> = {};
    if (status) {
      const sourceAdId = cleanString(payload.sourceAdId) || cleanString(payload.adId);
      const sourceAngle = cleanString(payload.sourceAngle);
      const sourcePersona = cleanString(payload.sourcePersona);

      const [ad, matrixCell] = await Promise.all([
        updateLinkedAdStatus(productId, sourceAdId, status, changedAt),
        updateLinkedMatrixStatus(productId, sourceAdId, sourceAngle, sourcePersona, status)
      ]);

      linked.ad = ad;
      linked.matrixCell = matrixCell;
    }

    return json({ ok: true, action: updated?.[0] || null, linked });
  } catch (error) {
    console.error("[manual-actions PATCH]", error);
    return json(
      {
        error: "Manual action update failed",
        detail: error instanceof Error ? error.message : String(error)
      },
      statusFromError(error)
    );
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { actionId } = await context.params;
    const url = new URL(request.url);
    const productId = cleanString(url.searchParams.get("productId"));
    const dbId = cleanString(url.searchParams.get("dbId"));

    if (!productId) return json({ error: "productId is required" }, 400);

    const access = await assertProductAccess(request, productId);
    if (!access.ok) return json({ error: access.error }, access.status);

    const row = await findManualAction(productId, actionId, dbId);
    if (!row) return json({ ok: true, deleted: false });

    await supabaseRest(`/manual_actions?id=eq.${encodeURIComponent(row.id)}`, {
      method: "DELETE"
    });

    return json({ ok: true, deleted: true, id: row.id });
  } catch (error) {
    console.error("[manual-actions DELETE]", error);
    return json(
      {
        error: "Manual action delete failed",
        detail: error instanceof Error ? error.message : String(error)
      },
      statusFromError(error)
    );
  }
}
