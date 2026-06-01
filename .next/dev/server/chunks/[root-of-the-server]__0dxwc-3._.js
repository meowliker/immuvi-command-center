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
"[project]/legacy-api/clickup.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// Vercel Serverless Function — proxies browser → api.clickup.com
// Reason: ClickUp's REST API doesn't allow cross-origin browser calls with
// Authorization headers, so we relay through our own domain.
//
// Frontend calls: /api/clickup?path=/team  (optional ?v=3 for v3 API)
// This function forwards to: https://api.clickup.com/api/v2/team
// (or https://api.clickup.com/api/v3/... when v=3 is passed)
//
// Security:
//  - User's ClickUp API key is forwarded as-is (it lives in their browser localStorage).
//  - No key is stored server-side.
//  - Only api.clickup.com is contacted; no SSRF risk.
__turbopack_context__.s([
    "default",
    ()=>handler
]);
async function handler(req, res) {
    // Basic CORS so the Vercel HTML can call this function
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }
    try {
        const url = new URL(req.url, 'http://x');
        const path = url.searchParams.get('path');
        const apiVersion = url.searchParams.get('v') === '3' ? 'v3' : 'v2';
        if (!path || !path.startsWith('/')) {
            return res.status(400).json({
                error: 'Missing or invalid ?path= parameter (must start with /)'
            });
        }
        // Preserve any additional query params (other than path/v) for the target request
        const passthrough = new URLSearchParams();
        for (const [k, v] of url.searchParams){
            if (k !== 'path' && k !== 'v') passthrough.append(k, v);
        }
        const qs = passthrough.toString();
        const target = `https://api.clickup.com/api/${apiVersion}${path}${qs ? '?' + qs : ''}`;
        // Forward the user's ClickUp token
        const auth = req.headers['authorization'] || req.headers['Authorization'];
        if (!auth) {
            return res.status(401).json({
                error: 'Missing Authorization header (ClickUp personal token)'
            });
        }
        const forwardHeaders = {
            'Authorization': auth,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };
        // Read the request body for non-GET methods
        let body;
        if (req.method !== 'GET' && req.method !== 'HEAD') {
            // Vercel's default body parser leaves req.body populated for JSON content
            body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
        }
        const upstream = await fetch(target, {
            method: req.method,
            headers: forwardHeaders,
            body: body
        });
        const text = await upstream.text();
        res.status(upstream.status);
        // Forward content-type if present
        const ct = upstream.headers.get('content-type');
        if (ct) res.setHeader('Content-Type', ct);
        return res.send(text);
    } catch (err) {
        console.error('[api/clickup] error:', err);
        return res.status(502).json({
            error: 'Proxy error',
            detail: String(err && err.message || err)
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
var __TURBOPACK__imported__module__$5b$project$5d2f$legacy$2d$api$2f$clickup$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/legacy-api/clickup.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$api$2f$_legacy$2f$runner$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/api/_legacy/runner.ts [app-route] (ecmascript)");
;
;
const runtime = "nodejs";
const dynamic = "force-dynamic";
function handle(request) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$api$2f$_legacy$2f$runner$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["runLegacyHandler"])(__TURBOPACK__imported__module__$5b$project$5d2f$legacy$2d$api$2f$clickup$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"], request);
}
const GET = handle;
const POST = handle;
const PUT = handle;
const PATCH = handle;
const DELETE = handle;
const OPTIONS = handle;
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__0dxwc-3._.js.map