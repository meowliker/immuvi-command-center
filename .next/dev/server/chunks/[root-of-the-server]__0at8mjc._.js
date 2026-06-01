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
"[project]/app/api/clickup/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "DELETE",
    ()=>DELETE,
    "GET",
    ()=>GET,
    "OPTIONS",
    ()=>OPTIONS,
    "PATCH",
    ()=>PATCH,
    "POST",
    ()=>POST,
    "PUT",
    ()=>PUT,
    "dynamic",
    ()=>dynamic,
    "runtime",
    ()=>runtime
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$server$2f$supabase$2d$rest$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/server/supabase-rest.ts [app-route] (ecmascript)");
;
const runtime = "nodejs";
const dynamic = "force-dynamic";
const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type"
};
function jsonResponse(body, status) {
    return Response.json(body, {
        status,
        headers: corsHeaders
    });
}
function cleanString(value) {
    return typeof value === "string" ? value.trim() : "";
}
function bearerToken(request) {
    const auth = request.headers.get("authorization") || "";
    const match = auth.match(/^Bearer\s+(.+)$/i);
    return match?.[1] || "";
}
function serverClickUpToken() {
    return process.env.CLICKUP_API_KEY || process.env.CLICKUP_TOKEN || "";
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
async function handle(request) {
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
            return jsonResponse({
                error: "Missing or invalid ?path= parameter (must start with /)"
            }, 400);
        }
        let clickUpAuthorization = request.headers.get("authorization") || "";
        if (useServerToken) {
            const productId = cleanString(url.searchParams.get("productId"));
            if (!productId) return jsonResponse({
                error: "productId is required for server ClickUp calls"
            }, 400);
            const access = await assertProductAccess(request, productId);
            if (!access.ok) return jsonResponse({
                error: access.error
            }, access.status);
            clickUpAuthorization = serverClickUpToken();
            if (!clickUpAuthorization) {
                return jsonResponse({
                    error: "Missing server ClickUp token"
                }, 500);
            }
        }
        const passthrough = new URLSearchParams();
        url.searchParams.forEach((value, key)=>{
            if (key !== "path" && key !== "v" && key !== "server" && key !== "productId") passthrough.append(key, value);
        });
        const queryString = passthrough.toString();
        const target = `https://api.clickup.com/api/${apiVersion}${path}${queryString ? `?${queryString}` : ""}`;
        if (!clickUpAuthorization) {
            return jsonResponse({
                error: "Missing Authorization header (ClickUp personal token)"
            }, 401);
        }
        const body = request.method === "GET" || request.method === "HEAD" ? undefined : await request.text();
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
        return jsonResponse({
            error: "Proxy error",
            detail: error instanceof Error ? error.message : String(error)
        }, 502);
    }
}
const GET = handle;
const POST = handle;
const PUT = handle;
const PATCH = handle;
const DELETE = handle;
const OPTIONS = handle;
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__0at8mjc._.js.map