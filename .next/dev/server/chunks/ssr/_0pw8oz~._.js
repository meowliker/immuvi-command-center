module.exports = [
"[project]/components/command-center/CommandCenterHeader.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "CommandCenterHeader",
    ()=>CommandCenterHeader,
    "dashboardTabs",
    ()=>dashboardTabs
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
"use client";
;
const dashboardTabs = [
    {
        id: "hq",
        label: "Command HQ"
    },
    {
        id: "angles",
        label: "Angles",
        countId: "anglesCount"
    },
    {
        id: "personas",
        label: "Personas",
        countId: "personasCount"
    },
    {
        id: "creatives",
        label: "Creative Tracker",
        countId: "creativesCount"
    },
    {
        id: "matrix",
        label: "Creative Matrix",
        countId: "matrixCount"
    },
    {
        id: "actions",
        label: "Action Plan",
        countId: "actionsCount"
    },
    {
        id: "production",
        label: "Production",
        countId: "prodCount"
    },
    {
        id: "strategist",
        label: "Strategist",
        countId: "strategistCount"
    },
    {
        id: "inspiration",
        label: "Inspiration",
        countId: "inspirationCount"
    }
];
function CommandCenterHeader({ activeTab, activeProductId, apiKey, counts, forceReloadVisible, productColor, productMenuOpen, productName, products, statusText, onApiKeyChange, onAddProduct, onForceReload, onPresenceClick, onProductClick, onProductSelect, onReset, onSync, onSyncNow, onTabSelect }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("header", {
                className: "next-hdr",
                "aria-label": "Immuvi Command Center header",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "next-hdr-inner",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "next-hdr-logo",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "next-hdr-logo-name",
                                            children: "Immuvi Command Center"
                                        }, void 0, false, {
                                            fileName: "[project]/components/command-center/CommandCenterHeader.tsx",
                                            lineNumber: 76,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "next-hdr-logo-sub",
                                            children: "Kids Mental Health Creative Ops"
                                        }, void 0, false, {
                                            fileName: "[project]/components/command-center/CommandCenterHeader.tsx",
                                            lineNumber: 77,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/components/command-center/CommandCenterHeader.tsx",
                                    lineNumber: 75,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "next-hdr-prod-wrap",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                            className: "next-hdr-prod-btn",
                                            onClick: onProductClick,
                                            type: "button",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "next-hdr-prod-dot",
                                                    style: {
                                                        background: productColor || "#94A3B8"
                                                    }
                                                }, void 0, false, {
                                                    fileName: "[project]/components/command-center/CommandCenterHeader.tsx",
                                                    lineNumber: 81,
                                                    columnNumber: 15
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    children: productName || "No Product"
                                                }, void 0, false, {
                                                    fileName: "[project]/components/command-center/CommandCenterHeader.tsx",
                                                    lineNumber: 82,
                                                    columnNumber: 15
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
                                                    width: "10",
                                                    height: "6",
                                                    viewBox: "0 0 10 6",
                                                    fill: "none",
                                                    "aria-hidden": "true",
                                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                                                        d: "M1 1L5 5L9 1",
                                                        stroke: "currentColor",
                                                        strokeLinecap: "round",
                                                        strokeLinejoin: "round",
                                                        strokeWidth: "1.5"
                                                    }, void 0, false, {
                                                        fileName: "[project]/components/command-center/CommandCenterHeader.tsx",
                                                        lineNumber: 84,
                                                        columnNumber: 17
                                                    }, this)
                                                }, void 0, false, {
                                                    fileName: "[project]/components/command-center/CommandCenterHeader.tsx",
                                                    lineNumber: 83,
                                                    columnNumber: 15
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/components/command-center/CommandCenterHeader.tsx",
                                            lineNumber: 80,
                                            columnNumber: 13
                                        }, this),
                                        productMenuOpen ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "next-hdr-prod-dd",
                                            children: [
                                                products.map((product)=>{
                                                    const isActive = product.id === activeProductId;
                                                    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                        className: isActive ? "next-hdr-prod-dd-item active" : "next-hdr-prod-dd-item",
                                                        onClick: ()=>onProductSelect(product.id),
                                                        type: "button",
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                className: "next-hdr-prod-dd-dot",
                                                                style: {
                                                                    background: product.color || "#4F46E5"
                                                                }
                                                            }, void 0, false, {
                                                                fileName: "[project]/components/command-center/CommandCenterHeader.tsx",
                                                                lineNumber: 104,
                                                                columnNumber: 25
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                className: "next-hdr-prod-dd-name",
                                                                children: product.name
                                                            }, void 0, false, {
                                                                fileName: "[project]/components/command-center/CommandCenterHeader.tsx",
                                                                lineNumber: 105,
                                                                columnNumber: 25
                                                            }, this),
                                                            product.clickupListId ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                className: "next-hdr-prod-dd-badge",
                                                                children: "✓ ClickUp"
                                                            }, void 0, false, {
                                                                fileName: "[project]/components/command-center/CommandCenterHeader.tsx",
                                                                lineNumber: 106,
                                                                columnNumber: 50
                                                            }, this) : null,
                                                            isActive ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                className: "next-hdr-prod-check",
                                                                children: "✓"
                                                            }, void 0, false, {
                                                                fileName: "[project]/components/command-center/CommandCenterHeader.tsx",
                                                                lineNumber: 107,
                                                                columnNumber: 37
                                                            }, this) : null
                                                        ]
                                                    }, product.id, true, {
                                                        fileName: "[project]/components/command-center/CommandCenterHeader.tsx",
                                                        lineNumber: 98,
                                                        columnNumber: 23
                                                    }, this);
                                                }),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                    className: "next-hdr-prod-dd-item",
                                                    onClick: onAddProduct,
                                                    type: "button",
                                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        className: "next-hdr-prod-dd-add",
                                                        children: "Add Product"
                                                    }, void 0, false, {
                                                        fileName: "[project]/components/command-center/CommandCenterHeader.tsx",
                                                        lineNumber: 112,
                                                        columnNumber: 21
                                                    }, this)
                                                }, void 0, false, {
                                                    fileName: "[project]/components/command-center/CommandCenterHeader.tsx",
                                                    lineNumber: 111,
                                                    columnNumber: 19
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/components/command-center/CommandCenterHeader.tsx",
                                            lineNumber: 94,
                                            columnNumber: 17
                                        }, this) : null
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/components/command-center/CommandCenterHeader.tsx",
                                    lineNumber: 79,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/components/command-center/CommandCenterHeader.tsx",
                            lineNumber: 74,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "next-hdr-right",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                    className: "next-api-inp",
                                    onChange: (event)=>onApiKeyChange(event.target.value),
                                    placeholder: "ClickUp API Key",
                                    type: "text",
                                    value: apiKey
                                }, void 0, false, {
                                    fileName: "[project]/components/command-center/CommandCenterHeader.tsx",
                                    lineNumber: 119,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    className: "next-btn-sync",
                                    onClick: onSync,
                                    type: "button",
                                    children: "Sync ClickUp"
                                }, void 0, false, {
                                    fileName: "[project]/components/command-center/CommandCenterHeader.tsx",
                                    lineNumber: 126,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    className: "next-btn-ghost",
                                    onClick: onReset,
                                    type: "button",
                                    children: "↻ Reset"
                                }, void 0, false, {
                                    fileName: "[project]/components/command-center/CommandCenterHeader.tsx",
                                    lineNumber: 129,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "next-live-sync-bar",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "next-live-dot"
                                        }, void 0, false, {
                                            fileName: "[project]/components/command-center/CommandCenterHeader.tsx",
                                            lineNumber: 133,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "next-live-sync-lbl",
                                            children: statusText || "Not synced"
                                        }, void 0, false, {
                                            fileName: "[project]/components/command-center/CommandCenterHeader.tsx",
                                            lineNumber: 134,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                            className: "next-btn-sync-now",
                                            onClick: onSyncNow,
                                            title: "Sync now",
                                            type: "button",
                                            children: "↻"
                                        }, void 0, false, {
                                            fileName: "[project]/components/command-center/CommandCenterHeader.tsx",
                                            lineNumber: 135,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                            className: "next-btn-sync-now next-force-reload",
                                            onClick: onForceReload,
                                            title: "Force everyone's tab to reload",
                                            type: "button",
                                            style: {
                                                display: forceReloadVisible ? "inline-flex" : "none"
                                            },
                                            children: "🔄"
                                        }, void 0, false, {
                                            fileName: "[project]/components/command-center/CommandCenterHeader.tsx",
                                            lineNumber: 138,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/components/command-center/CommandCenterHeader.tsx",
                                    lineNumber: 132,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    className: "next-presence-bar",
                                    onClick: onPresenceClick,
                                    type: "button",
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        children: "● 1 online"
                                    }, void 0, false, {
                                        fileName: "[project]/components/command-center/CommandCenterHeader.tsx",
                                        lineNumber: 149,
                                        columnNumber: 15
                                    }, this)
                                }, void 0, false, {
                                    fileName: "[project]/components/command-center/CommandCenterHeader.tsx",
                                    lineNumber: 148,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/components/command-center/CommandCenterHeader.tsx",
                            lineNumber: 118,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/components/command-center/CommandCenterHeader.tsx",
                    lineNumber: 73,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/components/command-center/CommandCenterHeader.tsx",
                lineNumber: 72,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("nav", {
                className: "next-tabs-wrap",
                "aria-label": "Dashboard sections",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "next-tabs",
                    role: "tablist",
                    children: [
                        dashboardTabs.map((tab)=>{
                            const isActive = activeTab === tab.id;
                            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                "aria-selected": isActive,
                                className: isActive ? "next-tab on" : "next-tab",
                                onClick: ()=>onTabSelect(tab.id),
                                role: "tab",
                                type: "button",
                                children: [
                                    tab.label,
                                    tab.countId ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "next-tab-count",
                                        children: counts[tab.countId] || "0"
                                    }, void 0, false, {
                                        fileName: "[project]/components/command-center/CommandCenterHeader.tsx",
                                        lineNumber: 168,
                                        columnNumber: 32
                                    }, this) : null
                                ]
                            }, tab.id, true, {
                                fileName: "[project]/components/command-center/CommandCenterHeader.tsx",
                                lineNumber: 159,
                                columnNumber: 15
                            }, this);
                        }),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                            "aria-selected": activeTab === "admin",
                            className: activeTab === "admin" ? "next-tab next-admin-tab on" : "next-tab next-admin-tab",
                            onClick: ()=>onTabSelect("admin"),
                            role: "tab",
                            type: "button",
                            children: "Admin"
                        }, void 0, false, {
                            fileName: "[project]/components/command-center/CommandCenterHeader.tsx",
                            lineNumber: 172,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/components/command-center/CommandCenterHeader.tsx",
                    lineNumber: 155,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/components/command-center/CommandCenterHeader.tsx",
                lineNumber: 154,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true);
}
}),
"[project]/lib/command-center/state.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "chooseFallbackProductId",
    ()=>chooseFallbackProductId,
    "createEmptyCommandCenterState",
    ()=>createEmptyCommandCenterState,
    "defaultTrackerFilters",
    ()=>defaultTrackerFilters,
    "getActiveProduct",
    ()=>getActiveProduct,
    "mergeTrackerFilters",
    ()=>mergeTrackerFilters,
    "normalizeProduct",
    ()=>normalizeProduct
]);
const defaultTrackerFilters = {
    angle: "",
    persona: "",
    format: "",
    adType: "",
    funnelStage: "",
    status: "",
    structure: "",
    hookType: "",
    productionStyle: "",
    taskType: "",
    dateRange: ""
};
function createEmptyCommandCenterState() {
    return {
        products: [],
        activeProductId: null,
        angles: [],
        personas: [],
        creatives: [],
        production: [],
        actions: [],
        winners: [],
        anglePersonas: {},
        matrixCellMeta: {},
        cellCreativeAssignments: {},
        fieldOptions: {
            creativeStructure: [],
            hookType: [],
            productionStyle: []
        },
        trackerFilters: {
            ...defaultTrackerFilters
        }
    };
}
function normalizeProduct(raw) {
    return {
        ...raw,
        id: raw.id || "",
        name: raw.name || "Untitled Product",
        color: raw.color || "#4F46E5",
        clickupListId: raw.clickupListId ?? raw.clickup_list_id ?? null
    };
}
function getActiveProduct(products, activeProductId) {
    if (!activeProductId) return null;
    return products.find((product)=>product.id === activeProductId) || null;
}
function chooseFallbackProductId(products, preferredProductId) {
    if (preferredProductId && products.some((product)=>product.id === preferredProductId)) {
        return preferredProductId;
    }
    return products[0]?.id || null;
}
function mergeTrackerFilters(saved) {
    return {
        ...defaultTrackerFilters,
        ...saved || {}
    };
}
}),
"[project]/lib/command-center/legacy-snapshot.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "readLegacyCommandCenterState",
    ()=>readLegacyCommandCenterState,
    "readLegacyProductSnapshot",
    ()=>readLegacyProductSnapshot
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$command$2d$center$2f$state$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/command-center/state.ts [app-ssr] (ecmascript)");
;
function readLegacyPayload(legacyWindow) {
    if (!legacyWindow?.eval) return null;
    try {
        return legacyWindow.eval(`({
      PRODUCTS: Array.isArray(PRODUCTS) ? PRODUCTS : [],
      activeProductId: typeof activeProductId !== 'undefined' ? activeProductId : null,
      ANGLES: Array.isArray(ANGLES) ? ANGLES : [],
      PERSONAS: Array.isArray(PERSONAS) ? PERSONAS : [],
      ADS: Array.isArray(ADS) ? ADS : [],
      PROD: Array.isArray(PROD) ? PROD : [],
      ACTIONS: Array.isArray(ACTIONS) ? ACTIONS : [],
      WINNERS: Array.isArray(WINNERS) ? WINNERS : [],
      ANGLE_PERSONAS: ANGLE_PERSONAS && typeof ANGLE_PERSONAS === 'object' ? ANGLE_PERSONAS : {},
      MATRIX_CELL_META: MATRIX_CELL_META && typeof MATRIX_CELL_META === 'object' ? MATRIX_CELL_META : {},
      CELL_CREATIVE_ASSIGNMENTS: CELL_CREATIVE_ASSIGNMENTS && typeof CELL_CREATIVE_ASSIGNMENTS === 'object' ? CELL_CREATIVE_ASSIGNMENTS : {},
      FIELD_OPTIONS: FIELD_OPTIONS && typeof FIELD_OPTIONS === 'object' ? FIELD_OPTIONS : {}
    })`);
    } catch  {
        return null;
    }
}
function readLegacyProductSnapshot(legacyWindow) {
    const payload = readLegacyPayload(legacyWindow);
    return {
        activeProductId: payload?.activeProductId || null,
        products: (payload?.PRODUCTS || []).map(__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$command$2d$center$2f$state$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["normalizeProduct"])
    };
}
function readLegacyCommandCenterState(legacyWindow) {
    const payload = readLegacyPayload(legacyWindow);
    const empty = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$command$2d$center$2f$state$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["createEmptyCommandCenterState"])();
    if (!payload) return empty;
    return {
        ...empty,
        products: (payload.PRODUCTS || []).map(__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$command$2d$center$2f$state$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["normalizeProduct"]),
        activeProductId: payload.activeProductId || null,
        angles: payload.ANGLES || [],
        personas: payload.PERSONAS || [],
        creatives: payload.ADS || [],
        production: payload.PROD || [],
        actions: payload.ACTIONS || [],
        winners: payload.WINNERS || [],
        anglePersonas: payload.ANGLE_PERSONAS || {},
        matrixCellMeta: payload.MATRIX_CELL_META || {},
        cellCreativeAssignments: payload.CELL_CREATIVE_ASSIGNMENTS || {},
        fieldOptions: {
            creativeStructure: payload.FIELD_OPTIONS?.creativeStructure || [],
            hookType: payload.FIELD_OPTIONS?.hookType || [],
            productionStyle: payload.FIELD_OPTIONS?.productionStyle || []
        }
    };
}
}),
"[project]/lib/command-center/storage.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "readJsonStorage",
    ()=>readJsonStorage,
    "readTrackerFilters",
    ()=>readTrackerFilters,
    "storageKeys",
    ()=>storageKeys,
    "writeJsonStorage",
    ()=>writeJsonStorage,
    "writeTrackerFilters",
    ()=>writeTrackerFilters
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$command$2d$center$2f$state$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/command-center/state.ts [app-ssr] (ecmascript)");
;
const storageKeys = {
    apiKey: "immuvi_api_key",
    activeProduct: "immuvi_active_product",
    activeTab: "immuvi_active_tab",
    fieldMaps: "immuvi_field_maps_v1",
    fieldOptions: "immuvi_field_options_v1",
    linkedDoneCache: "mxv4.linkedDoneCache.v1",
    trackerFilters (productId) {
        return `immuvi_tracker_filters_${productId || "default"}`;
    },
    taxonomyTombstone (kind, productId) {
        return `_deletedTaxonomy_${kind}_${productId || "x"}`;
    },
    deletedClickUpIds (productId) {
        return `_deletedCuIds_${productId || "x"}`;
    },
    inspirations (productId) {
        return `immuvi_inspirations_${productId}`;
    }
};
function readJsonStorage(storage, key, fallback) {
    try {
        const raw = storage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch  {
        return fallback;
    }
}
function writeJsonStorage(storage, key, value) {
    try {
        storage.setItem(key, JSON.stringify(value));
    } catch  {
    // localStorage can be unavailable or full; callers should keep in-memory state.
    }
}
function readTrackerFilters(storage, productId) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$command$2d$center$2f$state$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["mergeTrackerFilters"])(readJsonStorage(storage, storageKeys.trackerFilters(productId), __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$command$2d$center$2f$state$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["defaultTrackerFilters"]));
}
function writeTrackerFilters(storage, productId, filters) {
    writeJsonStorage(storage, storageKeys.trackerFilters(productId), filters);
}
}),
"[project]/lib/command-center/index.ts [app-ssr] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$command$2d$center$2f$legacy$2d$snapshot$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/command-center/legacy-snapshot.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$command$2d$center$2f$storage$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/command-center/storage.ts [app-ssr] (ecmascript)");
;
;
;
;
;
}),
"[project]/hooks/command-center/useLegacyDashboardBridge.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useLegacyDashboardBridge",
    ()=>useLegacyDashboardBridge
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$command$2d$center$2f$CommandCenterHeader$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/command-center/CommandCenterHeader.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$command$2d$center$2f$index$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/lib/command-center/index.ts [app-ssr] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$command$2d$center$2f$state$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/command-center/state.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$command$2d$center$2f$legacy$2d$snapshot$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/command-center/legacy-snapshot.ts [app-ssr] (ecmascript)");
"use client";
;
;
;
const countIds = __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$command$2d$center$2f$CommandCenterHeader$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["dashboardTabs"].map((tab)=>tab.countId).filter((countId)=>Boolean(countId));
function useLegacyDashboardBridge(enabled) {
    const iframeRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(null);
    const [activeProductId, setActiveProductId] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const [activeTab, setActiveTab] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])("hq");
    const [apiKey, setApiKey] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])("");
    const [commandCenterState, setCommandCenterState] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(()=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$command$2d$center$2f$state$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["createEmptyCommandCenterState"])());
    const [counts, setCounts] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])({});
    const [forceReloadVisible, setForceReloadVisible] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const [productColor, setProductColor] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])("#94A3B8");
    const [productMenuOpen, setProductMenuOpen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const [productName, setProductName] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])("No Product");
    const [products, setProducts] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])([]);
    const [statusText, setStatusText] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])("Not synced");
    const getLegacyWindow = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])(()=>iframeRef.current?.contentWindow, []);
    const getLegacyDocument = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])(()=>iframeRef.current?.contentDocument || null, []);
    const callLegacy = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])((fnName)=>{
        const legacyWindow = getLegacyWindow();
        const fn = legacyWindow?.[fnName];
        if (typeof fn === "function") fn.call(legacyWindow);
    }, [
        getLegacyWindow
    ]);
    const syncFromLegacyDom = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])(()=>{
        if (!enabled) return;
        const doc = getLegacyDocument();
        if (!doc) return;
        const nextCounts = {};
        countIds.forEach((countId)=>{
            nextCounts[countId] = doc.getElementById(countId)?.textContent?.trim() || "0";
        });
        setCounts(nextCounts);
        setApiKey(doc.getElementById("apiKeyInput")?.value || "");
        setForceReloadVisible(doc.getElementById("forceReloadAllBtn")?.style.display !== "none");
        setProductColor(doc.getElementById("hdrProdDot")?.style.background || "#94A3B8");
        setProductName(doc.getElementById("hdrProdName")?.textContent?.trim() || "No Product");
        setStatusText(doc.getElementById("statusLbl")?.textContent?.trim() || "Not synced");
        const productState = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$command$2d$center$2f$legacy$2d$snapshot$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["readLegacyProductSnapshot"])(getLegacyWindow());
        setActiveProductId(productState.activeProductId);
        setProducts(productState.products);
        setCommandCenterState((0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$command$2d$center$2f$legacy$2d$snapshot$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["readLegacyCommandCenterState"])(getLegacyWindow()));
        const activeButton = doc.querySelector(".tabs .tab.on");
        const onclick = activeButton?.getAttribute("onclick") || "";
        const match = onclick.match(/showTab\('([^']+)'/);
        if (match?.[1]) setActiveTab(match[1]);
    }, [
        enabled,
        getLegacyDocument,
        getLegacyWindow
    ]);
    const hideLegacyShell = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])(()=>{
        if (!enabled) return;
        const doc = getLegacyDocument();
        if (!doc || doc.getElementById("next-shell-bridge-style")) return;
        const style = doc.createElement("style");
        style.id = "next-shell-bridge-style";
        style.textContent = `
      .hdr,
      .tabs-wrap {
        display: none !important;
      }
      body {
        padding-top: 0 !important;
      }
    `;
        doc.head.appendChild(style);
    }, [
        enabled,
        getLegacyDocument
    ]);
    const handleFrameLoad = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])(()=>{
        hideLegacyShell();
        syncFromLegacyDom();
    }, [
        hideLegacyShell,
        syncFromLegacyDom
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        if (!enabled) return undefined;
        const interval = window.setInterval(syncFromLegacyDom, 1000);
        return ()=>window.clearInterval(interval);
    }, [
        enabled,
        syncFromLegacyDom
    ]);
    const handleTabSelect = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])((tabId)=>{
        setActiveTab(tabId);
        const legacyWindow = getLegacyWindow();
        const doc = getLegacyDocument();
        const button = doc?.querySelector(`.tabs .tab[onclick*="'${tabId}'"]`) || null;
        if (typeof legacyWindow?.showTab === "function") {
            legacyWindow.showTab(tabId, button);
        }
        window.setTimeout(syncFromLegacyDom, 50);
    }, [
        getLegacyDocument,
        getLegacyWindow,
        syncFromLegacyDom
    ]);
    const handleApiKeyChange = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])((value)=>{
        setApiKey(value);
        const legacyInput = getLegacyDocument()?.getElementById("apiKeyInput");
        if (legacyInput) {
            legacyInput.value = value;
            legacyInput.dispatchEvent(new Event("input", {
                bubbles: true
            }));
            legacyInput.dispatchEvent(new Event("change", {
                bubbles: true
            }));
        }
    }, [
        getLegacyDocument
    ]);
    const callLegacyWithSyntheticClick = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])((fnName)=>{
        const legacyWindow = getLegacyWindow();
        const fn = legacyWindow?.[fnName];
        if (typeof fn === "function") {
            fn.call(legacyWindow, {
                stopPropagation () {}
            });
        }
    }, [
        getLegacyWindow
    ]);
    const handleProductSelect = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])((productId)=>{
        setProductMenuOpen(false);
        const legacyWindow = getLegacyWindow();
        if (typeof legacyWindow?.hdrSwitchProduct === "function") {
            legacyWindow.hdrSwitchProduct(productId);
        }
        window.setTimeout(syncFromLegacyDom, 100);
    }, [
        getLegacyWindow,
        syncFromLegacyDom
    ]);
    const handleAddProduct = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])(()=>{
        setProductMenuOpen(false);
        callLegacy("openAddProductModal");
    }, [
        callLegacy
    ]);
    return {
        iframeRef,
        state: {
            activeProductId,
            activeTab,
            apiKey,
            commandCenterState,
            counts,
            forceReloadVisible,
            productColor,
            productMenuOpen,
            productName,
            products,
            statusText
        },
        actions: {
            callLegacy,
            callLegacyWithSyntheticClick,
            handleAddProduct,
            handleApiKeyChange,
            handleFrameLoad,
            handleProductSelect,
            handleTabSelect,
            setProductMenuOpen,
            syncFromLegacyDom
        }
    };
}
}),
"[project]/lib/command-center/metrics.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "classifyStatus",
    ()=>classifyStatus,
    "getAnglesSummary",
    ()=>getAnglesSummary,
    "getCommandHqCoverageCards",
    ()=>getCommandHqCoverageCards,
    "getCommandHqGaps",
    ()=>getCommandHqGaps,
    "getCommandHqMetrics",
    ()=>getCommandHqMetrics
]);
const funnelStages = [
    "TOF",
    "MOF",
    "BOF"
];
const statusPriority = [
    "Winner",
    "Scale",
    "Mild Winner",
    "Testing",
    "Ready to Launch",
    "In Production",
    "Approved",
    "Complete",
    "Loser",
    "Untested"
];
function normalizeStatus(status) {
    return String(status || "").trim().toLowerCase();
}
function plural(count, singular, pluralLabel = `${singular}s`) {
    return count === 1 ? singular : pluralLabel;
}
function classifyStatus(status) {
    const normalized = String(status || "").toLowerCase().replace(/ /g, "-");
    const map = {
        untested: {
            tone: "notstart",
            label: "Untested"
        },
        approved: {
            tone: "inprog",
            label: "Approved"
        },
        "in-production": {
            tone: "ready",
            label: "In Production"
        },
        "ready-to-launch": {
            tone: "test",
            label: "Ready to Launch"
        },
        testing: {
            tone: "test",
            label: "Testing"
        },
        "mild-winner": {
            tone: "win",
            label: "Mild Winner"
        },
        winner: {
            tone: "win",
            label: "Winner"
        },
        loser: {
            tone: "lose",
            label: "Loser"
        },
        scale: {
            tone: "win",
            label: "Scale"
        },
        complete: {
            tone: "win",
            label: "Complete"
        }
    };
    return map[normalized] || {
        tone: "notstart",
        label: status || "Untested"
    };
}
function getPrimaryCreativesForAngle(creatives, angleName) {
    return creatives.filter((creative)=>creative.angle === angleName && !creative.parentAdId);
}
function deriveAngleStatus(angleName, creatives) {
    const statuses = getPrimaryCreativesForAngle(creatives, angleName).map((creative)=>creative.status || "Untested");
    if (statuses.length === 0) return "Untested";
    return statusPriority.find((status)=>statuses.includes(status)) || "Untested";
}
function buildSourceLabel(sourceLink) {
    if (!sourceLink) return "";
    const withoutProtocol = sourceLink.replace(/^https?:\/\/(www\.)?/, "");
    return withoutProtocol.length > 30 ? `${withoutProtocol.slice(0, 30)}...` : withoutProtocol;
}
function getCommandHqMetrics(state) {
    const creatives = state.creatives || [];
    const winners = creatives.filter((creative)=>{
        const status = normalizeStatus(creative.status);
        return status === "winner" || status === "mild winner" || status === "scale";
    }).length;
    return {
        total: creatives.length,
        winners,
        testing: creatives.filter((creative)=>normalizeStatus(creative.status) === "testing").length,
        ready: creatives.filter((creative)=>normalizeStatus(creative.status) === "ready to launch").length,
        notStarted: creatives.filter((creative)=>normalizeStatus(creative.status) === "untested").length,
        winRate: creatives.length > 0 ? winners / creatives.length * 100 : 0,
        angles: state.angles.length,
        personas: state.personas.length
    };
}
function getFieldOptionNames(state, key) {
    return (state.fieldOptions[key] || []).map((option)=>option.name).filter((name)=>Boolean(name));
}
function countByValue(creatives, key) {
    return creatives.reduce((counts, creative)=>{
        const value = String(creative[key] || "Unknown");
        counts[value] = (counts[value] || 0) + 1;
        return counts;
    }, {});
}
function buildCoverageCard(title, names, counts) {
    const items = names.map((name)=>({
            name,
            count: counts[name] || 0
        }));
    const covered = items.filter((item)=>item.count > 0).length;
    return {
        title,
        covered,
        total: names.length,
        percent: names.length > 0 ? Math.round(covered / names.length * 100) : 0,
        items
    };
}
function getCommandHqCoverageCards(state) {
    const creatives = state.creatives || [];
    return [
        buildCoverageCard("Angles", state.angles.map((angle)=>angle.name), countByValue(creatives, "angle")),
        buildCoverageCard("Personas", state.personas.map((persona)=>persona.name), countByValue(creatives, "persona")),
        buildCoverageCard("Creative Structure", getFieldOptionNames(state, "creativeStructure"), countByValue(creatives, "creativeStructure")),
        buildCoverageCard("Hook Type", getFieldOptionNames(state, "hookType"), countByValue(creatives, "hookType")),
        buildCoverageCard("Production Style", getFieldOptionNames(state, "productionStyle"), countByValue(creatives, "productionStyle"))
    ];
}
function getCommandHqGaps(state) {
    const creatives = state.creatives || [];
    const gaps = [];
    const angleNotStarted = state.angles.filter((angle)=>normalizeStatus(angle.status) === "untested").length;
    if (angleNotStarted > 0) {
        gaps.push(`${angleNotStarted} ${plural(angleNotStarted, "angle")} not started.`);
    }
    const personaCounts = countByValue(creatives, "persona");
    const personasUntested = state.personas.filter((persona)=>!personaCounts[persona.name]).length;
    if (personasUntested > 0) {
        gaps.push(`${personasUntested} ${plural(personasUntested, "persona")} untested.`);
    }
    const winnerParents = creatives.filter((creative)=>normalizeStatus(creative.status) === "winner" && !creative.parentAdId);
    const winnerCombos = Array.from(new Set(winnerParents.map((creative)=>`${creative.angle || "Unknown"}||${creative.persona || "Unknown"}`)));
    const missingFunnel = winnerCombos.reduce((total, combo)=>{
        const [angle, persona] = combo.split("||");
        const stages = new Set(creatives.filter((creative)=>(creative.angle || "Unknown") === angle && (creative.persona || "Unknown") === persona).map((creative)=>creative.funnelStage).filter(Boolean));
        return total + funnelStages.filter((stage)=>!stages.has(stage)).length;
    }, 0);
    if (missingFunnel > 0) {
        gaps.push(`${winnerCombos.length} winner ${plural(winnerCombos.length, "combo", "combos")} missing ${missingFunnel} funnel ${plural(missingFunnel, "stage")}.`);
    }
    winnerParents.forEach((winner)=>{
        const variationCount = creatives.filter((creative)=>creative.parentAdId === winner.id).length;
        const needed = 5 - variationCount;
        if (needed > 0) {
            gaps.push(`${winner.id} needs ${needed} more ${plural(needed, "variation")}.`);
        }
    });
    const structureCounts = countByValue(creatives, "creativeStructure");
    const untestedStructures = getFieldOptionNames(state, "creativeStructure").filter((name)=>!structureCounts[name]).length;
    if (untestedStructures > 0) {
        gaps.push(`${untestedStructures} creative ${plural(untestedStructures, "structure")} untested.`);
    }
    const hookCounts = countByValue(creatives, "hookType");
    const untestedHooks = getFieldOptionNames(state, "hookType").filter((name)=>!hookCounts[name]).length;
    if (untestedHooks > 0) {
        gaps.push(`${untestedHooks} hook ${plural(untestedHooks, "type")} untested.`);
    }
    return gaps;
}
function getAnglesSummary(state) {
    const creatives = state.creatives || [];
    let winners = 0;
    let testing = 0;
    let untested = 0;
    let totalCreatives = 0;
    const angles = state.angles.map((angle, index)=>{
        const primaryCreatives = getPrimaryCreativesForAngle(creatives, angle.name);
        const status = deriveAngleStatus(angle.name, creatives);
        const statusClass = classifyStatus(status);
        const winnerCount = primaryCreatives.filter((creative)=>{
            const creativeStatus = normalizeStatus(creative.status);
            return creativeStatus === "winner" || creativeStatus === "mild winner";
        }).length;
        const personaCount = new Set(primaryCreatives.map((creative)=>creative.persona).filter(Boolean)).size;
        const winRate = primaryCreatives.length > 0 ? Math.round(winnerCount / primaryCreatives.length * 100) : 0;
        if (status === "Winner" || status === "Mild Winner" || status === "Scale") winners += 1;
        else if (status === "Testing") testing += 1;
        else if (status === "Untested") untested += 1;
        totalCreatives += primaryCreatives.length;
        return {
            id: angle.id || angle.name,
            index,
            name: angle.name,
            notes: angle.notes || "",
            sourceLink: angle.sourceLink || "",
            sourceLabel: buildSourceLabel(angle.sourceLink || ""),
            status,
            tone: statusClass.tone,
            personas: personaCount,
            creatives: primaryCreatives.length,
            winners: winnerCount,
            winRate
        };
    });
    return {
        totalAngles: state.angles.length,
        winners,
        testing,
        untested,
        totalCreatives,
        angles
    };
}
}),
"[project]/components/command-center/AnglesReadOnlyPanel.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AnglesReadOnlyPanel",
    ()=>AnglesReadOnlyPanel
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$command$2d$center$2f$index$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/lib/command-center/index.ts [app-ssr] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$command$2d$center$2f$metrics$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/command-center/metrics.ts [app-ssr] (ecmascript)");
"use client";
;
;
function formatNumber(value) {
    return new Intl.NumberFormat("en-US").format(value);
}
function toneClass(tone) {
    return `next-status-badge ${tone}`;
}
function AnglesReadOnlyPanel({ state }) {
    const summary = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$command$2d$center$2f$metrics$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["getAnglesSummary"])(state);
    const summaryItems = [
        [
            "Total Angles",
            summary.totalAngles
        ],
        [
            "Winners",
            summary.winners
        ],
        [
            "Testing",
            summary.testing
        ],
        [
            "Untested",
            summary.untested
        ],
        [
            "Total Creatives",
            summary.totalCreatives
        ]
    ];
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
        className: "next-angles-panel",
        "aria-label": "Angles read-only summary",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "next-panel-head",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                        children: "Angle Tracker"
                    }, void 0, false, {
                        fileName: "[project]/components/command-center/AnglesReadOnlyPanel.tsx",
                        lineNumber: 31,
                        columnNumber: 11
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/components/command-center/AnglesReadOnlyPanel.tsx",
                    lineNumber: 30,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/components/command-center/AnglesReadOnlyPanel.tsx",
                lineNumber: 29,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "next-tracker-summary",
                children: summaryItems.map(([label, value])=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "next-tracker-summary-stat",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                children: label
                            }, void 0, false, {
                                fileName: "[project]/components/command-center/AnglesReadOnlyPanel.tsx",
                                lineNumber: 37,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("strong", {
                                children: formatNumber(Number(value))
                            }, void 0, false, {
                                fileName: "[project]/components/command-center/AnglesReadOnlyPanel.tsx",
                                lineNumber: 38,
                                columnNumber: 13
                            }, this)
                        ]
                    }, label, true, {
                        fileName: "[project]/components/command-center/AnglesReadOnlyPanel.tsx",
                        lineNumber: 36,
                        columnNumber: 11
                    }, this))
            }, void 0, false, {
                fileName: "[project]/components/command-center/AnglesReadOnlyPanel.tsx",
                lineNumber: 34,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "next-angle-grid",
                role: "table",
                "aria-label": "Angles",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "next-angle-header",
                        role: "row",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                children: "#"
                            }, void 0, false, {
                                fileName: "[project]/components/command-center/AnglesReadOnlyPanel.tsx",
                                lineNumber: 44,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                children: "Angle Name"
                            }, void 0, false, {
                                fileName: "[project]/components/command-center/AnglesReadOnlyPanel.tsx",
                                lineNumber: 45,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                children: "Status"
                            }, void 0, false, {
                                fileName: "[project]/components/command-center/AnglesReadOnlyPanel.tsx",
                                lineNumber: 46,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                children: "Source Link"
                            }, void 0, false, {
                                fileName: "[project]/components/command-center/AnglesReadOnlyPanel.tsx",
                                lineNumber: 47,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                children: "Stats"
                            }, void 0, false, {
                                fileName: "[project]/components/command-center/AnglesReadOnlyPanel.tsx",
                                lineNumber: 48,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                children: "Notes"
                            }, void 0, false, {
                                fileName: "[project]/components/command-center/AnglesReadOnlyPanel.tsx",
                                lineNumber: 49,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/components/command-center/AnglesReadOnlyPanel.tsx",
                        lineNumber: 43,
                        columnNumber: 9
                    }, this),
                    summary.angles.length === 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "next-empty-state",
                        children: "No angles yet"
                    }, void 0, false, {
                        fileName: "[project]/components/command-center/AnglesReadOnlyPanel.tsx",
                        lineNumber: 52,
                        columnNumber: 11
                    }, this) : summary.angles.map((angle)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: `next-angle-row status-${angle.tone}`,
                            role: "row",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "next-angle-num",
                                    children: angle.index + 1
                                }, void 0, false, {
                                    fileName: "[project]/components/command-center/AnglesReadOnlyPanel.tsx",
                                    lineNumber: 56,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "next-angle-name",
                                    children: [
                                        angle.name,
                                        angle.tone === "win" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "next-win-badge",
                                            children: "Winner"
                                        }, void 0, false, {
                                            fileName: "[project]/components/command-center/AnglesReadOnlyPanel.tsx",
                                            lineNumber: 59,
                                            columnNumber: 41
                                        }, this) : null
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/components/command-center/AnglesReadOnlyPanel.tsx",
                                    lineNumber: 57,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: toneClass(angle.tone),
                                        children: angle.status
                                    }, void 0, false, {
                                        fileName: "[project]/components/command-center/AnglesReadOnlyPanel.tsx",
                                        lineNumber: 62,
                                        columnNumber: 17
                                    }, this)
                                }, void 0, false, {
                                    fileName: "[project]/components/command-center/AnglesReadOnlyPanel.tsx",
                                    lineNumber: 61,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "next-angle-source",
                                    children: angle.sourceLink ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                                        href: angle.sourceLink,
                                        target: "_blank",
                                        rel: "noopener noreferrer",
                                        children: angle.sourceLabel
                                    }, void 0, false, {
                                        fileName: "[project]/components/command-center/AnglesReadOnlyPanel.tsx",
                                        lineNumber: 66,
                                        columnNumber: 19
                                    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        children: "No source"
                                    }, void 0, false, {
                                        fileName: "[project]/components/command-center/AnglesReadOnlyPanel.tsx",
                                        lineNumber: 70,
                                        columnNumber: 19
                                    }, this)
                                }, void 0, false, {
                                    fileName: "[project]/components/command-center/AnglesReadOnlyPanel.tsx",
                                    lineNumber: 64,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "next-angle-stats",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            children: [
                                                formatNumber(angle.personas),
                                                " personas"
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/components/command-center/AnglesReadOnlyPanel.tsx",
                                            lineNumber: 74,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            children: [
                                                formatNumber(angle.creatives),
                                                " creatives"
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/components/command-center/AnglesReadOnlyPanel.tsx",
                                            lineNumber: 75,
                                            columnNumber: 17
                                        }, this),
                                        angle.creatives > 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            children: [
                                                angle.winRate,
                                                "% win"
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/components/command-center/AnglesReadOnlyPanel.tsx",
                                            lineNumber: 76,
                                            columnNumber: 40
                                        }, this) : null
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/components/command-center/AnglesReadOnlyPanel.tsx",
                                    lineNumber: 73,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "next-angle-notes",
                                    children: angle.notes || "No notes"
                                }, void 0, false, {
                                    fileName: "[project]/components/command-center/AnglesReadOnlyPanel.tsx",
                                    lineNumber: 78,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, angle.id, true, {
                            fileName: "[project]/components/command-center/AnglesReadOnlyPanel.tsx",
                            lineNumber: 55,
                            columnNumber: 13
                        }, this))
                ]
            }, void 0, true, {
                fileName: "[project]/components/command-center/AnglesReadOnlyPanel.tsx",
                lineNumber: 42,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/components/command-center/AnglesReadOnlyPanel.tsx",
        lineNumber: 28,
        columnNumber: 5
    }, this);
}
}),
"[project]/components/command-center/CommandHqSummary.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "CommandHqSummary",
    ()=>CommandHqSummary
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$command$2d$center$2f$index$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/lib/command-center/index.ts [app-ssr] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$command$2d$center$2f$metrics$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/command-center/metrics.ts [app-ssr] (ecmascript)");
"use client";
;
;
function formatNumber(value) {
    return new Intl.NumberFormat("en-US").format(value);
}
function formatRate(value) {
    return `${value.toFixed(1)}%`;
}
function CommandHqSummary({ state }) {
    const metrics = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$command$2d$center$2f$metrics$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["getCommandHqMetrics"])(state);
    const coverageCards = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$command$2d$center$2f$metrics$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["getCommandHqCoverageCards"])(state);
    const gaps = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$command$2d$center$2f$metrics$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["getCommandHqGaps"])(state);
    const items = [
        {
            label: "Total Creatives",
            value: formatNumber(metrics.total)
        },
        {
            label: "Winners",
            value: formatNumber(metrics.winners),
            tone: "win"
        },
        {
            label: "Testing",
            value: formatNumber(metrics.testing),
            tone: "test"
        },
        {
            label: "Ready to Launch",
            value: formatNumber(metrics.ready),
            tone: "ready"
        },
        {
            label: "Untested",
            value: formatNumber(metrics.notStarted),
            tone: "untested"
        },
        {
            label: "Win Rate",
            value: formatRate(metrics.winRate),
            tone: "rate"
        },
        {
            label: "Angles",
            value: formatNumber(metrics.angles)
        },
        {
            label: "Personas",
            value: formatNumber(metrics.personas)
        }
    ];
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
        className: "next-hq-summary",
        "aria-label": "Command HQ summary",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "next-kpi-strip",
                children: items.map((item)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "next-kpi-item",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: item.tone ? `next-kpi-val ${item.tone}` : "next-kpi-val",
                                children: item.value
                            }, void 0, false, {
                                fileName: "[project]/components/command-center/CommandHqSummary.tsx",
                                lineNumber: 42,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "next-kpi-lbl",
                                children: item.label
                            }, void 0, false, {
                                fileName: "[project]/components/command-center/CommandHqSummary.tsx",
                                lineNumber: 43,
                                columnNumber: 13
                            }, this)
                        ]
                    }, item.label, true, {
                        fileName: "[project]/components/command-center/CommandHqSummary.tsx",
                        lineNumber: 41,
                        columnNumber: 11
                    }, this))
            }, void 0, false, {
                fileName: "[project]/components/command-center/CommandHqSummary.tsx",
                lineNumber: 39,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "next-coverage-grid",
                "aria-label": "Coverage intelligence",
                children: coverageCards.map((card)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("article", {
                        className: "next-cov-card",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "next-cov-card-title",
                                children: card.title
                            }, void 0, false, {
                                fileName: "[project]/components/command-center/CommandHqSummary.tsx",
                                lineNumber: 50,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "next-cov-bar-wrap",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "next-cov-bar",
                                    style: {
                                        width: `${card.percent}%`
                                    }
                                }, void 0, false, {
                                    fileName: "[project]/components/command-center/CommandHqSummary.tsx",
                                    lineNumber: 52,
                                    columnNumber: 15
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/components/command-center/CommandHqSummary.tsx",
                                lineNumber: 51,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "next-cov-pct",
                                children: [
                                    card.percent,
                                    "% coverage (",
                                    card.covered,
                                    "/",
                                    card.total,
                                    ")"
                                ]
                            }, void 0, true, {
                                fileName: "[project]/components/command-center/CommandHqSummary.tsx",
                                lineNumber: 54,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "next-cov-list",
                                children: card.items.map((item)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "next-cov-item",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: item.count > 0 ? "next-cov-dot active" : "next-cov-dot"
                                            }, void 0, false, {
                                                fileName: "[project]/components/command-center/CommandHqSummary.tsx",
                                                lineNumber: 60,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "next-cov-name",
                                                children: item.name
                                            }, void 0, false, {
                                                fileName: "[project]/components/command-center/CommandHqSummary.tsx",
                                                lineNumber: 61,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "next-cov-count",
                                                children: formatNumber(item.count)
                                            }, void 0, false, {
                                                fileName: "[project]/components/command-center/CommandHqSummary.tsx",
                                                lineNumber: 62,
                                                columnNumber: 19
                                            }, this)
                                        ]
                                    }, item.name, true, {
                                        fileName: "[project]/components/command-center/CommandHqSummary.tsx",
                                        lineNumber: 59,
                                        columnNumber: 17
                                    }, this))
                            }, void 0, false, {
                                fileName: "[project]/components/command-center/CommandHqSummary.tsx",
                                lineNumber: 57,
                                columnNumber: 13
                            }, this)
                        ]
                    }, card.title, true, {
                        fileName: "[project]/components/command-center/CommandHqSummary.tsx",
                        lineNumber: 49,
                        columnNumber: 11
                    }, this))
            }, void 0, false, {
                fileName: "[project]/components/command-center/CommandHqSummary.tsx",
                lineNumber: 47,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "next-gap-box",
                "aria-label": "Gap intelligence",
                children: gaps.length === 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "next-gap-ok",
                    children: "All gaps covered. Great work!"
                }, void 0, false, {
                    fileName: "[project]/components/command-center/CommandHqSummary.tsx",
                    lineNumber: 71,
                    columnNumber: 11
                }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                    className: "next-gap-list",
                    children: gaps.map((gap)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                            children: gap
                        }, gap, false, {
                            fileName: "[project]/components/command-center/CommandHqSummary.tsx",
                            lineNumber: 75,
                            columnNumber: 15
                        }, this))
                }, void 0, false, {
                    fileName: "[project]/components/command-center/CommandHqSummary.tsx",
                    lineNumber: 73,
                    columnNumber: 11
                }, this)
            }, void 0, false, {
                fileName: "[project]/components/command-center/CommandHqSummary.tsx",
                lineNumber: 69,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/components/command-center/CommandHqSummary.tsx",
        lineNumber: 38,
        columnNumber: 5
    }, this);
}
}),
"[project]/components/command-center/LegacyDashboardFrame.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "LegacyDashboardFrame",
    ()=>LegacyDashboardFrame
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
;
;
const LegacyDashboardFrame = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["forwardRef"])(function LegacyDashboardFrame({ compact = false, onLoad }, ref) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("iframe", {
        className: "legacy-dashboard-frame",
        "data-compact-shell": compact ? "true" : "false",
        onLoad: onLoad,
        ref: ref,
        src: "/immuvi-command-center.html",
        title: "Immuvi Command Center"
    }, void 0, false, {
        fileName: "[project]/components/command-center/LegacyDashboardFrame.tsx",
        lineNumber: 11,
        columnNumber: 7
    }, this);
});
}),
"[project]/components/command-center/CommandCenterShell.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "CommandCenterShell",
    ()=>CommandCenterShell
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$hooks$2f$command$2d$center$2f$useLegacyDashboardBridge$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/hooks/command-center/useLegacyDashboardBridge.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$command$2d$center$2f$AnglesReadOnlyPanel$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/command-center/AnglesReadOnlyPanel.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$command$2d$center$2f$CommandCenterHeader$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/command-center/CommandCenterHeader.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$command$2d$center$2f$CommandHqSummary$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/command-center/CommandHqSummary.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$command$2d$center$2f$LegacyDashboardFrame$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/command-center/LegacyDashboardFrame.tsx [app-ssr] (ecmascript)");
"use client";
;
;
;
;
;
;
function CommandCenterShell({ useReactHeader = false }) {
    const { actions, iframeRef, state } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$hooks$2f$command$2d$center$2f$useLegacyDashboardBridge$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useLegacyDashboardBridge"])(useReactHeader);
    const showReactCommandHq = useReactHeader && state.activeTab === "hq";
    const showReactAngles = useReactHeader && state.activeTab === "angles";
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("main", {
        className: [
            "dashboard-shell",
            useReactHeader ? "with-react-header" : "",
            showReactCommandHq ? "react-hq-active" : ""
        ].filter(Boolean).join(" "),
        children: [
            useReactHeader ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$command$2d$center$2f$CommandCenterHeader$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["CommandCenterHeader"], {
                activeProductId: state.activeProductId,
                activeTab: state.activeTab,
                apiKey: state.apiKey,
                counts: state.counts,
                forceReloadVisible: state.forceReloadVisible,
                onAddProduct: actions.handleAddProduct,
                onApiKeyChange: actions.handleApiKeyChange,
                onForceReload: ()=>actions.callLegacy("broadcastForceReload"),
                onPresenceClick: ()=>actions.callLegacyWithSyntheticClick("_togglePresencePanel"),
                onProductClick: ()=>{
                    actions.setProductMenuOpen((open)=>!open);
                    actions.syncFromLegacyDom();
                },
                onProductSelect: actions.handleProductSelect,
                onReset: ()=>{
                    const ok = window.confirm("Reset all data to seed defaults? This cannot be undone.");
                    if (ok) actions.callLegacy("resetToSeedData");
                },
                onSync: ()=>actions.callLegacy("syncClickUp"),
                onSyncNow: ()=>actions.callLegacy("triggerManualSync"),
                onTabSelect: actions.handleTabSelect,
                productColor: state.productColor,
                productMenuOpen: state.productMenuOpen,
                productName: state.productName,
                products: state.products,
                statusText: state.statusText
            }, void 0, false, {
                fileName: "[project]/components/command-center/CommandCenterShell.tsx",
                lineNumber: 29,
                columnNumber: 9
            }, this) : null,
            showReactCommandHq ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$command$2d$center$2f$CommandHqSummary$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["CommandHqSummary"], {
                state: state.commandCenterState
            }, void 0, false, {
                fileName: "[project]/components/command-center/CommandCenterShell.tsx",
                lineNumber: 58,
                columnNumber: 29
            }, this) : null,
            showReactAngles ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$command$2d$center$2f$AnglesReadOnlyPanel$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["AnglesReadOnlyPanel"], {
                state: state.commandCenterState
            }, void 0, false, {
                fileName: "[project]/components/command-center/CommandCenterShell.tsx",
                lineNumber: 59,
                columnNumber: 26
            }, this) : null,
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$command$2d$center$2f$LegacyDashboardFrame$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["LegacyDashboardFrame"], {
                compact: useReactHeader,
                onLoad: actions.handleFrameLoad,
                ref: iframeRef
            }, void 0, false, {
                fileName: "[project]/components/command-center/CommandCenterShell.tsx",
                lineNumber: 60,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/components/command-center/CommandCenterShell.tsx",
        lineNumber: 19,
        columnNumber: 5
    }, this);
}
}),
];

//# sourceMappingURL=_0pw8oz~._.js.map