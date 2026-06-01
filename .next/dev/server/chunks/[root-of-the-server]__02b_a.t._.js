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
        if (!path || !path.startsWith("/")) {
            return jsonResponse({
                error: "Missing or invalid ?path= parameter (must start with /)"
            }, 400);
        }
        const passthrough = new URLSearchParams();
        url.searchParams.forEach((value, key)=>{
            if (key !== "path" && key !== "v") passthrough.append(key, value);
        });
        const queryString = passthrough.toString();
        const target = `https://api.clickup.com/api/${apiVersion}${path}${queryString ? `?${queryString}` : ""}`;
        const auth = request.headers.get("authorization");
        if (!auth) {
            return jsonResponse({
                error: "Missing Authorization header (ClickUp personal token)"
            }, 401);
        }
        const body = request.method === "GET" || request.method === "HEAD" ? undefined : await request.text();
        const upstream = await fetch(target, {
            method: request.method,
            headers: {
                Authorization: auth,
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

//# sourceMappingURL=%5Broot-of-the-server%5D__02b_a.t._.js.map