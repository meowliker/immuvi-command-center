import { supabaseRest, verifySupabaseUser } from "@/lib/server/supabase-rest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ProfileRow = {
  role: string | null;
  is_active: boolean | null;
};

type UserProductRow = {
  product_id: string;
};

type AngleRow = {
  id: string;
  name: string | null;
  status: string | null;
  source_link: string | null;
  notes: string | null;
  created_at: string | null;
};

type PersonaRow = {
  id: string;
  name: string | null;
  status: string | null;
  source_link: string | null;
  notes: string | null;
};

type AdRow = Record<string, unknown> & {
  id: string;
  format_name?: string | null;
  ad_link?: string | null;
  drive_link?: string | null;
  ad_type?: string | null;
  funnel_stage?: string | null;
  status?: string | null;
  angle?: string | null;
  persona?: string | null;
  parent_ad_id?: string | null;
  variation_number?: string | null;
  ad_origin?: string | null;
  clickup_task_id?: string | null;
  created_at?: string | number | null;
  updated_at?: string | number | null;
  last_status_change_at?: string | number | null;
  testing_deferred_at?: string | number | null;
  testing_defer_count?: number | null;
  meta?: Record<string, unknown> | null;
};

type MatrixCellRow = {
  id: string;
  angle_id: string | null;
  persona_id: string | null;
  meta: {
    cell_key?: string;
    meta?: Record<string, unknown>;
    per_ad?: Record<string, unknown>;
  } | null;
  creative_assignments: unknown[] | null;
};

type ManualActionRow = {
  id: string;
  payload: Record<string, unknown> | null;
  live_status: string | null;
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

function looksLikeClickUpTaskId(id: unknown) {
  if (!id || typeof id !== "string") return false;
  if (/^[A-Z]{2,4}-/.test(id)) return false;
  if (/^(ang|per|prod|ins|ad)-/.test(id)) return false;
  return /^[a-z0-9]{6,12}$/i.test(id);
}

function normalizeTs(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    if (/^\d+$/.test(value)) {
      const parsed = Number.parseInt(value, 10);
      return Number.isFinite(parsed) ? parsed : null;
    }
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function rowToAd(row: AdRow) {
  const clickupId = row.clickup_task_id || (looksLikeClickUpTaskId(row.id) ? row.id : null);
  const ad: Record<string, unknown> = {
    id: row.id,
    formatName: row.format_name,
    adLink: row.ad_link,
    driveLink: row.drive_link,
    adType: row.ad_type,
    funnelStage: row.funnel_stage,
    status: row.status,
    angle: row.angle,
    persona: row.persona,
    parentAdId: row.parent_ad_id,
    variationNumber: row.variation_number,
    adOrigin: row.ad_origin,
    clickupTaskId: row.clickup_task_id || null,
    _clickupId: clickupId,
    createdAt: normalizeTs(row.created_at),
    updatedAt: normalizeTs(row.updated_at),
    lastStatusChangeAt: normalizeTs(row.last_status_change_at) || normalizeTs(row.updated_at) || null,
    testingDeferredAt: row.testing_deferred_at || null,
    testingDeferCount: typeof row.testing_defer_count === "number" ? row.testing_defer_count : 0,
    _clickupUrl: clickupId ? `https://app.clickup.com/t/${clickupId}` : ""
  };

  const meta = row.meta || {};
  Object.keys(meta).forEach((key) => {
    ad[key] = meta[key];
  });
  return ad;
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
  params: Promise<{ productId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const { productId: rawProductId } = await context.params;
    const productId = cleanString(rawProductId);
    if (!productId) return json({ error: "productId is required" }, 400);

    const access = await assertProductAccess(request, productId);
    if (!access.ok) return json({ error: access.error }, access.status);

    const [angles, personas, ads, cells, actions] = await Promise.all([
      supabaseRest<AngleRow[]>(`/angles?product_id=eq.${encodeURIComponent(productId)}&select=*`),
      supabaseRest<PersonaRow[]>(`/personas?product_id=eq.${encodeURIComponent(productId)}&select=*`),
      supabaseRest<AdRow[]>(
        `/ads?product_id=eq.${encodeURIComponent(productId)}&deleted_at=is.null&select=*`
      ),
      supabaseRest<MatrixCellRow[]>(`/matrix_cells?product_id=eq.${encodeURIComponent(productId)}&select=*`),
      supabaseRest<ManualActionRow[]>(`/manual_actions?product_id=eq.${encodeURIComponent(productId)}&select=*`)
    ]);

    const meta: Record<string, unknown> = {};
    const assigns: Record<string, unknown[]> = {};
    const anglePersonasFromCells: Record<string, string[]> = {};

    (cells || []).forEach((cell) => {
      const cellKey = cell.meta?.cell_key || `${cell.angle_id}||${cell.persona_id}`;
      meta[cellKey] = cell.meta?.meta || {};
      assigns[cellKey] = cell.creative_assignments || [];

      if (cell.angle_id && cell.persona_id) {
        anglePersonasFromCells[cell.angle_id] ||= [];
        if (!anglePersonasFromCells[cell.angle_id].includes(cell.persona_id)) {
          anglePersonasFromCells[cell.angle_id].push(cell.persona_id);
        }
      }

      const perAd = cell.meta?.per_ad;
      if (perAd && typeof perAd === "object") {
        Object.keys(perAd).forEach((adId) => {
          meta[`${adId}||${cell.angle_id}||${cell.persona_id}`] = perAd[adId] || {};
        });
      }
    });

    return json({
      ok: true,
      source: "api",
      data: {
        ANGLES: (angles || []).map((angle) => ({
          id: angle.id,
          name: angle.name,
          status: angle.status,
          sourceLink: angle.source_link || "",
          notes: angle.notes || "",
          createdAt: angle.created_at ? new Date(angle.created_at).getTime() : null
        })),
        PERSONAS: (personas || []).map((persona) => ({
          id: persona.id,
          name: persona.name,
          status: persona.status,
          sourceLink: persona.source_link || "",
          notes: persona.notes || ""
        })),
        ADS: (ads || []).map(rowToAd),
        MATRIX_CELL_META: meta,
        CELL_CREATIVE_ASSIGNMENTS: assigns,
        MANUAL_ACTIONS: (actions || []).map((action) => ({
          ...(action.payload || {}),
          _dbId: action.id,
          liveStatus: action.live_status
        })),
        PROD: [],
        ANGLE_PERSONAS: anglePersonasFromCells
      }
    });
  } catch (error) {
    console.error("[products data GET]", error);
    return json(
      {
        error: "Product data load failed",
        detail: error instanceof Error ? error.message : String(error)
      },
      statusFromError(error)
    );
  }
}
