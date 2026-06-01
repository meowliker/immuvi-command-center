module.exports = [
"[externals]/next/dist/compiled/next-server/app-route-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-route-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/@opentelemetry/api [external] (next/dist/compiled/@opentelemetry/api, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/@opentelemetry/api", () => require("next/dist/compiled/@opentelemetry/api"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/next-server/app-page-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-page-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-unit-async-storage.external.js [external] (next/dist/server/app-render/work-unit-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-unit-async-storage.external.js", () => require("next/dist/server/app-render/work-unit-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-async-storage.external.js [external] (next/dist/server/app-render/work-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-async-storage.external.js", () => require("next/dist/server/app-render/work-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/shared/lib/no-fallback-error.external.js [external] (next/dist/shared/lib/no-fallback-error.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/shared/lib/no-fallback-error.external.js", () => require("next/dist/shared/lib/no-fallback-error.external.js"));

module.exports = mod;
}),
"[project]/lib/env/server.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "getInstallSkillEnv",
    ()=>getInstallSkillEnv,
    "getSupabaseServerEnv",
    ()=>getSupabaseServerEnv
]);
function requiredEnv(name) {
    const value = process.env[name];
    if (!value) throw new Error(`Missing required environment variable: ${name}`);
    return value;
}
function getSupabaseServerEnv() {
    return {
        url: requiredEnv("SUPABASE_URL"),
        serviceRoleKey: requiredEnv("SUPABASE_SERVICE_ROLE_KEY")
    };
}
function getInstallSkillEnv() {
    return {
        secret: requiredEnv("INSTALL_SKILL_SECRET"),
        serviceRoleKey: requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
        dbPassword: requiredEnv("SUPABASE_DB_PASSWORD")
    };
}
}),
"[project]/lib/server/supabase-rest.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "SupabaseRestError",
    ()=>SupabaseRestError,
    "supabaseRest",
    ()=>supabaseRest,
    "verifySupabaseUser",
    ()=>verifySupabaseUser
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$env$2f$server$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/env/server.ts [app-route] (ecmascript)");
;
class SupabaseRestError extends Error {
    status;
    detail;
    constructor(message, status, detail){
        super(message);
        this.name = "SupabaseRestError";
        this.status = status;
        this.detail = detail;
    }
}
async function supabaseRest(path, options = {}) {
    const { url, serviceRoleKey } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$env$2f$server$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getSupabaseServerEnv"])();
    const headers = {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
        ...options.headers || {}
    };
    if (options.prefer) headers.Prefer = options.prefer;
    const response = await fetch(`${url}/rest/v1${path}`, {
        method: options.method || "GET",
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body)
    });
    const text = await response.text();
    if (!response.ok) {
        throw new SupabaseRestError(`Supabase REST ${response.status}`, response.status, text);
    }
    if (!text) return null;
    return JSON.parse(text);
}
async function verifySupabaseUser(accessToken) {
    const { url, serviceRoleKey } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$env$2f$server$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getSupabaseServerEnv"])();
    const response = await fetch(`${url}/auth/v1/user`, {
        headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${accessToken}`
        }
    });
    if (!response.ok) return null;
    return await response.json();
}
}),
"[project]/app/api/products/[productId]/data/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "GET",
    ()=>GET,
    "dynamic",
    ()=>dynamic,
    "runtime",
    ()=>runtime
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$supabase$2d$rest$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/server/supabase-rest.ts [app-route] (ecmascript)");
;
const runtime = "nodejs";
const dynamic = "force-dynamic";
function json(body, status = 200) {
    return Response.json(body, {
        status
    });
}
function bearerToken(request) {
    const auth = request.headers.get("authorization") || "";
    const match = auth.match(/^Bearer\s+(.+)$/i);
    return match?.[1] || "";
}
function cleanString(value) {
    return typeof value === "string" ? value.trim() : "";
}
function statusFromError(error) {
    if (error instanceof Error && "status" in error && typeof error.status === "number") return error.status;
    return 500;
}
function looksLikeClickUpTaskId(id) {
    if (!id || typeof id !== "string") return false;
    if (/^[A-Z]{2,4}-/.test(id)) return false;
    if (/^(ang|per|prod|ins|ad)-/.test(id)) return false;
    return /^[a-z0-9]{6,12}$/i.test(id);
}
function normalizeTs(value) {
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
function rowToAd(row) {
    const clickupId = row.clickup_task_id || (looksLikeClickUpTaskId(row.id) ? row.id : null);
    const ad = {
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
    Object.keys(meta).forEach((key)=>{
        ad[key] = meta[key];
    });
    return ad;
}
async function assertProductAccess(request, productId) {
    const token = bearerToken(request);
    if (!token) return {
        ok: false,
        status: 401,
        error: "Missing bearer token"
    };
    const user = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$supabase$2d$rest$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["verifySupabaseUser"])(token);
    if (!user?.id) return {
        ok: false,
        status: 401,
        error: "Invalid session"
    };
    const profiles = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$supabase$2d$rest$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["supabaseRest"])(`/profiles?id=eq.${encodeURIComponent(user.id)}&select=role,is_active&limit=1`);
    const profile = profiles?.[0];
    if (!profile?.is_active) return {
        ok: false,
        status: 403,
        error: "Inactive user"
    };
    if (profile.role === "admin") return {
        ok: true
    };
    const rows = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$supabase$2d$rest$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["supabaseRest"])(`/user_products?user_id=eq.${encodeURIComponent(user.id)}&product_id=eq.${encodeURIComponent(productId)}&select=product_id&limit=1`);
    if (!rows?.length) return {
        ok: false,
        status: 403,
        error: "No access to product"
    };
    return {
        ok: true
    };
}
async function GET(request, context) {
    try {
        const { productId: rawProductId } = await context.params;
        const productId = cleanString(rawProductId);
        if (!productId) return json({
            error: "productId is required"
        }, 400);
        const access = await assertProductAccess(request, productId);
        if (!access.ok) return json({
            error: access.error
        }, access.status);
        const [angles, personas, ads, cells, actions] = await Promise.all([
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$supabase$2d$rest$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["supabaseRest"])(`/angles?product_id=eq.${encodeURIComponent(productId)}&select=*`),
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$supabase$2d$rest$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["supabaseRest"])(`/personas?product_id=eq.${encodeURIComponent(productId)}&select=*`),
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$supabase$2d$rest$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["supabaseRest"])(`/ads?product_id=eq.${encodeURIComponent(productId)}&deleted_at=is.null&select=*`),
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$supabase$2d$rest$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["supabaseRest"])(`/matrix_cells?product_id=eq.${encodeURIComponent(productId)}&select=*`),
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$supabase$2d$rest$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["supabaseRest"])(`/manual_actions?product_id=eq.${encodeURIComponent(productId)}&select=*`)
        ]);
        const meta = {};
        const assigns = {};
        const anglePersonasFromCells = {};
        (cells || []).forEach((cell)=>{
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
                Object.keys(perAd).forEach((adId)=>{
                    meta[`${adId}||${cell.angle_id}||${cell.persona_id}`] = perAd[adId] || {};
                });
            }
        });
        return json({
            ok: true,
            source: "api",
            data: {
                ANGLES: (angles || []).map((angle)=>({
                        id: angle.id,
                        name: angle.name,
                        status: angle.status,
                        sourceLink: angle.source_link || "",
                        notes: angle.notes || "",
                        createdAt: angle.created_at ? new Date(angle.created_at).getTime() : null
                    })),
                PERSONAS: (personas || []).map((persona)=>({
                        id: persona.id,
                        name: persona.name,
                        status: persona.status,
                        sourceLink: persona.source_link || "",
                        notes: persona.notes || ""
                    })),
                ADS: (ads || []).map(rowToAd),
                MATRIX_CELL_META: meta,
                CELL_CREATIVE_ASSIGNMENTS: assigns,
                MANUAL_ACTIONS: (actions || []).map((action)=>({
                        ...action.payload || {},
                        _dbId: action.id,
                        liveStatus: action.live_status
                    })),
                PROD: [],
                ANGLE_PERSONAS: anglePersonasFromCells
            }
        });
    } catch (error) {
        console.error("[products data GET]", error);
        return json({
            error: "Product data load failed",
            detail: error instanceof Error ? error.message : String(error)
        }, statusFromError(error));
    }
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__0jkr43d._.js.map