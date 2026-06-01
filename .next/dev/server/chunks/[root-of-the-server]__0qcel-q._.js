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
"[project]/app/api/admin/[op]/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "GET",
    ()=>GET,
    "OPTIONS",
    ()=>OPTIONS,
    "POST",
    ()=>POST,
    "dynamic",
    ()=>dynamic,
    "runtime",
    ()=>runtime
]);
const runtime = "nodejs";
const dynamic = "force-dynamic";
const OPS = new Set([
    "health",
    "create-user",
    "reset-password",
    "deactivate",
    "reactivate",
    "assign-product",
    "unassign-product",
    "update-products",
    "set-role",
    "delete-user"
]);
const allowedOrigins = new Set([
    "http://localhost:8102",
    "http://127.0.0.1:8102"
]);
function env() {
    return {
        supabaseUrl: process.env.SUPABASE_URL,
        serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY
    };
}
function corsHeaders(request) {
    const origin = request.headers.get("origin") || "";
    const headers = new Headers();
    if (allowedOrigins.has(origin) || origin.endsWith(".vercel.app")) {
        headers.set("Access-Control-Allow-Origin", origin);
        headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
        headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    }
    return headers;
}
function json(request, body, status = 200) {
    return Response.json(body, {
        status,
        headers: corsHeaders(request)
    });
}
function genPassword(n = 14) {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";
    let password = "";
    const values = new Uint32Array(n);
    globalThis.crypto.getRandomValues(values);
    for(let i = 0; i < n; i += 1){
        password += alphabet[values[i] % alphabet.length];
    }
    return password;
}
async function sbAdmin(method, route, body) {
    const { supabaseUrl, serviceKey } = env();
    const response = await fetch(`${supabaseUrl}/auth/v1${route}`, {
        method,
        headers: {
            apikey: serviceKey || "",
            Authorization: `Bearer ${serviceKey}`,
            "Content-Type": "application/json"
        },
        body: body !== undefined ? JSON.stringify(body) : undefined
    });
    const text = await response.text();
    if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${method} /auth/v1${route} :: ${text}`);
    }
    try {
        return JSON.parse(text);
    } catch  {
        return {};
    }
}
async function sbRest(method, route, body, opts = {}) {
    const { supabaseUrl, serviceKey } = env();
    const headers = {
        apikey: serviceKey || "",
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json"
    };
    if (opts.prefer) headers.Prefer = opts.prefer;
    const response = await fetch(`${supabaseUrl}/rest/v1${route}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined
    });
    const text = await response.text();
    if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${method} /rest/v1${route} :: ${text}`);
    }
    if (!text) return null;
    try {
        return JSON.parse(text);
    } catch  {
        return null;
    }
}
async function verifyUserJwt(token) {
    const { supabaseUrl, serviceKey } = env();
    try {
        const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
            headers: {
                apikey: serviceKey || "",
                Authorization: `Bearer ${token}`
            }
        });
        if (!response.ok) return null;
        return await response.json();
    } catch  {
        return null;
    }
}
async function isActiveAdmin(userId) {
    const rows = await sbRest("GET", `/profiles?id=eq.${encodeURIComponent(userId)}&select=role,is_active&limit=1`);
    if (!Array.isArray(rows) || rows.length === 0) return false;
    return rows[0].role === "admin" && rows[0].is_active === true;
}
async function audit(actorId, action, targetUser = null, targetProduct = null, meta = null) {
    try {
        await sbRest("POST", "/admin_audit_log", [
            {
                actor_id: actorId,
                action,
                target_user: targetUser,
                target_product: targetProduct,
                meta: meta || {}
            }
        ]);
    } catch (error) {
        console.warn("[admin] audit insert failed:", error instanceof Error ? error.message : String(error));
    }
}
function stringValue(body, key) {
    const value = body[key];
    return typeof value === "string" ? value : "";
}
function stringArrayValue(body, key) {
    const value = body[key];
    return Array.isArray(value) ? value.filter((item)=>typeof item === "string") : [];
}
async function opCreateUser(actorId, body) {
    const email = stringValue(body, "email").trim().toLowerCase();
    if (!email || !email.includes("@")) throw new Error("valid email required");
    const username = stringValue(body, "username").trim() || email.split("@")[0];
    const fullName = stringValue(body, "full_name").trim();
    const bodyRole = stringValue(body, "role");
    const role = [
        "admin",
        "member"
    ].includes(bodyRole) ? bodyRole : "member";
    const password = stringValue(body, "temp_password") || genPassword();
    const productIds = stringArrayValue(body, "product_ids");
    const user = await sbAdmin("POST", "/admin/users", {
        email,
        password,
        email_confirm: true,
        user_metadata: {
            full_name: fullName,
            username,
            role,
            must_change_password: true
        }
    });
    const newId = user.id;
    await sbRest("PATCH", `/profiles?id=eq.${newId}`, {
        username,
        full_name: fullName,
        role,
        must_change_password: true,
        created_by: actorId
    });
    if (productIds.length) {
        await sbRest("POST", "/user_products", productIds.map((productId)=>({
                user_id: newId,
                product_id: productId,
                assigned_by: actorId
            })), {
            prefer: "resolution=ignore-duplicates"
        });
    }
    await audit(actorId, "create_user", newId, null, {
        email,
        role,
        products: productIds
    });
    return {
        ok: true,
        user_id: newId,
        email,
        temp_password: password
    };
}
async function opResetPassword(actorId, body) {
    const userId = stringValue(body, "user_id");
    if (!userId) throw new Error("user_id required");
    const password = stringValue(body, "temp_password") || genPassword();
    await sbAdmin("PUT", `/admin/users/${userId}`, {
        password,
        user_metadata: {
            must_change_password: true
        }
    });
    await sbRest("PATCH", `/profiles?id=eq.${userId}`, {
        must_change_password: true
    });
    await audit(actorId, "reset_password", userId);
    return {
        ok: true,
        user_id: userId,
        temp_password: password
    };
}
async function opSetActive(actorId, body, active) {
    const userId = stringValue(body, "user_id");
    if (!userId) throw new Error("user_id required");
    await sbAdmin("PUT", `/admin/users/${userId}`, {
        ban_duration: active ? "none" : "876600h"
    });
    await sbRest("PATCH", `/profiles?id=eq.${userId}`, {
        is_active: active
    });
    await audit(actorId, active ? "reactivate" : "deactivate", userId);
    return {
        ok: true,
        user_id: userId,
        is_active: active
    };
}
async function opAssignProduct(actorId, body) {
    const userId = stringValue(body, "user_id");
    const productId = stringValue(body, "product_id");
    if (!userId || !productId) throw new Error("user_id & product_id required");
    await sbRest("POST", "/user_products", [
        {
            user_id: userId,
            product_id: productId,
            assigned_by: actorId
        }
    ], {
        prefer: "resolution=ignore-duplicates"
    });
    await audit(actorId, "assign_product", userId, productId);
    return {
        ok: true
    };
}
async function opUnassignProduct(actorId, body) {
    const userId = stringValue(body, "user_id");
    const productId = stringValue(body, "product_id");
    if (!userId || !productId) throw new Error("user_id & product_id required");
    await sbRest("DELETE", `/user_products?user_id=eq.${userId}&product_id=eq.${encodeURIComponent(productId)}`);
    await audit(actorId, "unassign_product", userId, productId);
    return {
        ok: true
    };
}
async function opUpdateProducts(actorId, body) {
    const userId = stringValue(body, "user_id");
    const productIds = stringArrayValue(body, "product_ids");
    if (!userId) throw new Error("user_id required");
    await sbRest("DELETE", `/user_products?user_id=eq.${userId}`);
    if (productIds.length) {
        await sbRest("POST", "/user_products", productIds.map((productId)=>({
                user_id: userId,
                product_id: productId,
                assigned_by: actorId
            })), {
            prefer: "resolution=ignore-duplicates"
        });
    }
    await audit(actorId, "update_products", userId, null, {
        products: productIds
    });
    return {
        ok: true,
        product_ids: productIds
    };
}
async function opSetRole(actorId, body) {
    const userId = stringValue(body, "user_id");
    const role = stringValue(body, "role");
    if (![
        "admin",
        "member"
    ].includes(role)) throw new Error("role must be admin|member");
    if (userId === actorId && role !== "admin") throw new Error("cannot demote yourself");
    await sbRest("PATCH", `/profiles?id=eq.${userId}`, {
        role
    });
    await audit(actorId, "set_role", userId, null, {
        role
    });
    return {
        ok: true,
        role
    };
}
async function opDeleteUser(actorId, body) {
    const userId = stringValue(body, "user_id");
    if (!userId) throw new Error("user_id required");
    if (userId === actorId) throw new Error("cannot delete yourself");
    await sbAdmin("DELETE", `/admin/users/${userId}`);
    await audit(actorId, "delete_user", userId);
    return {
        ok: true
    };
}
async function parseBody(request) {
    const text = await request.text();
    if (!text) return {};
    return JSON.parse(text);
}
async function handle(request, context) {
    if (request.method === "OPTIONS") {
        return new Response(null, {
            status: 204,
            headers: corsHeaders(request)
        });
    }
    const { op } = await context.params;
    if (!OPS.has(op)) {
        return json(request, {
            error: `unknown op: ${op}`
        }, 404);
    }
    if (op === "health") {
        return json(request, {
            ok: true,
            service: "immuvi-admin",
            mode: "vercel"
        });
    }
    if (request.method !== "POST") {
        return json(request, {
            error: "POST required"
        }, 405);
    }
    const { supabaseUrl, serviceKey } = env();
    if (!supabaseUrl || !serviceKey) {
        return json(request, {
            error: "admin server misconfigured: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars"
        }, 500);
    }
    const authHeader = request.headers.get("authorization") || "";
    if (!authHeader.toLowerCase().startsWith("bearer ")) {
        return json(request, {
            error: "missing bearer token"
        }, 401);
    }
    const token = authHeader.slice(7).trim();
    const user = await verifyUserJwt(token);
    if (!user?.id) {
        return json(request, {
            error: "invalid jwt"
        }, 401);
    }
    const actorId = user.id;
    if (!await isActiveAdmin(actorId)) {
        return json(request, {
            error: "not an admin"
        }, 403);
    }
    try {
        const body = await parseBody(request);
        let result;
        switch(op){
            case "create-user":
                result = await opCreateUser(actorId, body);
                break;
            case "reset-password":
                result = await opResetPassword(actorId, body);
                break;
            case "deactivate":
                result = await opSetActive(actorId, body, false);
                break;
            case "reactivate":
                result = await opSetActive(actorId, body, true);
                break;
            case "assign-product":
                result = await opAssignProduct(actorId, body);
                break;
            case "unassign-product":
                result = await opUnassignProduct(actorId, body);
                break;
            case "update-products":
                result = await opUpdateProducts(actorId, body);
                break;
            case "set-role":
                result = await opSetRole(actorId, body);
                break;
            case "delete-user":
                result = await opDeleteUser(actorId, body);
                break;
            default:
                return json(request, {
                    error: `unhandled op: ${op}`
                }, 404);
        }
        return json(request, result);
    } catch (error) {
        console.error(`[admin] op=${op} failed:`, error);
        return json(request, {
            error: error instanceof Error ? error.message : String(error)
        }, 500);
    }
}
const GET = handle;
const POST = handle;
const OPTIONS = handle;
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__0qcel-q._.js.map