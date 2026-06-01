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
"[project]/legacy-api/admin/[op].js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>handler
]);
// Vercel serverless function — admin operations for Immuvi user management.
// One handler, dispatches by URL path: /api/admin/<op>.
//
// Replaces tools/auth/admin_server.py for production. service_role key
// stays server-side via Vercel env vars; the browser only sees the
// caller's user JWT.
//
// Env vars (set in Vercel dashboard):
//   SUPABASE_URL                  = https://<ref>.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY     = service_role JWT
//   SUPABASE_ANON_KEY             = optional (for fallback verification)
//
// Auth: every POST requires `Authorization: Bearer <user_jwt>`. We verify
// the JWT by calling Supabase /auth/v1/user, then read the profile to
// confirm the caller is an active admin before doing anything.
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPS = new Set([
    'health',
    'create-user',
    'reset-password',
    'deactivate',
    'reactivate',
    'assign-product',
    'unassign-product',
    'update-products',
    'set-role',
    'delete-user'
]);
// ─── helpers ────────────────────────────────────────────────────────
function gen_password(n = 14) {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
    let s = '';
    const arr = new Uint32Array(n);
    // crypto is global in Node 18+ on Vercel.
    globalThis.crypto.getRandomValues(arr);
    for(let i = 0; i < n; i++)s += alphabet[arr[i] % alphabet.length];
    return s;
}
async function sb_admin(method, path, body) {
    const r = await fetch(`${SUPABASE_URL}/auth/v1${path}`, {
        method,
        headers: {
            'apikey': SERVICE_KEY,
            'Authorization': `Bearer ${SERVICE_KEY}`,
            'Content-Type': 'application/json'
        },
        body: body !== undefined ? JSON.stringify(body) : undefined
    });
    const txt = await r.text();
    if (!r.ok) throw new Error(`HTTP ${r.status} ${method} /auth/v1${path} :: ${txt}`);
    try {
        return JSON.parse(txt);
    } catch  {
        return {};
    }
}
async function sb_rest(method, path, body, opts = {}) {
    const headers = {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json'
    };
    if (opts.prefer) headers['Prefer'] = opts.prefer;
    const r = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined
    });
    const txt = await r.text();
    if (!r.ok) throw new Error(`HTTP ${r.status} ${method} /rest/v1${path} :: ${txt}`);
    if (!txt) return null;
    try {
        return JSON.parse(txt);
    } catch  {
        return null;
    }
}
async function verify_user_jwt(token) {
    try {
        const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
            headers: {
                'apikey': SERVICE_KEY,
                'Authorization': `Bearer ${token}`
            }
        });
        if (!r.ok) return null;
        return await r.json();
    } catch  {
        return null;
    }
}
async function is_active_admin(userId) {
    const rows = await sb_rest('GET', `/profiles?id=eq.${encodeURIComponent(userId)}&select=role,is_active&limit=1`);
    if (!Array.isArray(rows) || !rows.length) return false;
    return rows[0].role === 'admin' && rows[0].is_active === true;
}
async function audit(actorId, action, targetUser = null, targetProduct = null, meta = null) {
    try {
        await sb_rest('POST', '/admin_audit_log', [
            {
                actor_id: actorId,
                action,
                target_user: targetUser,
                target_product: targetProduct,
                meta: meta || {}
            }
        ]);
    } catch (e) {
        // Audit failures are non-fatal — log to function output and continue.
        console.warn('[admin] audit insert failed:', e.message);
    }
}
// ─── ops ────────────────────────────────────────────────────────────
async function op_create_user(actorId, body) {
    const email = (body.email || '').trim().toLowerCase();
    if (!email || !email.includes('@')) throw new Error('valid email required');
    const username = (body.username || '').trim() || email.split('@')[0];
    const full_name = (body.full_name || '').trim();
    const role = [
        'admin',
        'member'
    ].includes(body.role) ? body.role : 'member';
    const password = body.temp_password || gen_password();
    const product_ids = Array.isArray(body.product_ids) ? body.product_ids : [];
    const u = await sb_admin('POST', '/admin/users', {
        email,
        password,
        email_confirm: true,
        user_metadata: {
            full_name,
            username,
            role,
            must_change_password: true
        }
    });
    const new_id = u.id;
    // Trigger created the profile row; sync explicit fields.
    await sb_rest('PATCH', `/profiles?id=eq.${new_id}`, {
        username,
        full_name,
        role,
        must_change_password: true,
        created_by: actorId
    });
    // Assign products.
    if (product_ids.length) {
        await sb_rest('POST', '/user_products', product_ids.map((pid)=>({
                user_id: new_id,
                product_id: pid,
                assigned_by: actorId
            })), {
            prefer: 'resolution=ignore-duplicates'
        });
    }
    await audit(actorId, 'create_user', new_id, null, {
        email,
        role,
        products: product_ids
    });
    return {
        ok: true,
        user_id: new_id,
        email,
        temp_password: password
    };
}
async function op_reset_password(actorId, body) {
    const user_id = body.user_id;
    if (!user_id) throw new Error('user_id required');
    const password = body.temp_password || gen_password();
    await sb_admin('PUT', `/admin/users/${user_id}`, {
        password,
        user_metadata: {
            must_change_password: true
        }
    });
    await sb_rest('PATCH', `/profiles?id=eq.${user_id}`, {
        must_change_password: true
    });
    await audit(actorId, 'reset_password', user_id);
    return {
        ok: true,
        user_id,
        temp_password: password
    };
}
async function op_set_active(actorId, body, active) {
    const user_id = body.user_id;
    if (!user_id) throw new Error('user_id required');
    await sb_admin('PUT', `/admin/users/${user_id}`, {
        ban_duration: active ? 'none' : '876600h'
    });
    await sb_rest('PATCH', `/profiles?id=eq.${user_id}`, {
        is_active: active
    });
    await audit(actorId, active ? 'reactivate' : 'deactivate', user_id);
    return {
        ok: true,
        user_id,
        is_active: active
    };
}
async function op_assign_product(actorId, body) {
    const { user_id, product_id } = body;
    if (!user_id || !product_id) throw new Error('user_id & product_id required');
    await sb_rest('POST', '/user_products', [
        {
            user_id,
            product_id,
            assigned_by: actorId
        }
    ], {
        prefer: 'resolution=ignore-duplicates'
    });
    await audit(actorId, 'assign_product', user_id, product_id);
    return {
        ok: true
    };
}
async function op_unassign_product(actorId, body) {
    const { user_id, product_id } = body;
    if (!user_id || !product_id) throw new Error('user_id & product_id required');
    await sb_rest('DELETE', `/user_products?user_id=eq.${user_id}&product_id=eq.${encodeURIComponent(product_id)}`);
    await audit(actorId, 'unassign_product', user_id, product_id);
    return {
        ok: true
    };
}
async function op_update_products(actorId, body) {
    const user_id = body.user_id;
    const product_ids = Array.isArray(body.product_ids) ? body.product_ids : [];
    if (!user_id) throw new Error('user_id required');
    // Replace strategy: delete all then insert chosen.
    await sb_rest('DELETE', `/user_products?user_id=eq.${user_id}`);
    if (product_ids.length) {
        await sb_rest('POST', '/user_products', product_ids.map((pid)=>({
                user_id,
                product_id: pid,
                assigned_by: actorId
            })), {
            prefer: 'resolution=ignore-duplicates'
        });
    }
    await audit(actorId, 'update_products', user_id, null, {
        products: product_ids
    });
    return {
        ok: true,
        product_ids
    };
}
async function op_set_role(actorId, body) {
    const { user_id, role } = body;
    if (![
        'admin',
        'member'
    ].includes(role)) throw new Error('role must be admin|member');
    if (user_id === actorId && role !== 'admin') throw new Error('cannot demote yourself');
    await sb_rest('PATCH', `/profiles?id=eq.${user_id}`, {
        role
    });
    await audit(actorId, 'set_role', user_id, null, {
        role
    });
    return {
        ok: true,
        role
    };
}
async function op_delete_user(actorId, body) {
    const user_id = body.user_id;
    if (!user_id) throw new Error('user_id required');
    if (user_id === actorId) throw new Error('cannot delete yourself');
    await sb_admin('DELETE', `/admin/users/${user_id}`);
    // CASCADE on profiles (FK) handles user_products cleanup.
    await audit(actorId, 'delete_user', user_id);
    return {
        ok: true
    };
}
async function handler(req, res) {
    // CORS — allow same-origin (default browser behavior) + dev localhost.
    const origin = req.headers.origin || '';
    const allowedOrigins = [
        'http://localhost:8102',
        'http://127.0.0.1:8102'
    ];
    if (allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    }
    if (req.method === 'OPTIONS') return res.status(204).end();
    // Path → op. Vercel passes the [op] dynamic segment via req.query.op.
    const op = req.query && req.query.op || '';
    if (!OPS.has(op)) {
        return res.status(404).json({
            error: `unknown op: ${op}`
        });
    }
    // Health endpoint is unauthenticated.
    if (op === 'health') {
        return res.status(200).json({
            ok: true,
            service: 'immuvi-admin',
            mode: 'vercel'
        });
    }
    if (req.method !== 'POST') {
        return res.status(405).json({
            error: 'POST required'
        });
    }
    if (!SUPABASE_URL || !SERVICE_KEY) {
        return res.status(500).json({
            error: 'admin server misconfigured: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars'
        });
    }
    // Auth gate.
    const authHeader = req.headers.authorization || '';
    if (!authHeader.toLowerCase().startsWith('bearer ')) {
        return res.status(401).json({
            error: 'missing bearer token'
        });
    }
    const token = authHeader.slice(7).trim();
    const user = await verify_user_jwt(token);
    if (!user || !user.id) {
        return res.status(401).json({
            error: 'invalid jwt'
        });
    }
    const actorId = user.id;
    if (!await is_active_admin(actorId)) {
        return res.status(403).json({
            error: 'not an admin'
        });
    }
    // Vercel parses JSON body automatically when content-type is JSON.
    const body = typeof req.body === 'string' ? req.body ? JSON.parse(req.body) : {} : req.body || {};
    try {
        let result;
        switch(op){
            case 'create-user':
                result = await op_create_user(actorId, body);
                break;
            case 'reset-password':
                result = await op_reset_password(actorId, body);
                break;
            case 'deactivate':
                result = await op_set_active(actorId, body, false);
                break;
            case 'reactivate':
                result = await op_set_active(actorId, body, true);
                break;
            case 'assign-product':
                result = await op_assign_product(actorId, body);
                break;
            case 'unassign-product':
                result = await op_unassign_product(actorId, body);
                break;
            case 'update-products':
                result = await op_update_products(actorId, body);
                break;
            case 'set-role':
                result = await op_set_role(actorId, body);
                break;
            case 'delete-user':
                result = await op_delete_user(actorId, body);
                break;
            default:
                return res.status(404).json({
                    error: `unhandled op: ${op}`
                });
        }
        return res.status(200).json(result);
    } catch (e) {
        console.error(`[admin] op=${op} failed:`, e);
        return res.status(500).json({
            error: e.message || String(e)
        });
    }
}
}),
"[project]/app/api/_legacy/runner.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "runLegacyHandler",
    ()=>runLegacyHandler
]);
function headersObject(headers) {
    const out = {};
    headers.forEach((value, key)=>{
        out[key] = value;
        out[key.toLowerCase()] = value;
    });
    return out;
}
function queryObject(url, extra) {
    const out = {};
    url.searchParams.forEach((value, key)=>{
        out[key] = value;
    });
    return {
        ...out,
        ...extra
    };
}
async function parseBody(request) {
    if (request.method === "GET" || request.method === "HEAD") return undefined;
    const text = await request.text();
    if (!text) return undefined;
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
        return JSON.parse(text);
    }
    return text;
}
async function runLegacyHandler(handler, request, extraQuery = {}) {
    const url = new URL(request.url);
    const responseHeaders = new Headers();
    let statusCode = 200;
    let resolved = null;
    const finish = (body)=>{
        if (resolved) return resolved;
        if (body instanceof Response) {
            resolved = body;
            return resolved;
        }
        let payload = null;
        if (body !== undefined && body !== null) {
            payload = typeof body === "string" ? body : JSON.stringify(body);
        }
        resolved = new Response(payload, {
            status: statusCode,
            headers: responseHeaders
        });
        return resolved;
    };
    const req = {
        method: request.method,
        url: `${url.pathname}${url.search}`,
        headers: headersObject(request.headers),
        body: await parseBody(request),
        query: queryObject(url, extraQuery)
    };
    const res = {
        setHeader (name, value) {
            responseHeaders.set(name, value);
        },
        status (code) {
            statusCode = code;
            return res;
        },
        json (value) {
            if (!responseHeaders.has("Content-Type")) {
                responseHeaders.set("Content-Type", "application/json; charset=utf-8");
            }
            return finish(JSON.stringify(value));
        },
        send (value) {
            return finish(value);
        },
        end (value) {
            return finish(value);
        }
    };
    const result = await handler(req, res);
    return finish(result);
}
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
var __TURBOPACK__imported__module__$5b$project$5d2f$legacy$2d$api$2f$admin$2f5b$op$5d2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/legacy-api/admin/[op].js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$api$2f$_legacy$2f$runner$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/api/_legacy/runner.ts [app-route] (ecmascript)");
;
;
const runtime = "nodejs";
const dynamic = "force-dynamic";
async function handle(request, context) {
    const { op } = await context.params;
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$api$2f$_legacy$2f$runner$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["runLegacyHandler"])(__TURBOPACK__imported__module__$5b$project$5d2f$legacy$2d$api$2f$admin$2f5b$op$5d2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"], request, {
        op
    });
}
const GET = handle;
const POST = handle;
const OPTIONS = handle;
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__0_9sfqb._.js.map