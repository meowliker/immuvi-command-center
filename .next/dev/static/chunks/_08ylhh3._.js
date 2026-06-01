(globalThis["TURBOPACK"] || (globalThis["TURBOPACK"] = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/components/command-center/CommandCenterHeader.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "CommandCenterHeader",
    ()=>CommandCenterHeader,
    "dashboardTabs",
    ()=>dashboardTabs
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
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
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("header", {
                className: "next-hdr",
                "aria-label": "Immuvi Command Center header",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "next-hdr-inner",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "next-hdr-logo",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "next-hdr-logo-name",
                                            children: "Immuvi Command Center"
                                        }, void 0, false, {
                                            fileName: "[project]/components/command-center/CommandCenterHeader.tsx",
                                            lineNumber: 76,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
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
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "next-hdr-prod-wrap",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                            className: "next-hdr-prod-btn",
                                            onClick: onProductClick,
                                            type: "button",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "next-hdr-prod-dot",
                                                    style: {
                                                        background: productColor || "#94A3B8"
                                                    }
                                                }, void 0, false, {
                                                    fileName: "[project]/components/command-center/CommandCenterHeader.tsx",
                                                    lineNumber: 81,
                                                    columnNumber: 15
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    children: productName || "No Product"
                                                }, void 0, false, {
                                                    fileName: "[project]/components/command-center/CommandCenterHeader.tsx",
                                                    lineNumber: 82,
                                                    columnNumber: 15
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
                                                    width: "10",
                                                    height: "6",
                                                    viewBox: "0 0 10 6",
                                                    fill: "none",
                                                    "aria-hidden": "true",
                                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
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
                                        productMenuOpen ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "next-hdr-prod-dd",
                                            children: [
                                                products.map((product)=>{
                                                    const isActive = product.id === activeProductId;
                                                    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                        className: isActive ? "next-hdr-prod-dd-item active" : "next-hdr-prod-dd-item",
                                                        onClick: ()=>onProductSelect(product.id),
                                                        type: "button",
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                className: "next-hdr-prod-dd-dot",
                                                                style: {
                                                                    background: product.color || "#4F46E5"
                                                                }
                                                            }, void 0, false, {
                                                                fileName: "[project]/components/command-center/CommandCenterHeader.tsx",
                                                                lineNumber: 104,
                                                                columnNumber: 25
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                className: "next-hdr-prod-dd-name",
                                                                children: product.name
                                                            }, void 0, false, {
                                                                fileName: "[project]/components/command-center/CommandCenterHeader.tsx",
                                                                lineNumber: 105,
                                                                columnNumber: 25
                                                            }, this),
                                                            product.clickupListId ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                className: "next-hdr-prod-dd-badge",
                                                                children: "✓ ClickUp"
                                                            }, void 0, false, {
                                                                fileName: "[project]/components/command-center/CommandCenterHeader.tsx",
                                                                lineNumber: 106,
                                                                columnNumber: 50
                                                            }, this) : null,
                                                            isActive ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
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
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                    className: "next-hdr-prod-dd-item",
                                                    onClick: onAddProduct,
                                                    type: "button",
                                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
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
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "next-hdr-right",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
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
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    className: "next-btn-sync",
                                    onClick: onSync,
                                    type: "button",
                                    children: "Sync ClickUp"
                                }, void 0, false, {
                                    fileName: "[project]/components/command-center/CommandCenterHeader.tsx",
                                    lineNumber: 126,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    className: "next-btn-ghost",
                                    onClick: onReset,
                                    type: "button",
                                    children: "↻ Reset"
                                }, void 0, false, {
                                    fileName: "[project]/components/command-center/CommandCenterHeader.tsx",
                                    lineNumber: 129,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "next-live-sync-bar",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "next-live-dot"
                                        }, void 0, false, {
                                            fileName: "[project]/components/command-center/CommandCenterHeader.tsx",
                                            lineNumber: 133,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "next-live-sync-lbl",
                                            children: statusText || "Not synced"
                                        }, void 0, false, {
                                            fileName: "[project]/components/command-center/CommandCenterHeader.tsx",
                                            lineNumber: 134,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
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
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
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
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    className: "next-presence-bar",
                                    onClick: onPresenceClick,
                                    type: "button",
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
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
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("nav", {
                className: "next-tabs-wrap",
                "aria-label": "Dashboard sections",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "next-tabs",
                    role: "tablist",
                    children: [
                        dashboardTabs.map((tab)=>{
                            const isActive = activeTab === tab.id;
                            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                "aria-selected": isActive,
                                className: isActive ? "next-tab on" : "next-tab",
                                onClick: ()=>onTabSelect(tab.id),
                                role: "tab",
                                type: "button",
                                children: [
                                    tab.label,
                                    tab.countId ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
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
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
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
_c = CommandCenterHeader;
var _c;
__turbopack_context__.k.register(_c, "CommandCenterHeader");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/lib/command-center/state.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
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
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/lib/command-center/legacy-snapshot.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "readLegacyCommandCenterState",
    ()=>readLegacyCommandCenterState,
    "readLegacyProductSnapshot",
    ()=>readLegacyProductSnapshot
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$command$2d$center$2f$state$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/command-center/state.ts [app-client] (ecmascript)");
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
        products: (payload?.PRODUCTS || []).map(__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$command$2d$center$2f$state$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["normalizeProduct"])
    };
}
function readLegacyCommandCenterState(legacyWindow) {
    const payload = readLegacyPayload(legacyWindow);
    const empty = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$command$2d$center$2f$state$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createEmptyCommandCenterState"])();
    if (!payload) return empty;
    return {
        ...empty,
        products: (payload.PRODUCTS || []).map(__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$command$2d$center$2f$state$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["normalizeProduct"]),
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
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/lib/command-center/metrics.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
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
    ()=>getCommandHqMetrics,
    "getCreativeTrackerSummary",
    ()=>getCreativeTrackerSummary,
    "getPersonasSummary",
    ()=>getPersonasSummary
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
function getPrimaryCreativesForPersona(creatives, personaName) {
    return creatives.filter((creative)=>creative.persona === personaName && !creative.parentAdId);
}
function deriveAngleStatus(angleName, creatives) {
    const statuses = getPrimaryCreativesForAngle(creatives, angleName).map((creative)=>creative.status || "Untested");
    if (statuses.length === 0) return "Untested";
    return statusPriority.find((status)=>statuses.includes(status)) || "Untested";
}
function derivePersonaStatus(personaName, creatives) {
    const statuses = getPrimaryCreativesForPersona(creatives, personaName).map((creative)=>creative.status || "Untested");
    if (statuses.length === 0) return "Untested";
    return statusPriority.find((status)=>statuses.includes(status)) || "Untested";
}
function buildSourceLabel(sourceLink) {
    if (!sourceLink) return "";
    const withoutProtocol = sourceLink.replace(/^https?:\/\/(www\.)?/, "");
    return withoutProtocol.length > 30 ? `${withoutProtocol.slice(0, 30)}...` : withoutProtocol;
}
function formatDate(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
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
function getPersonasSummary(state) {
    const creatives = state.creatives || [];
    let winners = 0;
    let testing = 0;
    let untested = 0;
    let totalCreatives = 0;
    const personas = state.personas.map((persona, index)=>{
        const primaryCreatives = getPrimaryCreativesForPersona(creatives, persona.name);
        const status = derivePersonaStatus(persona.name, creatives);
        const statusClass = classifyStatus(status);
        const winnerCount = primaryCreatives.filter((creative)=>{
            const creativeStatus = normalizeStatus(creative.status);
            return creativeStatus === "winner" || creativeStatus === "mild winner";
        }).length;
        const angleCount = new Set(primaryCreatives.map((creative)=>creative.angle).filter(Boolean)).size;
        const winRate = primaryCreatives.length > 0 ? Math.round(winnerCount / primaryCreatives.length * 100) : 0;
        if (status === "Winner" || status === "Mild Winner" || status === "Scale") winners += 1;
        else if (status === "Testing") testing += 1;
        else if (status === "Untested") untested += 1;
        totalCreatives += primaryCreatives.length;
        return {
            id: persona.id || persona.name,
            index,
            name: persona.name,
            notes: persona.notes || "",
            sourceLink: persona.sourceLink || "",
            sourceLabel: buildSourceLabel(persona.sourceLink || ""),
            status,
            tone: statusClass.tone,
            angles: angleCount,
            creatives: primaryCreatives.length,
            winners: winnerCount,
            winRate
        };
    });
    return {
        totalPersonas: state.personas.length,
        winners,
        testing,
        untested,
        totalCreatives,
        personas
    };
}
function getCreativeTrackerSummary(state) {
    const creatives = state.creatives || [];
    const rows = creatives.filter((creative)=>{
        if (creative.trackerRefId) return false;
        if (creative.parentAdId && creative.adOrigin !== "Winner Variation") return false;
        return true;
    }).map((creative)=>{
        const statusClass = classifyStatus(creative.status);
        const kind = creative.adOrigin === "Winner Variation" && creative.parentAdId ? "variation" : creative.taskType === "production" ? "production" : "format";
        return {
            id: creative.id,
            formatName: creative.formatName || creative.name || creative.id,
            angle: creative.angle || "",
            persona: creative.persona || "",
            creativeStructure: creative.creativeStructure || "",
            hookType: creative.hookType || "",
            productionStyle: creative.productionStyle || "",
            creativeHypothesis: creative.creativeHypothesis || "",
            adLink: creative.adLink || "",
            adLinkLabel: buildSourceLabel(creative.adLink || ""),
            driveLink: creative.driveLink || "",
            adType: creative.adType || "",
            funnelStage: creative.funnelStage || "",
            status: creative.status || "Untested",
            tone: statusClass.tone,
            dateCreated: formatDate(creative.dateCreated),
            variationCount: creatives.filter((variation)=>variation.parentAdId === creative.id).length,
            kind
        };
    });
    return {
        total: rows.length,
        formats: rows.filter((row)=>row.kind === "format").length,
        production: rows.filter((row)=>row.kind === "production").length,
        variations: rows.filter((row)=>row.kind === "variation").length,
        winners: rows.filter((row)=>{
            const status = normalizeStatus(row.status);
            return status === "winner" || status === "mild winner" || status === "scale";
        }).length,
        testing: rows.filter((row)=>normalizeStatus(row.status) === "testing").length,
        rows
    };
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/lib/command-center/storage.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
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
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$command$2d$center$2f$state$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/command-center/state.ts [app-client] (ecmascript)");
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
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$command$2d$center$2f$state$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["mergeTrackerFilters"])(readJsonStorage(storage, storageKeys.trackerFilters(productId), __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$command$2d$center$2f$state$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defaultTrackerFilters"]));
}
function writeTrackerFilters(storage, productId, filters) {
    writeJsonStorage(storage, storageKeys.trackerFilters(productId), filters);
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/lib/command-center/types.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/lib/command-center/index.ts [app-client] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$command$2d$center$2f$legacy$2d$snapshot$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/command-center/legacy-snapshot.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$command$2d$center$2f$metrics$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/command-center/metrics.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$command$2d$center$2f$state$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/command-center/state.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$command$2d$center$2f$storage$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/command-center/storage.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$command$2d$center$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/command-center/types.ts [app-client] (ecmascript)");
;
;
;
;
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/hooks/command-center/useLegacyDashboardBridge.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useLegacyDashboardBridge",
    ()=>useLegacyDashboardBridge
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$command$2d$center$2f$CommandCenterHeader$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/command-center/CommandCenterHeader.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$command$2d$center$2f$index$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/lib/command-center/index.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$command$2d$center$2f$state$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/command-center/state.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$command$2d$center$2f$legacy$2d$snapshot$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/command-center/legacy-snapshot.ts [app-client] (ecmascript)");
var _s = __turbopack_context__.k.signature();
"use client";
;
;
;
const countIds = __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$command$2d$center$2f$CommandCenterHeader$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["dashboardTabs"].map((tab)=>tab.countId).filter((countId)=>Boolean(countId));
function useLegacyDashboardBridge(enabled) {
    _s();
    const iframeRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const [activeProductId, setActiveProductId] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [activeTab, setActiveTab] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("hq");
    const [apiKey, setApiKey] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [commandCenterState, setCommandCenterState] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({
        "useLegacyDashboardBridge.useState": ()=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$command$2d$center$2f$state$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createEmptyCommandCenterState"])()
    }["useLegacyDashboardBridge.useState"]);
    const [counts, setCounts] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({});
    const [forceReloadVisible, setForceReloadVisible] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [productColor, setProductColor] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("#94A3B8");
    const [productMenuOpen, setProductMenuOpen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [productName, setProductName] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("No Product");
    const [products, setProducts] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [statusText, setStatusText] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("Not synced");
    const getLegacyWindow = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useLegacyDashboardBridge.useCallback[getLegacyWindow]": ()=>iframeRef.current?.contentWindow
    }["useLegacyDashboardBridge.useCallback[getLegacyWindow]"], []);
    const getLegacyDocument = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useLegacyDashboardBridge.useCallback[getLegacyDocument]": ()=>iframeRef.current?.contentDocument || null
    }["useLegacyDashboardBridge.useCallback[getLegacyDocument]"], []);
    const callLegacy = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useLegacyDashboardBridge.useCallback[callLegacy]": (fnName)=>{
            const legacyWindow = getLegacyWindow();
            const fn = legacyWindow?.[fnName];
            if (typeof fn === "function") fn.call(legacyWindow);
        }
    }["useLegacyDashboardBridge.useCallback[callLegacy]"], [
        getLegacyWindow
    ]);
    const syncFromLegacyDom = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useLegacyDashboardBridge.useCallback[syncFromLegacyDom]": ()=>{
            if (!enabled) return;
            const doc = getLegacyDocument();
            if (!doc) return;
            const nextCounts = {};
            countIds.forEach({
                "useLegacyDashboardBridge.useCallback[syncFromLegacyDom]": (countId)=>{
                    nextCounts[countId] = doc.getElementById(countId)?.textContent?.trim() || "0";
                }
            }["useLegacyDashboardBridge.useCallback[syncFromLegacyDom]"]);
            setCounts(nextCounts);
            setApiKey(doc.getElementById("apiKeyInput")?.value || "");
            setForceReloadVisible(doc.getElementById("forceReloadAllBtn")?.style.display !== "none");
            setProductColor(doc.getElementById("hdrProdDot")?.style.background || "#94A3B8");
            setProductName(doc.getElementById("hdrProdName")?.textContent?.trim() || "No Product");
            setStatusText(doc.getElementById("statusLbl")?.textContent?.trim() || "Not synced");
            const productState = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$command$2d$center$2f$legacy$2d$snapshot$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["readLegacyProductSnapshot"])(getLegacyWindow());
            setActiveProductId(productState.activeProductId);
            setProducts(productState.products);
            setCommandCenterState((0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$command$2d$center$2f$legacy$2d$snapshot$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["readLegacyCommandCenterState"])(getLegacyWindow()));
            const activeButton = doc.querySelector(".tabs .tab.on");
            const onclick = activeButton?.getAttribute("onclick") || "";
            const match = onclick.match(/showTab\('([^']+)'/);
            if (match?.[1]) setActiveTab(match[1]);
        }
    }["useLegacyDashboardBridge.useCallback[syncFromLegacyDom]"], [
        enabled,
        getLegacyDocument,
        getLegacyWindow
    ]);
    const syncSoon = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useLegacyDashboardBridge.useCallback[syncSoon]": ()=>{
            window.setTimeout(syncFromLegacyDom, 120);
        }
    }["useLegacyDashboardBridge.useCallback[syncSoon]"], [
        syncFromLegacyDom
    ]);
    const hideLegacyShell = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useLegacyDashboardBridge.useCallback[hideLegacyShell]": ()=>{
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
        }
    }["useLegacyDashboardBridge.useCallback[hideLegacyShell]"], [
        enabled,
        getLegacyDocument
    ]);
    const handleFrameLoad = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useLegacyDashboardBridge.useCallback[handleFrameLoad]": ()=>{
            hideLegacyShell();
            syncFromLegacyDom();
        }
    }["useLegacyDashboardBridge.useCallback[handleFrameLoad]"], [
        hideLegacyShell,
        syncFromLegacyDom
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "useLegacyDashboardBridge.useEffect": ()=>{
            if (!enabled) return undefined;
            const interval = window.setInterval(syncFromLegacyDom, 1000);
            return ({
                "useLegacyDashboardBridge.useEffect": ()=>window.clearInterval(interval)
            })["useLegacyDashboardBridge.useEffect"];
        }
    }["useLegacyDashboardBridge.useEffect"], [
        enabled,
        syncFromLegacyDom
    ]);
    const handleTabSelect = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useLegacyDashboardBridge.useCallback[handleTabSelect]": (tabId)=>{
            setActiveTab(tabId);
            const legacyWindow = getLegacyWindow();
            const doc = getLegacyDocument();
            const button = doc?.querySelector(`.tabs .tab[onclick*="'${tabId}'"]`) || null;
            if (typeof legacyWindow?.showTab === "function") {
                legacyWindow.showTab(tabId, button);
            }
            window.setTimeout(syncFromLegacyDom, 50);
        }
    }["useLegacyDashboardBridge.useCallback[handleTabSelect]"], [
        getLegacyDocument,
        getLegacyWindow,
        syncFromLegacyDom
    ]);
    const handleApiKeyChange = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useLegacyDashboardBridge.useCallback[handleApiKeyChange]": (value)=>{
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
        }
    }["useLegacyDashboardBridge.useCallback[handleApiKeyChange]"], [
        getLegacyDocument
    ]);
    const callLegacyWithSyntheticClick = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useLegacyDashboardBridge.useCallback[callLegacyWithSyntheticClick]": (fnName)=>{
            const legacyWindow = getLegacyWindow();
            const fn = legacyWindow?.[fnName];
            if (typeof fn === "function") {
                fn.call(legacyWindow, {
                    stopPropagation () {}
                });
            }
        }
    }["useLegacyDashboardBridge.useCallback[callLegacyWithSyntheticClick]"], [
        getLegacyWindow
    ]);
    const handleProductSelect = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useLegacyDashboardBridge.useCallback[handleProductSelect]": (productId)=>{
            setProductMenuOpen(false);
            const legacyWindow = getLegacyWindow();
            if (typeof legacyWindow?.hdrSwitchProduct === "function") {
                legacyWindow.hdrSwitchProduct(productId);
            }
            window.setTimeout(syncFromLegacyDom, 100);
        }
    }["useLegacyDashboardBridge.useCallback[handleProductSelect]"], [
        getLegacyWindow,
        syncFromLegacyDom
    ]);
    const handleAddProduct = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useLegacyDashboardBridge.useCallback[handleAddProduct]": ()=>{
            setProductMenuOpen(false);
            callLegacy("openAddProductModal");
        }
    }["useLegacyDashboardBridge.useCallback[handleAddProduct]"], [
        callLegacy
    ]);
    const handleAddAngle = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useLegacyDashboardBridge.useCallback[handleAddAngle]": ()=>{
            const legacyWindow = getLegacyWindow();
            if (typeof legacyWindow?.addAngleRow === "function") {
                legacyWindow.addAngleRow();
                syncSoon();
            }
        }
    }["useLegacyDashboardBridge.useCallback[handleAddAngle]"], [
        getLegacyWindow,
        syncSoon
    ]);
    const handleEditAngle = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useLegacyDashboardBridge.useCallback[handleEditAngle]": (index)=>{
            const legacyWindow = getLegacyWindow();
            if (typeof legacyWindow?.openEditAngle === "function") {
                legacyWindow.openEditAngle(index);
                syncSoon();
            }
        }
    }["useLegacyDashboardBridge.useCallback[handleEditAngle]"], [
        getLegacyWindow,
        syncSoon
    ]);
    const handleDeleteAngle = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useLegacyDashboardBridge.useCallback[handleDeleteAngle]": (index)=>{
            const legacyWindow = getLegacyWindow();
            if (typeof legacyWindow?.deleteAngle === "function") {
                legacyWindow.deleteAngle(index);
                syncSoon();
            }
        }
    }["useLegacyDashboardBridge.useCallback[handleDeleteAngle]"], [
        getLegacyWindow,
        syncSoon
    ]);
    const handleUpdateAngleName = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useLegacyDashboardBridge.useCallback[handleUpdateAngleName]": (index, value)=>{
            const legacyWindow = getLegacyWindow();
            if (typeof legacyWindow?.updateAngleName === "function") {
                legacyWindow.updateAngleName(index, value);
                syncSoon();
            }
        }
    }["useLegacyDashboardBridge.useCallback[handleUpdateAngleName]"], [
        getLegacyWindow,
        syncSoon
    ]);
    const handleUpdateAngleNotes = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useLegacyDashboardBridge.useCallback[handleUpdateAngleNotes]": (index, value)=>{
            const legacyWindow = getLegacyWindow();
            if (typeof legacyWindow?.updateAngleNotes === "function") {
                legacyWindow.updateAngleNotes(index, value);
                syncSoon();
            }
        }
    }["useLegacyDashboardBridge.useCallback[handleUpdateAngleNotes]"], [
        getLegacyWindow,
        syncSoon
    ]);
    const handleSaveAngleFields = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useLegacyDashboardBridge.useCallback[handleSaveAngleFields]": (index, fields)=>{
            const legacyWindow = getLegacyWindow();
            if (!legacyWindow?.eval) return;
            const payload = JSON.stringify({
                index,
                name: fields.name,
                notes: fields.notes,
                sourceLink: fields.sourceLink
            });
            legacyWindow.eval(`(function(payload){
        var data = JSON.parse(payload);
        var idx = data.index;
        if (!ANGLES[idx]) return;
        var oldName = ANGLES[idx].name;
        var newName = (data.name || oldName).trim() || oldName;
        ANGLES[idx].name = newName;
        ANGLES[idx].sourceLink = (data.sourceLink || '').trim();
        ANGLES[idx].notes = (data.notes || '').trim();
        if (newName !== oldName) {
          for (var i = 0; i < ADS.length; i++) {
            if (ADS[i].angle === oldName) ADS[i].angle = newName;
          }
          for (var j = 0; j < INSPIRATIONS.length; j++) {
            if (INSPIRATIONS[j].angle === oldName) INSPIRATIONS[j].angle = newName;
          }
          if (ANGLE_PERSONAS[oldName] !== undefined) {
            ANGLE_PERSONAS[newName] = ANGLE_PERSONAS[oldName];
            delete ANGLE_PERSONAS[oldName];
          }
          renameAngleInMatrixKeys(oldName, newName);
        }
        P = process(ADS);
        deriveWinners();
        genActions();
        buildCreativeUsageIndex();
        renderAll();
        saveInspirations();
        saveState();
        toast(newName !== oldName ? 'Angle renamed to "' + newName + '"' : 'Angle updated');
      })(${JSON.stringify(payload)})`);
            syncSoon();
        }
    }["useLegacyDashboardBridge.useCallback[handleSaveAngleFields]"], [
        getLegacyWindow,
        syncSoon
    ]);
    const handleAddPersona = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useLegacyDashboardBridge.useCallback[handleAddPersona]": ()=>{
            const legacyWindow = getLegacyWindow();
            if (typeof legacyWindow?.addPersonaRow === "function") {
                legacyWindow.addPersonaRow();
                syncSoon();
            }
        }
    }["useLegacyDashboardBridge.useCallback[handleAddPersona]"], [
        getLegacyWindow,
        syncSoon
    ]);
    const handleEditPersona = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useLegacyDashboardBridge.useCallback[handleEditPersona]": (index)=>{
            const legacyWindow = getLegacyWindow();
            if (typeof legacyWindow?.openEditPersona === "function") {
                legacyWindow.openEditPersona(index);
                syncSoon();
            }
        }
    }["useLegacyDashboardBridge.useCallback[handleEditPersona]"], [
        getLegacyWindow,
        syncSoon
    ]);
    const handleDeletePersona = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useLegacyDashboardBridge.useCallback[handleDeletePersona]": (index)=>{
            const legacyWindow = getLegacyWindow();
            if (typeof legacyWindow?.deletePersona === "function") {
                legacyWindow.deletePersona(index);
                syncSoon();
            }
        }
    }["useLegacyDashboardBridge.useCallback[handleDeletePersona]"], [
        getLegacyWindow,
        syncSoon
    ]);
    const handleUpdatePersonaName = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useLegacyDashboardBridge.useCallback[handleUpdatePersonaName]": (index, value)=>{
            const legacyWindow = getLegacyWindow();
            if (typeof legacyWindow?.updatePersonaName === "function") {
                legacyWindow.updatePersonaName(index, value);
                syncSoon();
            }
        }
    }["useLegacyDashboardBridge.useCallback[handleUpdatePersonaName]"], [
        getLegacyWindow,
        syncSoon
    ]);
    const handleUpdatePersonaNotes = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useLegacyDashboardBridge.useCallback[handleUpdatePersonaNotes]": (index, value)=>{
            const legacyWindow = getLegacyWindow();
            if (typeof legacyWindow?.updatePersonaNotes === "function") {
                legacyWindow.updatePersonaNotes(index, value);
                syncSoon();
            }
        }
    }["useLegacyDashboardBridge.useCallback[handleUpdatePersonaNotes]"], [
        getLegacyWindow,
        syncSoon
    ]);
    const handleSavePersonaFields = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useLegacyDashboardBridge.useCallback[handleSavePersonaFields]": (index, fields)=>{
            const legacyWindow = getLegacyWindow();
            if (!legacyWindow?.eval) return;
            const payload = JSON.stringify({
                index,
                name: fields.name,
                notes: fields.notes,
                sourceLink: fields.sourceLink
            });
            legacyWindow.eval(`(function(payload){
        var data = JSON.parse(payload);
        var idx = data.index;
        if (!PERSONAS[idx]) return;
        var oldName = PERSONAS[idx].name;
        var newName = (data.name || oldName).trim() || oldName;
        PERSONAS[idx].name = newName;
        PERSONAS[idx].sourceLink = (data.sourceLink || '').trim();
        PERSONAS[idx].notes = (data.notes || '').trim();
        if (newName !== oldName) {
          for (var i = 0; i < ADS.length; i++) {
            if (ADS[i].persona === oldName) ADS[i].persona = newName;
          }
          for (var j = 0; j < INSPIRATIONS.length; j++) {
            if (INSPIRATIONS[j].persona === oldName) INSPIRATIONS[j].persona = newName;
          }
          for (var key in ANGLE_PERSONAS) {
            var foundIdx = ANGLE_PERSONAS[key].indexOf(oldName);
            if (foundIdx !== -1) ANGLE_PERSONAS[key][foundIdx] = newName;
          }
          renamePersonaInMatrixKeys(oldName, newName);
        }
        P = process(ADS);
        deriveWinners();
        genActions();
        buildCreativeUsageIndex();
        renderAll();
        saveInspirations();
        saveState();
        toast(newName !== oldName ? 'Persona renamed to "' + newName + '"' : 'Persona updated');
      })(${JSON.stringify(payload)})`);
            syncSoon();
        }
    }["useLegacyDashboardBridge.useCallback[handleSavePersonaFields]"], [
        getLegacyWindow,
        syncSoon
    ]);
    const handleUpdateCreativeField = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useLegacyDashboardBridge.useCallback[handleUpdateCreativeField]": (adId, field, value)=>{
            const legacyWindow = getLegacyWindow();
            if (typeof legacyWindow?.updateCreativeFieldInline === "function") {
                legacyWindow.updateCreativeFieldInline(adId, field, value);
                syncSoon();
            }
        }
    }["useLegacyDashboardBridge.useCallback[handleUpdateCreativeField]"], [
        getLegacyWindow,
        syncSoon
    ]);
    const handleUpdateCreativeStatus = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useLegacyDashboardBridge.useCallback[handleUpdateCreativeStatus]": (adId, status)=>{
            const legacyWindow = getLegacyWindow();
            if (!legacyWindow?.eval) return;
            const payload = JSON.stringify({
                adId,
                status
            });
            legacyWindow.eval(`(function(payload){
        var data = JSON.parse(payload);
        var idx = ADS.findIndex(function(ad) { return ad.id === data.adId; });
        if (idx === -1 || typeof updateCreativeStatus !== 'function') return;
        updateCreativeStatus(idx, data.status);
      })(${JSON.stringify(payload)})`);
            syncSoon();
        }
    }["useLegacyDashboardBridge.useCallback[handleUpdateCreativeStatus]"], [
        getLegacyWindow,
        syncSoon
    ]);
    const handleCreateCreative = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useLegacyDashboardBridge.useCallback[handleCreateCreative]": (values)=>{
            const legacyWindow = getLegacyWindow();
            if (!legacyWindow?.eval) return;
            const payload = JSON.stringify(values);
            legacyWindow.eval(`(function(payload){
        var data = JSON.parse(payload);
        var newAd = {
          id: (typeof nextSerialId === 'function') ? nextSerialId() : ('AD-' + Date.now()),
          formatName: (data.formatName || '').trim() || (typeof generateTaskName === 'function' ? generateTaskName('manual') : 'Manual Creative'),
          adLink: (data.adLink || '').trim(),
          driveLink: (data.driveLink || '').trim(),
          adType: data.adType || 'Video',
          funnelStage: data.funnelStage || 'TOF',
          status: data.status || 'Untested',
          angle: data.angle || '',
          persona: data.persona || '',
          creativeStructure: data.creativeStructure || '',
          hookType: data.hookType || '',
          productionStyle: data.productionStyle || '',
          creativeHypothesis: (data.creativeHypothesis || '').trim(),
          parentAdId: null,
          variationNumber: null,
          adOrigin: 'Manual'
        };
        ADS.push(newAd);
        if (typeof process === 'function') P = process(ADS);
        if (typeof deriveWinners === 'function') deriveWinners();
        if (typeof genActions === 'function') genActions();
        if (typeof buildCreativeUsageIndex === 'function') buildCreativeUsageIndex();
        if (typeof populateFilterOptions === 'function') populateFilterOptions();
        if (typeof renderAll === 'function') renderAll();
        if (typeof saveState === 'function') saveState();
        if (typeof toast === 'function') toast('Creative ' + newAd.id + ' created');
      })(${JSON.stringify(payload)})`);
            syncSoon();
        }
    }["useLegacyDashboardBridge.useCallback[handleCreateCreative]"], [
        getLegacyWindow,
        syncSoon
    ]);
    const handleSaveCreative = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useLegacyDashboardBridge.useCallback[handleSaveCreative]": (id, values)=>{
            const legacyWindow = getLegacyWindow();
            if (!legacyWindow?.eval) return;
            const payload = JSON.stringify({
                id,
                values
            });
            legacyWindow.eval(`(function(payload){
        var data = JSON.parse(payload);
        var vals = data.values || {};
        var idx = ADS.findIndex(function(ad) { return ad.id === data.id; });
        if (idx === -1) return;
        var ad = ADS[idx];
        var oldName = ad.formatName;
        var oldAdLink = ad.adLink;
        var oldDriveLink = ad.driveLink;
        var oldAdType = ad.adType;
        var oldFunnelStage = ad.funnelStage;
        var oldStatus = ad.status;
        var oldAngle = ad.angle;
        var oldPersona = ad.persona;

        ad.formatName = (vals.formatName || '').trim() || ad.formatName || data.id;
        ad.adLink = (vals.adLink || '').trim();
        ad.driveLink = (vals.driveLink || '').trim();
        ad.adType = vals.adType || '';
        ad.funnelStage = vals.funnelStage || '';
        if (typeof _stampAdStatusChange === 'function') {
          _stampAdStatusChange(ad, vals.status || 'Untested');
        } else {
          ad.status = vals.status || 'Untested';
        }
        ad.angle = vals.angle || '';
        ad.persona = vals.persona || '';
        ad.creativeStructure = vals.creativeStructure || '';
        ad.hookType = vals.hookType || '';
        ad.productionStyle = vals.productionStyle || '';
        ad.creativeHypothesis = (vals.creativeHypothesis || '').trim();
        ADS[idx] = ad;

        if (ad.formatName !== oldName && ad.formatName) {
          if (typeof MATRIX_CELL_META !== 'undefined') {
            Object.keys(MATRIX_CELL_META).forEach(function(k) {
              if (k.indexOf(ad.id + '||') === 0) MATRIX_CELL_META[k].uniqueName = ad.formatName;
            });
          }
          if (typeof MANUAL_ACTIONS !== 'undefined') {
            for (var mai = 0; mai < MANUAL_ACTIONS.length; mai++) {
              var ma = MANUAL_ACTIONS[mai];
              if (ma.sourceAdId === ad.id || ma.adId === ad.id || ma._clickupId === ad._clickupId) ma.title = ad.formatName;
            }
          }
        }

        if (typeof process === 'function') P = process(ADS);
        if (typeof deriveWinners === 'function') deriveWinners();
        if (typeof genActions === 'function') genActions();
        if (typeof buildCreativeUsageIndex === 'function') buildCreativeUsageIndex();
        if (typeof populateFilterOptions === 'function') populateFilterOptions();
        if (typeof renderAll === 'function') renderAll();
        if (typeof saveState === 'function') saveState();
        if (typeof toast === 'function') toast('Creative ' + data.id + ' updated');

        if (ad._clickupId && CFG && CFG.key) {
          var taskBody = {};
          if (ad.formatName !== oldName) taskBody.name = ad.formatName;
          if (ad.adLink !== oldAdLink && ad.adLink) taskBody.url = ad.adLink;
          if (ad.status !== oldStatus) {
            var cuStatusMap = {
              'Untested':'to do','Approved':'approved','In Production':'in production',
              'Ready to Launch':'ready to launch','Testing':'testing',
              'Mild Winner':'mild winner','Winner':'winner',
              'Loser':'loser','Scale':'scale','Complete':'complete'
            };
            taskBody.status = cuStatusMap[ad.status] || String(ad.status || '').toLowerCase();
          }
          if (Object.keys(taskBody).length && typeof _syncToClickUp === 'function') {
            _syncToClickUp(ad._clickupId, taskBody, 'edit ' + (ad.formatName || data.id));
          }
          if (typeof pushFieldToClickUp === 'function') {
            if (ad.adType !== oldAdType && ad.adType) pushFieldToClickUp(ad, 'adType', ad.adType);
            if (ad.funnelStage !== oldFunnelStage && ad.funnelStage) pushFieldToClickUp(ad, 'funnelStage', ad.funnelStage);
            if (ad.angle !== oldAngle && ad.angle) pushFieldToClickUp(ad, 'angle', ad.angle);
            if (ad.persona !== oldPersona && ad.persona) pushFieldToClickUp(ad, 'persona', ad.persona);
            if (ad.adLink !== oldAdLink && ad.adLink) pushFieldToClickUp(ad, 'adLink', ad.adLink);
            if (ad.driveLink !== oldDriveLink && ad.driveLink) pushFieldToClickUp(ad, 'driveLink', ad.driveLink);
            pushFieldToClickUp(ad, 'creativeStructure', ad.creativeStructure || '');
            pushFieldToClickUp(ad, 'hookType', ad.hookType || '');
            pushFieldToClickUp(ad, 'productionStyle', ad.productionStyle || '');
            pushFieldToClickUp(ad, 'creativeHypothesis', ad.creativeHypothesis || '');
          }
        }
      })(${JSON.stringify(payload)})`);
            syncSoon();
        }
    }["useLegacyDashboardBridge.useCallback[handleSaveCreative]"], [
        getLegacyWindow,
        syncSoon
    ]);
    const handleDeleteCreative = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useLegacyDashboardBridge.useCallback[handleDeleteCreative]": (id)=>{
            const legacyWindow = getLegacyWindow();
            if (legacyWindow?.eval) {
                const payload = JSON.stringify({
                    id
                });
                legacyWindow.eval(`(function(payload){
          var data = JSON.parse(payload);
          if (typeof deleteCreative !== 'function') return;
          deleteCreative(data.id);
        })(${JSON.stringify(payload)})`);
                window.setTimeout(syncFromLegacyDom, 500);
            }
        }
    }["useLegacyDashboardBridge.useCallback[handleDeleteCreative]"], [
        getLegacyWindow,
        syncFromLegacyDom
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
            handleAddAngle,
            handleCreateCreative,
            handleAddPersona,
            handleAddProduct,
            handleApiKeyChange,
            handleDeleteAngle,
            handleDeleteCreative,
            handleDeletePersona,
            handleEditAngle,
            handleSaveCreative,
            handleEditPersona,
            handleFrameLoad,
            handleProductSelect,
            handleTabSelect,
            handleSaveAngleFields,
            handleSavePersonaFields,
            handleUpdateCreativeField,
            handleUpdateCreativeStatus,
            handleUpdateAngleName,
            handleUpdateAngleNotes,
            handleUpdatePersonaName,
            handleUpdatePersonaNotes,
            setProductMenuOpen,
            syncFromLegacyDom
        }
    };
}
_s(useLegacyDashboardBridge, "xGnRu11LdlCxssw+hr502fW+NGM=");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/components/command-center/AnglesReadOnlyPanel.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AnglesReadOnlyPanel",
    ()=>AnglesReadOnlyPanel
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$command$2d$center$2f$index$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/lib/command-center/index.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$command$2d$center$2f$metrics$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/command-center/metrics.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
function formatNumber(value) {
    return new Intl.NumberFormat("en-US").format(value);
}
function toneClass(tone) {
    return `next-status-badge ${tone}`;
}
function blurOnEnter(event) {
    if (event.key === "Enter") {
        event.currentTarget.blur();
    }
}
function AnglesReadOnlyPanel({ onAddAngle, onDeleteAngle, onSaveAngleFields, onUpdateAngleName, onUpdateAngleNotes, state }) {
    _s();
    const [editingAngle, setEditingAngle] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const summary = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$command$2d$center$2f$metrics$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getAnglesSummary"])(state);
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
    function openEditor(angle) {
        setEditingAngle(angle);
    }
    function handleEditorSubmit(event) {
        event.preventDefault();
        if (!editingAngle) return;
        const form = new FormData(event.currentTarget);
        onSaveAngleFields(editingAngle.index, {
            name: String(form.get("name") || editingAngle.name),
            notes: String(form.get("notes") || ""),
            sourceLink: String(form.get("sourceLink") || "")
        });
        setEditingAngle(null);
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
        className: "next-angles-panel",
        "aria-label": "Angles read-only summary",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "next-panel-head",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                            children: "Angle Tracker"
                        }, void 0, false, {
                            fileName: "[project]/components/command-center/AnglesReadOnlyPanel.tsx",
                            lineNumber: 76,
                            columnNumber: 11
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/components/command-center/AnglesReadOnlyPanel.tsx",
                        lineNumber: 75,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        className: "next-panel-action",
                        onClick: onAddAngle,
                        type: "button",
                        children: "Add Angle"
                    }, void 0, false, {
                        fileName: "[project]/components/command-center/AnglesReadOnlyPanel.tsx",
                        lineNumber: 78,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/components/command-center/AnglesReadOnlyPanel.tsx",
                lineNumber: 74,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "next-tracker-summary",
                children: summaryItems.map(([label, value])=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "next-tracker-summary-stat",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                children: label
                            }, void 0, false, {
                                fileName: "[project]/components/command-center/AnglesReadOnlyPanel.tsx",
                                lineNumber: 85,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("strong", {
                                children: formatNumber(Number(value))
                            }, void 0, false, {
                                fileName: "[project]/components/command-center/AnglesReadOnlyPanel.tsx",
                                lineNumber: 86,
                                columnNumber: 13
                            }, this)
                        ]
                    }, label, true, {
                        fileName: "[project]/components/command-center/AnglesReadOnlyPanel.tsx",
                        lineNumber: 84,
                        columnNumber: 11
                    }, this))
            }, void 0, false, {
                fileName: "[project]/components/command-center/AnglesReadOnlyPanel.tsx",
                lineNumber: 82,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "next-angle-grid with-actions",
                role: "table",
                "aria-label": "Angles",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "next-angle-header",
                        role: "row",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                children: "#"
                            }, void 0, false, {
                                fileName: "[project]/components/command-center/AnglesReadOnlyPanel.tsx",
                                lineNumber: 92,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                children: "Angle Name"
                            }, void 0, false, {
                                fileName: "[project]/components/command-center/AnglesReadOnlyPanel.tsx",
                                lineNumber: 93,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                children: "Status"
                            }, void 0, false, {
                                fileName: "[project]/components/command-center/AnglesReadOnlyPanel.tsx",
                                lineNumber: 94,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                children: "Source Link"
                            }, void 0, false, {
                                fileName: "[project]/components/command-center/AnglesReadOnlyPanel.tsx",
                                lineNumber: 95,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                children: "Stats"
                            }, void 0, false, {
                                fileName: "[project]/components/command-center/AnglesReadOnlyPanel.tsx",
                                lineNumber: 96,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                children: "Notes"
                            }, void 0, false, {
                                fileName: "[project]/components/command-center/AnglesReadOnlyPanel.tsx",
                                lineNumber: 97,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                children: "Actions"
                            }, void 0, false, {
                                fileName: "[project]/components/command-center/AnglesReadOnlyPanel.tsx",
                                lineNumber: 98,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/components/command-center/AnglesReadOnlyPanel.tsx",
                        lineNumber: 91,
                        columnNumber: 9
                    }, this),
                    summary.angles.length === 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "next-empty-state",
                        children: "No angles yet"
                    }, void 0, false, {
                        fileName: "[project]/components/command-center/AnglesReadOnlyPanel.tsx",
                        lineNumber: 101,
                        columnNumber: 11
                    }, this) : summary.angles.map((angle)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: `next-angle-row status-${angle.tone}`,
                            role: "row",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "next-angle-num",
                                    children: angle.index + 1
                                }, void 0, false, {
                                    fileName: "[project]/components/command-center/AnglesReadOnlyPanel.tsx",
                                    lineNumber: 105,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "next-angle-name",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                            "aria-label": `Angle name ${angle.index + 1}`,
                                            defaultValue: angle.name,
                                            onBlur: (event)=>onUpdateAngleName(angle.index, event.currentTarget.value),
                                            onKeyDown: blurOnEnter,
                                            type: "text"
                                        }, void 0, false, {
                                            fileName: "[project]/components/command-center/AnglesReadOnlyPanel.tsx",
                                            lineNumber: 107,
                                            columnNumber: 17
                                        }, this),
                                        angle.tone === "win" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "next-win-badge",
                                            children: "Winner"
                                        }, void 0, false, {
                                            fileName: "[project]/components/command-center/AnglesReadOnlyPanel.tsx",
                                            lineNumber: 114,
                                            columnNumber: 41
                                        }, this) : null
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/components/command-center/AnglesReadOnlyPanel.tsx",
                                    lineNumber: 106,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: toneClass(angle.tone),
                                        children: angle.status
                                    }, void 0, false, {
                                        fileName: "[project]/components/command-center/AnglesReadOnlyPanel.tsx",
                                        lineNumber: 117,
                                        columnNumber: 17
                                    }, this)
                                }, void 0, false, {
                                    fileName: "[project]/components/command-center/AnglesReadOnlyPanel.tsx",
                                    lineNumber: 116,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "next-angle-source",
                                    children: angle.sourceLink ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                                        href: angle.sourceLink,
                                        target: "_blank",
                                        rel: "noopener noreferrer",
                                        children: angle.sourceLabel
                                    }, void 0, false, {
                                        fileName: "[project]/components/command-center/AnglesReadOnlyPanel.tsx",
                                        lineNumber: 121,
                                        columnNumber: 19
                                    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                        onClick: ()=>openEditor(angle),
                                        type: "button",
                                        children: "Add source"
                                    }, void 0, false, {
                                        fileName: "[project]/components/command-center/AnglesReadOnlyPanel.tsx",
                                        lineNumber: 125,
                                        columnNumber: 19
                                    }, this)
                                }, void 0, false, {
                                    fileName: "[project]/components/command-center/AnglesReadOnlyPanel.tsx",
                                    lineNumber: 119,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "next-angle-stats",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            children: [
                                                formatNumber(angle.personas),
                                                " personas"
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/components/command-center/AnglesReadOnlyPanel.tsx",
                                            lineNumber: 131,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            children: [
                                                formatNumber(angle.creatives),
                                                " creatives"
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/components/command-center/AnglesReadOnlyPanel.tsx",
                                            lineNumber: 132,
                                            columnNumber: 17
                                        }, this),
                                        angle.creatives > 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            children: [
                                                angle.winRate,
                                                "% win"
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/components/command-center/AnglesReadOnlyPanel.tsx",
                                            lineNumber: 133,
                                            columnNumber: 40
                                        }, this) : null
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/components/command-center/AnglesReadOnlyPanel.tsx",
                                    lineNumber: 130,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "next-angle-notes",
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                        "aria-label": `Angle notes ${angle.index + 1}`,
                                        defaultValue: angle.notes,
                                        onBlur: (event)=>onUpdateAngleNotes(angle.index, event.currentTarget.value),
                                        onKeyDown: blurOnEnter,
                                        placeholder: "Add notes",
                                        type: "text"
                                    }, void 0, false, {
                                        fileName: "[project]/components/command-center/AnglesReadOnlyPanel.tsx",
                                        lineNumber: 136,
                                        columnNumber: 17
                                    }, this)
                                }, void 0, false, {
                                    fileName: "[project]/components/command-center/AnglesReadOnlyPanel.tsx",
                                    lineNumber: 135,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "next-angle-actions",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                            onClick: ()=>openEditor(angle),
                                            type: "button",
                                            children: "Edit"
                                        }, void 0, false, {
                                            fileName: "[project]/components/command-center/AnglesReadOnlyPanel.tsx",
                                            lineNumber: 146,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                            className: "danger",
                                            onClick: ()=>onDeleteAngle(angle.index),
                                            type: "button",
                                            children: "Delete"
                                        }, void 0, false, {
                                            fileName: "[project]/components/command-center/AnglesReadOnlyPanel.tsx",
                                            lineNumber: 149,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/components/command-center/AnglesReadOnlyPanel.tsx",
                                    lineNumber: 145,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, angle.id, true, {
                            fileName: "[project]/components/command-center/AnglesReadOnlyPanel.tsx",
                            lineNumber: 104,
                            columnNumber: 13
                        }, this))
                ]
            }, void 0, true, {
                fileName: "[project]/components/command-center/AnglesReadOnlyPanel.tsx",
                lineNumber: 90,
                columnNumber: 7
            }, this),
            editingAngle ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "next-modal-backdrop",
                role: "presentation",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("form", {
                    className: "next-edit-modal",
                    onSubmit: handleEditorSubmit,
                    "aria-label": "Edit angle",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                            children: "Edit Angle"
                        }, void 0, false, {
                            fileName: "[project]/components/command-center/AnglesReadOnlyPanel.tsx",
                            lineNumber: 160,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    children: "Angle Name"
                                }, void 0, false, {
                                    fileName: "[project]/components/command-center/AnglesReadOnlyPanel.tsx",
                                    lineNumber: 162,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                    name: "name",
                                    defaultValue: editingAngle.name,
                                    autoFocus: true
                                }, void 0, false, {
                                    fileName: "[project]/components/command-center/AnglesReadOnlyPanel.tsx",
                                    lineNumber: 163,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/components/command-center/AnglesReadOnlyPanel.tsx",
                            lineNumber: 161,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    children: "Source Link"
                                }, void 0, false, {
                                    fileName: "[project]/components/command-center/AnglesReadOnlyPanel.tsx",
                                    lineNumber: 166,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                    name: "sourceLink",
                                    defaultValue: editingAngle.sourceLink
                                }, void 0, false, {
                                    fileName: "[project]/components/command-center/AnglesReadOnlyPanel.tsx",
                                    lineNumber: 167,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/components/command-center/AnglesReadOnlyPanel.tsx",
                            lineNumber: 165,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    children: "Notes"
                                }, void 0, false, {
                                    fileName: "[project]/components/command-center/AnglesReadOnlyPanel.tsx",
                                    lineNumber: 170,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("textarea", {
                                    name: "notes",
                                    defaultValue: editingAngle.notes,
                                    rows: 3
                                }, void 0, false, {
                                    fileName: "[project]/components/command-center/AnglesReadOnlyPanel.tsx",
                                    lineNumber: 171,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/components/command-center/AnglesReadOnlyPanel.tsx",
                            lineNumber: 169,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "next-modal-actions",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    type: "button",
                                    onClick: ()=>setEditingAngle(null),
                                    children: "Cancel"
                                }, void 0, false, {
                                    fileName: "[project]/components/command-center/AnglesReadOnlyPanel.tsx",
                                    lineNumber: 174,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    className: "primary",
                                    type: "submit",
                                    children: "Save"
                                }, void 0, false, {
                                    fileName: "[project]/components/command-center/AnglesReadOnlyPanel.tsx",
                                    lineNumber: 177,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/components/command-center/AnglesReadOnlyPanel.tsx",
                            lineNumber: 173,
                            columnNumber: 13
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/components/command-center/AnglesReadOnlyPanel.tsx",
                    lineNumber: 159,
                    columnNumber: 11
                }, this)
            }, void 0, false, {
                fileName: "[project]/components/command-center/AnglesReadOnlyPanel.tsx",
                lineNumber: 158,
                columnNumber: 9
            }, this) : null
        ]
    }, void 0, true, {
        fileName: "[project]/components/command-center/AnglesReadOnlyPanel.tsx",
        lineNumber: 73,
        columnNumber: 5
    }, this);
}
_s(AnglesReadOnlyPanel, "W9coeEGzo5UfXou1VlUGAere+ck=");
_c = AnglesReadOnlyPanel;
var _c;
__turbopack_context__.k.register(_c, "AnglesReadOnlyPanel");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/components/command-center/CommandHqSummary.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "CommandHqSummary",
    ()=>CommandHqSummary
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$command$2d$center$2f$index$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/lib/command-center/index.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$command$2d$center$2f$metrics$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/command-center/metrics.ts [app-client] (ecmascript)");
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
    const metrics = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$command$2d$center$2f$metrics$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getCommandHqMetrics"])(state);
    const coverageCards = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$command$2d$center$2f$metrics$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getCommandHqCoverageCards"])(state);
    const gaps = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$command$2d$center$2f$metrics$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getCommandHqGaps"])(state);
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
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
        className: "next-hq-summary",
        "aria-label": "Command HQ summary",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "next-kpi-strip",
                children: items.map((item)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "next-kpi-item",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: item.tone ? `next-kpi-val ${item.tone}` : "next-kpi-val",
                                children: item.value
                            }, void 0, false, {
                                fileName: "[project]/components/command-center/CommandHqSummary.tsx",
                                lineNumber: 42,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
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
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "next-coverage-grid",
                "aria-label": "Coverage intelligence",
                children: coverageCards.map((card)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("article", {
                        className: "next-cov-card",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "next-cov-card-title",
                                children: card.title
                            }, void 0, false, {
                                fileName: "[project]/components/command-center/CommandHqSummary.tsx",
                                lineNumber: 50,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "next-cov-bar-wrap",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
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
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
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
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "next-cov-list",
                                children: card.items.map((item)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "next-cov-item",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: item.count > 0 ? "next-cov-dot active" : "next-cov-dot"
                                            }, void 0, false, {
                                                fileName: "[project]/components/command-center/CommandHqSummary.tsx",
                                                lineNumber: 60,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "next-cov-name",
                                                children: item.name
                                            }, void 0, false, {
                                                fileName: "[project]/components/command-center/CommandHqSummary.tsx",
                                                lineNumber: 61,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
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
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "next-gap-box",
                "aria-label": "Gap intelligence",
                children: gaps.length === 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "next-gap-ok",
                    children: "All gaps covered. Great work!"
                }, void 0, false, {
                    fileName: "[project]/components/command-center/CommandHqSummary.tsx",
                    lineNumber: 71,
                    columnNumber: 11
                }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                    className: "next-gap-list",
                    children: gaps.map((gap)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
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
_c = CommandHqSummary;
var _c;
__turbopack_context__.k.register(_c, "CommandHqSummary");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "CreativeTrackerReadOnlyPanel",
    ()=>CreativeTrackerReadOnlyPanel
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$command$2d$center$2f$index$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/lib/command-center/index.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$command$2d$center$2f$metrics$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/command-center/metrics.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
const statusOptions = [
    "Untested",
    "Approved",
    "In Production",
    "Ready to Launch",
    "Testing",
    "Mild Winner",
    "Winner",
    "Loser",
    "Scale",
    "Complete"
];
const adTypeOptions = [
    "Video",
    "Photo",
    "Carousel",
    "UGC",
    "VSL",
    "AI Style"
];
const funnelOptions = [
    "TOF",
    "MOF",
    "BOF"
];
function formatNumber(value) {
    return new Intl.NumberFormat("en-US").format(value);
}
function toneClass(tone) {
    return `next-status-badge ${tone}`;
}
function buildOptions(values, currentValue) {
    return Array.from(new Set([
        ...values,
        currentValue
    ].filter(Boolean))).sort();
}
function valuesFromCreative(creative) {
    return {
        adLink: creative?.adLink || "",
        adType: creative?.adType || "Video",
        angle: creative?.angle || "",
        creativeHypothesis: creative?.creativeHypothesis || "",
        creativeStructure: creative?.creativeStructure || creative?.structure || "",
        driveLink: creative?.driveLink || "",
        formatName: creative?.formatName || creative?.name || "",
        funnelStage: creative?.funnelStage || "TOF",
        hookType: creative?.hookType || "",
        persona: creative?.persona || "",
        productionStyle: creative?.productionStyle || "",
        status: creative?.status || "Untested"
    };
}
function valuesFromForm(form) {
    const formData = new FormData(form);
    return {
        adLink: String(formData.get("adLink") || ""),
        adType: String(formData.get("adType") || ""),
        angle: String(formData.get("angle") || ""),
        creativeHypothesis: String(formData.get("creativeHypothesis") || ""),
        creativeStructure: String(formData.get("creativeStructure") || ""),
        driveLink: String(formData.get("driveLink") || ""),
        formatName: String(formData.get("formatName") || ""),
        funnelStage: String(formData.get("funnelStage") || ""),
        hookType: String(formData.get("hookType") || ""),
        persona: String(formData.get("persona") || ""),
        productionStyle: String(formData.get("productionStyle") || ""),
        status: String(formData.get("status") || "")
    };
}
function CreativeTrackerReadOnlyPanel({ onCreateCreative, onDeleteCreative, onSaveCreative, onUpdateCreativeField, onUpdateCreativeStatus, state }) {
    _s();
    const [angle, setAngle] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [funnel, setFunnel] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [kind, setKind] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [persona, setPersona] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [query, setQuery] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [status, setStatus] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [modal, setModal] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const summary = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$command$2d$center$2f$metrics$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getCreativeTrackerSummary"])(state);
    const angles = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "CreativeTrackerReadOnlyPanel.useMemo[angles]": ()=>Array.from(new Set(summary.rows.map({
                "CreativeTrackerReadOnlyPanel.useMemo[angles]": (row)=>row.angle
            }["CreativeTrackerReadOnlyPanel.useMemo[angles]"]).filter(Boolean))).sort()
    }["CreativeTrackerReadOnlyPanel.useMemo[angles]"], [
        summary.rows
    ]);
    const personas = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "CreativeTrackerReadOnlyPanel.useMemo[personas]": ()=>Array.from(new Set(summary.rows.map({
                "CreativeTrackerReadOnlyPanel.useMemo[personas]": (row)=>row.persona
            }["CreativeTrackerReadOnlyPanel.useMemo[personas]"]).filter(Boolean))).sort()
    }["CreativeTrackerReadOnlyPanel.useMemo[personas]"], [
        summary.rows
    ]);
    const statuses = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "CreativeTrackerReadOnlyPanel.useMemo[statuses]": ()=>Array.from(new Set(summary.rows.map({
                "CreativeTrackerReadOnlyPanel.useMemo[statuses]": (row)=>row.status
            }["CreativeTrackerReadOnlyPanel.useMemo[statuses]"]).filter(Boolean))).sort()
    }["CreativeTrackerReadOnlyPanel.useMemo[statuses]"], [
        summary.rows
    ]);
    const structures = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "CreativeTrackerReadOnlyPanel.useMemo[structures]": ()=>(state.fieldOptions.creativeStructure || []).map({
                "CreativeTrackerReadOnlyPanel.useMemo[structures]": (option)=>option.name
            }["CreativeTrackerReadOnlyPanel.useMemo[structures]"])
    }["CreativeTrackerReadOnlyPanel.useMemo[structures]"], [
        state.fieldOptions.creativeStructure
    ]);
    const hooks = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "CreativeTrackerReadOnlyPanel.useMemo[hooks]": ()=>(state.fieldOptions.hookType || []).map({
                "CreativeTrackerReadOnlyPanel.useMemo[hooks]": (option)=>option.name
            }["CreativeTrackerReadOnlyPanel.useMemo[hooks]"])
    }["CreativeTrackerReadOnlyPanel.useMemo[hooks]"], [
        state.fieldOptions.hookType
    ]);
    const productionStyles = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "CreativeTrackerReadOnlyPanel.useMemo[productionStyles]": ()=>(state.fieldOptions.productionStyle || []).map({
                "CreativeTrackerReadOnlyPanel.useMemo[productionStyles]": (option)=>option.name
            }["CreativeTrackerReadOnlyPanel.useMemo[productionStyles]"])
    }["CreativeTrackerReadOnlyPanel.useMemo[productionStyles]"], [
        state.fieldOptions.productionStyle
    ]);
    const filteredRows = summary.rows.filter((row)=>{
        const text = [
            row.formatName,
            row.id,
            row.angle,
            row.persona,
            row.creativeStructure,
            row.hookType,
            row.productionStyle,
            row.creativeHypothesis,
            row.adType,
            row.funnelStage,
            row.status
        ].join(" ").toLowerCase();
        if (query.trim() && !text.includes(query.trim().toLowerCase())) return false;
        if (kind && row.kind !== kind) return false;
        if (status && row.status !== status) return false;
        if (funnel && row.funnelStage !== funnel) return false;
        if (angle && row.angle !== angle) return false;
        if (persona && row.persona !== persona) return false;
        return true;
    });
    const summaryItems = [
        [
            "Total",
            summary.total
        ],
        [
            "Formats",
            summary.formats
        ],
        [
            "Production",
            summary.production
        ],
        [
            "Variations",
            summary.variations
        ],
        [
            "Winners",
            summary.winners
        ],
        [
            "Testing",
            summary.testing
        ]
    ];
    const openAddModal = ()=>{
        setModal({
            mode: "add",
            values: valuesFromCreative({
                adType: "Video",
                angle: angles[0] || "",
                funnelStage: "TOF",
                persona: personas[0] || "",
                status: "Untested"
            })
        });
    };
    const openEditModal = (id)=>{
        const creative = state.creatives.find((item)=>item.id === id);
        if (!creative) return;
        setModal({
            creativeId: id,
            mode: "edit",
            values: valuesFromCreative(creative)
        });
    };
    const handleModalSubmit = (event)=>{
        event.preventDefault();
        if (!modal) return;
        const values = valuesFromForm(event.currentTarget);
        if (modal.mode === "add") {
            onCreateCreative(values);
        } else {
            onSaveCreative(modal.creativeId, values);
        }
        setModal(null);
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
        className: "next-creative-panel",
        "aria-label": "Creative Tracker",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "next-panel-head",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                            children: "Creative Tracker"
                        }, void 0, false, {
                            fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                            lineNumber: 183,
                            columnNumber: 11
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                        lineNumber: 182,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        className: "next-panel-action",
                        onClick: openAddModal,
                        type: "button",
                        children: "Add Creative"
                    }, void 0, false, {
                        fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                        lineNumber: 185,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                lineNumber: 181,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "next-tracker-summary",
                children: [
                    summaryItems.map(([label, value])=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "next-tracker-summary-stat",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    children: label
                                }, void 0, false, {
                                    fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                    lineNumber: 192,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("strong", {
                                    children: formatNumber(Number(value))
                                }, void 0, false, {
                                    fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                    lineNumber: 193,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, label, true, {
                            fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                            lineNumber: 191,
                            columnNumber: 11
                        }, this)),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "next-tracker-summary-stat active",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                children: "Showing"
                            }, void 0, false, {
                                fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                lineNumber: 197,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("strong", {
                                children: formatNumber(filteredRows.length)
                            }, void 0, false, {
                                fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                lineNumber: 198,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                        lineNumber: 196,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                lineNumber: 189,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "next-creative-filters",
                "aria-label": "Creative Tracker filters",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                        "aria-label": "Search creatives",
                        onChange: (event)=>setQuery(event.target.value),
                        placeholder: "Search creatives",
                        type: "search",
                        value: query
                    }, void 0, false, {
                        fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                        lineNumber: 202,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                        "aria-label": "Kind",
                        onChange: (event)=>setKind(event.target.value),
                        value: kind,
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                value: "",
                                children: "All Types"
                            }, void 0, false, {
                                fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                lineNumber: 210,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                value: "format",
                                children: "Formats"
                            }, void 0, false, {
                                fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                lineNumber: 211,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                value: "production",
                                children: "Production"
                            }, void 0, false, {
                                fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                lineNumber: 212,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                value: "variation",
                                children: "Variations"
                            }, void 0, false, {
                                fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                lineNumber: 213,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                        lineNumber: 209,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                        "aria-label": "Status",
                        onChange: (event)=>setStatus(event.target.value),
                        value: status,
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                value: "",
                                children: "All Statuses"
                            }, void 0, false, {
                                fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                lineNumber: 216,
                                columnNumber: 11
                            }, this),
                            statuses.map((item)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                    value: item,
                                    children: item
                                }, item, false, {
                                    fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                    lineNumber: 218,
                                    columnNumber: 13
                                }, this))
                        ]
                    }, void 0, true, {
                        fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                        lineNumber: 215,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                        "aria-label": "Funnel",
                        onChange: (event)=>setFunnel(event.target.value),
                        value: funnel,
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                value: "",
                                children: "All Funnels"
                            }, void 0, false, {
                                fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                lineNumber: 224,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                value: "TOF",
                                children: "TOF"
                            }, void 0, false, {
                                fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                lineNumber: 225,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                value: "MOF",
                                children: "MOF"
                            }, void 0, false, {
                                fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                lineNumber: 226,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                value: "BOF",
                                children: "BOF"
                            }, void 0, false, {
                                fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                lineNumber: 227,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                        lineNumber: 223,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                        "aria-label": "Angle",
                        onChange: (event)=>setAngle(event.target.value),
                        value: angle,
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                value: "",
                                children: "All Angles"
                            }, void 0, false, {
                                fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                lineNumber: 230,
                                columnNumber: 11
                            }, this),
                            angles.map((item)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                    value: item,
                                    children: item
                                }, item, false, {
                                    fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                    lineNumber: 232,
                                    columnNumber: 13
                                }, this))
                        ]
                    }, void 0, true, {
                        fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                        lineNumber: 229,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                        "aria-label": "Persona",
                        onChange: (event)=>setPersona(event.target.value),
                        value: persona,
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                value: "",
                                children: "All Personas"
                            }, void 0, false, {
                                fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                lineNumber: 238,
                                columnNumber: 11
                            }, this),
                            personas.map((item)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                    value: item,
                                    children: item
                                }, item, false, {
                                    fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                    lineNumber: 240,
                                    columnNumber: 13
                                }, this))
                        ]
                    }, void 0, true, {
                        fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                        lineNumber: 237,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        onClick: ()=>{
                            setAngle("");
                            setFunnel("");
                            setKind("");
                            setPersona("");
                            setQuery("");
                            setStatus("");
                        },
                        type: "button",
                        children: "Clear"
                    }, void 0, false, {
                        fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                        lineNumber: 245,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                lineNumber: 201,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "next-creative-table",
                role: "table",
                "aria-label": "Creative Tracker",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "next-creative-header",
                        role: "row",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                children: "Format"
                            }, void 0, false, {
                                fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                lineNumber: 261,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                children: "Angle"
                            }, void 0, false, {
                                fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                lineNumber: 262,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                children: "Persona"
                            }, void 0, false, {
                                fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                lineNumber: 263,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                children: "Structure"
                            }, void 0, false, {
                                fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                lineNumber: 264,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                children: "Hook"
                            }, void 0, false, {
                                fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                lineNumber: 265,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                children: "Production"
                            }, void 0, false, {
                                fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                lineNumber: 266,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                children: "Hypothesis"
                            }, void 0, false, {
                                fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                lineNumber: 267,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                children: "Links"
                            }, void 0, false, {
                                fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                lineNumber: 268,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                children: "Type"
                            }, void 0, false, {
                                fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                lineNumber: 269,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                children: "Funnel"
                            }, void 0, false, {
                                fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                lineNumber: 270,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                children: "Status"
                            }, void 0, false, {
                                fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                lineNumber: 271,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                children: "Created"
                            }, void 0, false, {
                                fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                lineNumber: 272,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                children: "Vars"
                            }, void 0, false, {
                                fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                lineNumber: 273,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                children: "Actions"
                            }, void 0, false, {
                                fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                lineNumber: 274,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                        lineNumber: 260,
                        columnNumber: 9
                    }, this),
                    filteredRows.length === 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "next-empty-state",
                        children: "No creatives match your filters"
                    }, void 0, false, {
                        fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                        lineNumber: 277,
                        columnNumber: 11
                    }, this) : filteredRows.map((creative)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: `next-creative-row kind-${creative.kind}`,
                            role: "row",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "next-creative-name",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("strong", {
                                            children: creative.formatName
                                        }, void 0, false, {
                                            fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                            lineNumber: 282,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            children: creative.id
                                        }, void 0, false, {
                                            fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                            lineNumber: 283,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                    lineNumber: 281,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                                        "aria-label": `Angle for ${creative.id}`,
                                        onChange: (event)=>onUpdateCreativeField(creative.id, "angle", event.target.value),
                                        value: creative.angle,
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                value: "",
                                                children: "-"
                                            }, void 0, false, {
                                                fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                                lineNumber: 291,
                                                columnNumber: 19
                                            }, this),
                                            buildOptions(angles, creative.angle).map((item)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                    value: item,
                                                    children: item
                                                }, item, false, {
                                                    fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                                    lineNumber: 293,
                                                    columnNumber: 21
                                                }, this))
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                        lineNumber: 286,
                                        columnNumber: 17
                                    }, this)
                                }, void 0, false, {
                                    fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                    lineNumber: 285,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                                        "aria-label": `Persona for ${creative.id}`,
                                        onChange: (event)=>onUpdateCreativeField(creative.id, "persona", event.target.value),
                                        value: creative.persona,
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                value: "",
                                                children: "-"
                                            }, void 0, false, {
                                                fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                                lineNumber: 305,
                                                columnNumber: 19
                                            }, this),
                                            buildOptions(personas, creative.persona).map((item)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                    value: item,
                                                    children: item
                                                }, item, false, {
                                                    fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                                    lineNumber: 307,
                                                    columnNumber: 21
                                                }, this))
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                        lineNumber: 300,
                                        columnNumber: 17
                                    }, this)
                                }, void 0, false, {
                                    fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                    lineNumber: 299,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                                        "aria-label": `Structure for ${creative.id}`,
                                        onChange: (event)=>onUpdateCreativeField(creative.id, "creativeStructure", event.target.value),
                                        value: creative.creativeStructure,
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                value: "",
                                                children: "-"
                                            }, void 0, false, {
                                                fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                                lineNumber: 319,
                                                columnNumber: 19
                                            }, this),
                                            buildOptions(structures, creative.creativeStructure).map((item)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                    value: item,
                                                    children: item
                                                }, item, false, {
                                                    fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                                    lineNumber: 321,
                                                    columnNumber: 21
                                                }, this))
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                        lineNumber: 314,
                                        columnNumber: 17
                                    }, this)
                                }, void 0, false, {
                                    fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                    lineNumber: 313,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                                        "aria-label": `Hook for ${creative.id}`,
                                        onChange: (event)=>onUpdateCreativeField(creative.id, "hookType", event.target.value),
                                        value: creative.hookType,
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                value: "",
                                                children: "-"
                                            }, void 0, false, {
                                                fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                                lineNumber: 333,
                                                columnNumber: 19
                                            }, this),
                                            buildOptions(hooks, creative.hookType).map((item)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                    value: item,
                                                    children: item
                                                }, item, false, {
                                                    fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                                    lineNumber: 335,
                                                    columnNumber: 21
                                                }, this))
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                        lineNumber: 328,
                                        columnNumber: 17
                                    }, this)
                                }, void 0, false, {
                                    fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                    lineNumber: 327,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                                        "aria-label": `Production style for ${creative.id}`,
                                        onChange: (event)=>onUpdateCreativeField(creative.id, "productionStyle", event.target.value),
                                        value: creative.productionStyle,
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                value: "",
                                                children: "-"
                                            }, void 0, false, {
                                                fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                                lineNumber: 347,
                                                columnNumber: 19
                                            }, this),
                                            buildOptions(productionStyles, creative.productionStyle).map((item)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                    value: item,
                                                    children: item
                                                }, item, false, {
                                                    fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                                    lineNumber: 349,
                                                    columnNumber: 21
                                                }, this))
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                        lineNumber: 342,
                                        columnNumber: 17
                                    }, this)
                                }, void 0, false, {
                                    fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                    lineNumber: 341,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "next-creative-hypothesis",
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("textarea", {
                                        "aria-label": `Hypothesis for ${creative.id}`,
                                        defaultValue: creative.creativeHypothesis,
                                        onBlur: (event)=>{
                                            if (event.target.value !== creative.creativeHypothesis) {
                                                onUpdateCreativeField(creative.id, "creativeHypothesis", event.target.value);
                                            }
                                        },
                                        rows: 2
                                    }, `${creative.id}-${creative.creativeHypothesis}`, false, {
                                        fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                        lineNumber: 356,
                                        columnNumber: 17
                                    }, this)
                                }, void 0, false, {
                                    fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                    lineNumber: 355,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "next-creative-links",
                                    children: [
                                        creative.adLink ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                                            href: creative.adLink,
                                            target: "_blank",
                                            rel: "noopener noreferrer",
                                            children: "Inspiration"
                                        }, void 0, false, {
                                            fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                            lineNumber: 370,
                                            columnNumber: 19
                                        }, this) : null,
                                        creative.driveLink ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                                            href: creative.driveLink,
                                            target: "_blank",
                                            rel: "noopener noreferrer",
                                            children: "Drive"
                                        }, void 0, false, {
                                            fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                            lineNumber: 375,
                                            columnNumber: 19
                                        }, this) : null,
                                        !creative.adLink && !creative.driveLink ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            children: "-"
                                        }, void 0, false, {
                                            fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                            lineNumber: 379,
                                            columnNumber: 60
                                        }, this) : null
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                    lineNumber: 368,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                                        "aria-label": `Ad type for ${creative.id}`,
                                        onChange: (event)=>onUpdateCreativeField(creative.id, "adType", event.target.value),
                                        value: creative.adType,
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                value: "",
                                                children: "-"
                                            }, void 0, false, {
                                                fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                                lineNumber: 387,
                                                columnNumber: 19
                                            }, this),
                                            buildOptions(adTypeOptions, creative.adType).map((item)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                    value: item,
                                                    children: item
                                                }, item, false, {
                                                    fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                                    lineNumber: 389,
                                                    columnNumber: 21
                                                }, this))
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                        lineNumber: 382,
                                        columnNumber: 17
                                    }, this)
                                }, void 0, false, {
                                    fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                    lineNumber: 381,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    children: creative.funnelStage || "-"
                                }, void 0, false, {
                                    fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                    lineNumber: 395,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                                        "aria-label": `Status for ${creative.id}`,
                                        className: toneClass(creative.tone),
                                        onChange: (event)=>onUpdateCreativeStatus(creative.id, event.target.value),
                                        value: creative.status,
                                        children: buildOptions(statusOptions, creative.status).map((item)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                value: item,
                                                children: item
                                            }, item, false, {
                                                fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                                lineNumber: 404,
                                                columnNumber: 21
                                            }, this))
                                    }, void 0, false, {
                                        fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                        lineNumber: 397,
                                        columnNumber: 17
                                    }, this)
                                }, void 0, false, {
                                    fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                    lineNumber: 396,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "next-creative-muted",
                                    children: creative.dateCreated || "-"
                                }, void 0, false, {
                                    fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                    lineNumber: 410,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "next-creative-muted",
                                    children: formatNumber(creative.variationCount)
                                }, void 0, false, {
                                    fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                    lineNumber: 411,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "next-creative-actions",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                            onClick: ()=>openEditModal(creative.id),
                                            type: "button",
                                            children: "Edit"
                                        }, void 0, false, {
                                            fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                            lineNumber: 413,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                            className: "danger",
                                            onClick: ()=>{
                                                const ok = window.confirm(`Delete creative ${creative.id}? This cannot be undone.`);
                                                if (ok) onDeleteCreative(creative.id);
                                            },
                                            type: "button",
                                            children: "Delete"
                                        }, void 0, false, {
                                            fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                            lineNumber: 416,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                    lineNumber: 412,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, creative.id, true, {
                            fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                            lineNumber: 280,
                            columnNumber: 13
                        }, this))
                ]
            }, void 0, true, {
                fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                lineNumber: 259,
                columnNumber: 7
            }, this),
            modal ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "next-modal-backdrop",
                role: "presentation",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("form", {
                    className: "next-creative-modal",
                    onSubmit: handleModalSubmit,
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "next-modal-head",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                        children: modal.mode === "add" ? "Add Creative" : `Edit Creative ${modal.creativeId}`
                                    }, void 0, false, {
                                        fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                        lineNumber: 436,
                                        columnNumber: 17
                                    }, this)
                                }, void 0, false, {
                                    fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                    lineNumber: 435,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    "aria-label": "Close creative dialog",
                                    onClick: ()=>setModal(null),
                                    type: "button",
                                    children: "x"
                                }, void 0, false, {
                                    fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                    lineNumber: 438,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                            lineNumber: 434,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "next-creative-modal-grid",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            children: "Format Name"
                                        }, void 0, false, {
                                            fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                            lineNumber: 444,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                            autoFocus: true,
                                            defaultValue: modal.values.formatName,
                                            name: "formatName",
                                            placeholder: "Creative title"
                                        }, void 0, false, {
                                            fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                            lineNumber: 445,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                    lineNumber: 443,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            children: "Status"
                                        }, void 0, false, {
                                            fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                            lineNumber: 448,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                                            defaultValue: modal.values.status,
                                            name: "status",
                                            children: buildOptions(statusOptions, modal.values.status).map((item)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                    value: item,
                                                    children: item
                                                }, item, false, {
                                                    fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                                    lineNumber: 451,
                                                    columnNumber: 21
                                                }, this))
                                        }, void 0, false, {
                                            fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                            lineNumber: 449,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                    lineNumber: 447,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            children: "Angle"
                                        }, void 0, false, {
                                            fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                            lineNumber: 458,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                                            defaultValue: modal.values.angle,
                                            name: "angle",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                    value: "",
                                                    children: "-"
                                                }, void 0, false, {
                                                    fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                                    lineNumber: 460,
                                                    columnNumber: 19
                                                }, this),
                                                buildOptions(angles, modal.values.angle).map((item)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                        value: item,
                                                        children: item
                                                    }, item, false, {
                                                        fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                                        lineNumber: 462,
                                                        columnNumber: 21
                                                    }, this))
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                            lineNumber: 459,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                    lineNumber: 457,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            children: "Persona"
                                        }, void 0, false, {
                                            fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                            lineNumber: 469,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                                            defaultValue: modal.values.persona,
                                            name: "persona",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                    value: "",
                                                    children: "-"
                                                }, void 0, false, {
                                                    fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                                    lineNumber: 471,
                                                    columnNumber: 19
                                                }, this),
                                                buildOptions(personas, modal.values.persona).map((item)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                        value: item,
                                                        children: item
                                                    }, item, false, {
                                                        fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                                        lineNumber: 473,
                                                        columnNumber: 21
                                                    }, this))
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                            lineNumber: 470,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                    lineNumber: 468,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            children: "Ad Type"
                                        }, void 0, false, {
                                            fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                            lineNumber: 480,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                                            defaultValue: modal.values.adType,
                                            name: "adType",
                                            children: buildOptions(adTypeOptions, modal.values.adType).map((item)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                    value: item,
                                                    children: item
                                                }, item, false, {
                                                    fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                                    lineNumber: 483,
                                                    columnNumber: 21
                                                }, this))
                                        }, void 0, false, {
                                            fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                            lineNumber: 481,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                    lineNumber: 479,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            children: "Funnel"
                                        }, void 0, false, {
                                            fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                            lineNumber: 490,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                                            defaultValue: modal.values.funnelStage,
                                            name: "funnelStage",
                                            children: buildOptions(funnelOptions, modal.values.funnelStage).map((item)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                    value: item,
                                                    children: item
                                                }, item, false, {
                                                    fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                                    lineNumber: 493,
                                                    columnNumber: 21
                                                }, this))
                                        }, void 0, false, {
                                            fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                            lineNumber: 491,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                    lineNumber: 489,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            children: "Structure"
                                        }, void 0, false, {
                                            fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                            lineNumber: 500,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                                            defaultValue: modal.values.creativeStructure,
                                            name: "creativeStructure",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                    value: "",
                                                    children: "-"
                                                }, void 0, false, {
                                                    fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                                    lineNumber: 502,
                                                    columnNumber: 19
                                                }, this),
                                                buildOptions(structures, modal.values.creativeStructure).map((item)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                        value: item,
                                                        children: item
                                                    }, item, false, {
                                                        fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                                        lineNumber: 504,
                                                        columnNumber: 21
                                                    }, this))
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                            lineNumber: 501,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                    lineNumber: 499,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            children: "Hook"
                                        }, void 0, false, {
                                            fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                            lineNumber: 511,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                                            defaultValue: modal.values.hookType,
                                            name: "hookType",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                    value: "",
                                                    children: "-"
                                                }, void 0, false, {
                                                    fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                                    lineNumber: 513,
                                                    columnNumber: 19
                                                }, this),
                                                buildOptions(hooks, modal.values.hookType).map((item)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                        value: item,
                                                        children: item
                                                    }, item, false, {
                                                        fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                                        lineNumber: 515,
                                                        columnNumber: 21
                                                    }, this))
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                            lineNumber: 512,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                    lineNumber: 510,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            children: "Production Style"
                                        }, void 0, false, {
                                            fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                            lineNumber: 522,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                                            defaultValue: modal.values.productionStyle,
                                            name: "productionStyle",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                    value: "",
                                                    children: "-"
                                                }, void 0, false, {
                                                    fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                                    lineNumber: 524,
                                                    columnNumber: 19
                                                }, this),
                                                buildOptions(productionStyles, modal.values.productionStyle).map((item)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                        value: item,
                                                        children: item
                                                    }, item, false, {
                                                        fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                                        lineNumber: 526,
                                                        columnNumber: 21
                                                    }, this))
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                            lineNumber: 523,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                    lineNumber: 521,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            children: "Inspiration Link"
                                        }, void 0, false, {
                                            fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                            lineNumber: 533,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                            defaultValue: modal.values.adLink,
                                            name: "adLink",
                                            placeholder: "https://..."
                                        }, void 0, false, {
                                            fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                            lineNumber: 534,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                    lineNumber: 532,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            children: "Drive Link"
                                        }, void 0, false, {
                                            fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                            lineNumber: 537,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                            defaultValue: modal.values.driveLink,
                                            name: "driveLink",
                                            placeholder: "https://drive.google.com/..."
                                        }, void 0, false, {
                                            fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                            lineNumber: 538,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                    lineNumber: 536,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                    className: "wide",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            children: "Hypothesis"
                                        }, void 0, false, {
                                            fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                            lineNumber: 541,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("textarea", {
                                            defaultValue: modal.values.creativeHypothesis,
                                            name: "creativeHypothesis",
                                            rows: 3
                                        }, void 0, false, {
                                            fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                            lineNumber: 542,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                    lineNumber: 540,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                            lineNumber: 442,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "next-modal-actions",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    onClick: ()=>setModal(null),
                                    type: "button",
                                    children: "Cancel"
                                }, void 0, false, {
                                    fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                    lineNumber: 546,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    className: "primary",
                                    type: "submit",
                                    children: modal.mode === "add" ? "Save Creative" : "Save Changes"
                                }, void 0, false, {
                                    fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                                    lineNumber: 549,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                            lineNumber: 545,
                            columnNumber: 13
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                    lineNumber: 433,
                    columnNumber: 11
                }, this)
            }, void 0, false, {
                fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
                lineNumber: 432,
                columnNumber: 9
            }, this) : null
        ]
    }, void 0, true, {
        fileName: "[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx",
        lineNumber: 180,
        columnNumber: 5
    }, this);
}
_s(CreativeTrackerReadOnlyPanel, "+I9cP9O1z4VxQJrQwxJwyidXuYE=");
_c = CreativeTrackerReadOnlyPanel;
var _c;
__turbopack_context__.k.register(_c, "CreativeTrackerReadOnlyPanel");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/components/command-center/LegacyDashboardFrame.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "LegacyDashboardFrame",
    ()=>LegacyDashboardFrame
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
;
;
const LegacyDashboardFrame = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["forwardRef"])(_c = function LegacyDashboardFrame({ compact = false, onLoad }, ref) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("iframe", {
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
_c1 = LegacyDashboardFrame;
var _c, _c1;
__turbopack_context__.k.register(_c, "LegacyDashboardFrame$forwardRef");
__turbopack_context__.k.register(_c1, "LegacyDashboardFrame");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/components/command-center/PersonasReadOnlyPanel.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "PersonasReadOnlyPanel",
    ()=>PersonasReadOnlyPanel
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$command$2d$center$2f$index$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/lib/command-center/index.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$command$2d$center$2f$metrics$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/command-center/metrics.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
function formatNumber(value) {
    return new Intl.NumberFormat("en-US").format(value);
}
function toneClass(tone) {
    return `next-status-badge ${tone}`;
}
function blurOnEnter(event) {
    if (event.key === "Enter") {
        event.currentTarget.blur();
    }
}
function PersonasReadOnlyPanel({ onAddPersona, onDeletePersona, onSavePersonaFields, onUpdatePersonaName, onUpdatePersonaNotes, state }) {
    _s();
    const [editingPersona, setEditingPersona] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const summary = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$command$2d$center$2f$metrics$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getPersonasSummary"])(state);
    const summaryItems = [
        [
            "Total Personas",
            summary.totalPersonas
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
    function openEditor(persona) {
        setEditingPersona(persona);
    }
    function handleEditorSubmit(event) {
        event.preventDefault();
        if (!editingPersona) return;
        const form = new FormData(event.currentTarget);
        onSavePersonaFields(editingPersona.index, {
            name: String(form.get("name") || editingPersona.name),
            notes: String(form.get("notes") || ""),
            sourceLink: String(form.get("sourceLink") || "")
        });
        setEditingPersona(null);
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
        className: "next-angles-panel",
        "aria-label": "Personas read-only summary",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "next-panel-head",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                            children: "Persona Tracker"
                        }, void 0, false, {
                            fileName: "[project]/components/command-center/PersonasReadOnlyPanel.tsx",
                            lineNumber: 76,
                            columnNumber: 11
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/components/command-center/PersonasReadOnlyPanel.tsx",
                        lineNumber: 75,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        className: "next-panel-action",
                        onClick: onAddPersona,
                        type: "button",
                        children: "Add Persona"
                    }, void 0, false, {
                        fileName: "[project]/components/command-center/PersonasReadOnlyPanel.tsx",
                        lineNumber: 78,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/components/command-center/PersonasReadOnlyPanel.tsx",
                lineNumber: 74,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "next-tracker-summary",
                children: summaryItems.map(([label, value])=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "next-tracker-summary-stat",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                children: label
                            }, void 0, false, {
                                fileName: "[project]/components/command-center/PersonasReadOnlyPanel.tsx",
                                lineNumber: 85,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("strong", {
                                children: formatNumber(Number(value))
                            }, void 0, false, {
                                fileName: "[project]/components/command-center/PersonasReadOnlyPanel.tsx",
                                lineNumber: 86,
                                columnNumber: 13
                            }, this)
                        ]
                    }, label, true, {
                        fileName: "[project]/components/command-center/PersonasReadOnlyPanel.tsx",
                        lineNumber: 84,
                        columnNumber: 11
                    }, this))
            }, void 0, false, {
                fileName: "[project]/components/command-center/PersonasReadOnlyPanel.tsx",
                lineNumber: 82,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "next-angle-grid with-actions",
                role: "table",
                "aria-label": "Personas",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "next-angle-header",
                        role: "row",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                children: "#"
                            }, void 0, false, {
                                fileName: "[project]/components/command-center/PersonasReadOnlyPanel.tsx",
                                lineNumber: 92,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                children: "Persona Name"
                            }, void 0, false, {
                                fileName: "[project]/components/command-center/PersonasReadOnlyPanel.tsx",
                                lineNumber: 93,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                children: "Status"
                            }, void 0, false, {
                                fileName: "[project]/components/command-center/PersonasReadOnlyPanel.tsx",
                                lineNumber: 94,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                children: "Source Link"
                            }, void 0, false, {
                                fileName: "[project]/components/command-center/PersonasReadOnlyPanel.tsx",
                                lineNumber: 95,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                children: "Stats"
                            }, void 0, false, {
                                fileName: "[project]/components/command-center/PersonasReadOnlyPanel.tsx",
                                lineNumber: 96,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                children: "Notes"
                            }, void 0, false, {
                                fileName: "[project]/components/command-center/PersonasReadOnlyPanel.tsx",
                                lineNumber: 97,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                children: "Actions"
                            }, void 0, false, {
                                fileName: "[project]/components/command-center/PersonasReadOnlyPanel.tsx",
                                lineNumber: 98,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/components/command-center/PersonasReadOnlyPanel.tsx",
                        lineNumber: 91,
                        columnNumber: 9
                    }, this),
                    summary.personas.length === 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "next-empty-state",
                        children: "No personas yet"
                    }, void 0, false, {
                        fileName: "[project]/components/command-center/PersonasReadOnlyPanel.tsx",
                        lineNumber: 101,
                        columnNumber: 11
                    }, this) : summary.personas.map((persona)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: `next-angle-row status-${persona.tone}`,
                            role: "row",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "next-angle-num",
                                    children: persona.index + 1
                                }, void 0, false, {
                                    fileName: "[project]/components/command-center/PersonasReadOnlyPanel.tsx",
                                    lineNumber: 105,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "next-angle-name",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                            "aria-label": `Persona name ${persona.index + 1}`,
                                            defaultValue: persona.name,
                                            onBlur: (event)=>onUpdatePersonaName(persona.index, event.currentTarget.value),
                                            onKeyDown: blurOnEnter,
                                            type: "text"
                                        }, void 0, false, {
                                            fileName: "[project]/components/command-center/PersonasReadOnlyPanel.tsx",
                                            lineNumber: 107,
                                            columnNumber: 17
                                        }, this),
                                        persona.tone === "win" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "next-win-badge",
                                            children: "Winner"
                                        }, void 0, false, {
                                            fileName: "[project]/components/command-center/PersonasReadOnlyPanel.tsx",
                                            lineNumber: 114,
                                            columnNumber: 43
                                        }, this) : null
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/components/command-center/PersonasReadOnlyPanel.tsx",
                                    lineNumber: 106,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: toneClass(persona.tone),
                                        children: persona.status
                                    }, void 0, false, {
                                        fileName: "[project]/components/command-center/PersonasReadOnlyPanel.tsx",
                                        lineNumber: 117,
                                        columnNumber: 17
                                    }, this)
                                }, void 0, false, {
                                    fileName: "[project]/components/command-center/PersonasReadOnlyPanel.tsx",
                                    lineNumber: 116,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "next-angle-source",
                                    children: persona.sourceLink ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                                        href: persona.sourceLink,
                                        target: "_blank",
                                        rel: "noopener noreferrer",
                                        children: persona.sourceLabel
                                    }, void 0, false, {
                                        fileName: "[project]/components/command-center/PersonasReadOnlyPanel.tsx",
                                        lineNumber: 121,
                                        columnNumber: 19
                                    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                        onClick: ()=>openEditor(persona),
                                        type: "button",
                                        children: "Add source"
                                    }, void 0, false, {
                                        fileName: "[project]/components/command-center/PersonasReadOnlyPanel.tsx",
                                        lineNumber: 125,
                                        columnNumber: 19
                                    }, this)
                                }, void 0, false, {
                                    fileName: "[project]/components/command-center/PersonasReadOnlyPanel.tsx",
                                    lineNumber: 119,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "next-angle-stats",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            children: [
                                                formatNumber(persona.angles),
                                                " angles"
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/components/command-center/PersonasReadOnlyPanel.tsx",
                                            lineNumber: 131,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            children: [
                                                formatNumber(persona.creatives),
                                                " creatives"
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/components/command-center/PersonasReadOnlyPanel.tsx",
                                            lineNumber: 132,
                                            columnNumber: 17
                                        }, this),
                                        persona.creatives > 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            children: [
                                                persona.winRate,
                                                "% win"
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/components/command-center/PersonasReadOnlyPanel.tsx",
                                            lineNumber: 133,
                                            columnNumber: 42
                                        }, this) : null
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/components/command-center/PersonasReadOnlyPanel.tsx",
                                    lineNumber: 130,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "next-angle-notes",
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                        "aria-label": `Persona notes ${persona.index + 1}`,
                                        defaultValue: persona.notes,
                                        onBlur: (event)=>onUpdatePersonaNotes(persona.index, event.currentTarget.value),
                                        onKeyDown: blurOnEnter,
                                        placeholder: "Add notes",
                                        type: "text"
                                    }, void 0, false, {
                                        fileName: "[project]/components/command-center/PersonasReadOnlyPanel.tsx",
                                        lineNumber: 136,
                                        columnNumber: 17
                                    }, this)
                                }, void 0, false, {
                                    fileName: "[project]/components/command-center/PersonasReadOnlyPanel.tsx",
                                    lineNumber: 135,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "next-angle-actions",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                            onClick: ()=>openEditor(persona),
                                            type: "button",
                                            children: "Edit"
                                        }, void 0, false, {
                                            fileName: "[project]/components/command-center/PersonasReadOnlyPanel.tsx",
                                            lineNumber: 146,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                            className: "danger",
                                            onClick: ()=>onDeletePersona(persona.index),
                                            type: "button",
                                            children: "Delete"
                                        }, void 0, false, {
                                            fileName: "[project]/components/command-center/PersonasReadOnlyPanel.tsx",
                                            lineNumber: 149,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/components/command-center/PersonasReadOnlyPanel.tsx",
                                    lineNumber: 145,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, persona.id, true, {
                            fileName: "[project]/components/command-center/PersonasReadOnlyPanel.tsx",
                            lineNumber: 104,
                            columnNumber: 13
                        }, this))
                ]
            }, void 0, true, {
                fileName: "[project]/components/command-center/PersonasReadOnlyPanel.tsx",
                lineNumber: 90,
                columnNumber: 7
            }, this),
            editingPersona ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "next-modal-backdrop",
                role: "presentation",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("form", {
                    className: "next-edit-modal",
                    onSubmit: handleEditorSubmit,
                    "aria-label": "Edit persona",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                            children: "Edit Persona"
                        }, void 0, false, {
                            fileName: "[project]/components/command-center/PersonasReadOnlyPanel.tsx",
                            lineNumber: 160,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    children: "Persona Name"
                                }, void 0, false, {
                                    fileName: "[project]/components/command-center/PersonasReadOnlyPanel.tsx",
                                    lineNumber: 162,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                    name: "name",
                                    defaultValue: editingPersona.name,
                                    autoFocus: true
                                }, void 0, false, {
                                    fileName: "[project]/components/command-center/PersonasReadOnlyPanel.tsx",
                                    lineNumber: 163,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/components/command-center/PersonasReadOnlyPanel.tsx",
                            lineNumber: 161,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    children: "Source Link"
                                }, void 0, false, {
                                    fileName: "[project]/components/command-center/PersonasReadOnlyPanel.tsx",
                                    lineNumber: 166,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                    name: "sourceLink",
                                    defaultValue: editingPersona.sourceLink
                                }, void 0, false, {
                                    fileName: "[project]/components/command-center/PersonasReadOnlyPanel.tsx",
                                    lineNumber: 167,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/components/command-center/PersonasReadOnlyPanel.tsx",
                            lineNumber: 165,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    children: "Notes"
                                }, void 0, false, {
                                    fileName: "[project]/components/command-center/PersonasReadOnlyPanel.tsx",
                                    lineNumber: 170,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("textarea", {
                                    name: "notes",
                                    defaultValue: editingPersona.notes,
                                    rows: 3
                                }, void 0, false, {
                                    fileName: "[project]/components/command-center/PersonasReadOnlyPanel.tsx",
                                    lineNumber: 171,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/components/command-center/PersonasReadOnlyPanel.tsx",
                            lineNumber: 169,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "next-modal-actions",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    type: "button",
                                    onClick: ()=>setEditingPersona(null),
                                    children: "Cancel"
                                }, void 0, false, {
                                    fileName: "[project]/components/command-center/PersonasReadOnlyPanel.tsx",
                                    lineNumber: 174,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    className: "primary",
                                    type: "submit",
                                    children: "Save"
                                }, void 0, false, {
                                    fileName: "[project]/components/command-center/PersonasReadOnlyPanel.tsx",
                                    lineNumber: 177,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/components/command-center/PersonasReadOnlyPanel.tsx",
                            lineNumber: 173,
                            columnNumber: 13
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/components/command-center/PersonasReadOnlyPanel.tsx",
                    lineNumber: 159,
                    columnNumber: 11
                }, this)
            }, void 0, false, {
                fileName: "[project]/components/command-center/PersonasReadOnlyPanel.tsx",
                lineNumber: 158,
                columnNumber: 9
            }, this) : null
        ]
    }, void 0, true, {
        fileName: "[project]/components/command-center/PersonasReadOnlyPanel.tsx",
        lineNumber: 73,
        columnNumber: 5
    }, this);
}
_s(PersonasReadOnlyPanel, "6YNI+41A7bvzU26deIkyfCdJJ0Q=");
_c = PersonasReadOnlyPanel;
var _c;
__turbopack_context__.k.register(_c, "PersonasReadOnlyPanel");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/components/command-center/CommandCenterShell.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "CommandCenterShell",
    ()=>CommandCenterShell
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$hooks$2f$command$2d$center$2f$useLegacyDashboardBridge$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/hooks/command-center/useLegacyDashboardBridge.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$command$2d$center$2f$AnglesReadOnlyPanel$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/command-center/AnglesReadOnlyPanel.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$command$2d$center$2f$CommandCenterHeader$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/command-center/CommandCenterHeader.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$command$2d$center$2f$CommandHqSummary$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/command-center/CommandHqSummary.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$command$2d$center$2f$CreativeTrackerReadOnlyPanel$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/command-center/CreativeTrackerReadOnlyPanel.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$command$2d$center$2f$LegacyDashboardFrame$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/command-center/LegacyDashboardFrame.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$command$2d$center$2f$PersonasReadOnlyPanel$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/command-center/PersonasReadOnlyPanel.tsx [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
;
;
;
;
;
function CommandCenterShell({ useReactHeader = false }) {
    _s();
    const { actions, iframeRef, state } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$hooks$2f$command$2d$center$2f$useLegacyDashboardBridge$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useLegacyDashboardBridge"])(useReactHeader);
    const showReactCommandHq = useReactHeader && state.activeTab === "hq";
    const showReactAngles = useReactHeader && state.activeTab === "angles";
    const showReactPersonas = useReactHeader && state.activeTab === "personas";
    const showReactCreatives = useReactHeader && state.activeTab === "creatives";
    const showReactTaxonomy = showReactAngles || showReactPersonas;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("main", {
        className: [
            "dashboard-shell",
            useReactHeader ? "with-react-header" : "",
            showReactCommandHq ? "react-hq-active" : "",
            showReactTaxonomy ? "react-taxonomy-active" : "",
            showReactCreatives ? "react-creative-active" : ""
        ].filter(Boolean).join(" "),
        children: [
            useReactHeader ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$command$2d$center$2f$CommandCenterHeader$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CommandCenterHeader"], {
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
                lineNumber: 36,
                columnNumber: 9
            }, this) : null,
            showReactCommandHq ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$command$2d$center$2f$CommandHqSummary$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CommandHqSummary"], {
                state: state.commandCenterState
            }, void 0, false, {
                fileName: "[project]/components/command-center/CommandCenterShell.tsx",
                lineNumber: 65,
                columnNumber: 29
            }, this) : null,
            showReactAngles ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$command$2d$center$2f$AnglesReadOnlyPanel$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["AnglesReadOnlyPanel"], {
                onAddAngle: actions.handleAddAngle,
                onDeleteAngle: actions.handleDeleteAngle,
                onEditAngle: actions.handleEditAngle,
                onSaveAngleFields: actions.handleSaveAngleFields,
                onUpdateAngleName: actions.handleUpdateAngleName,
                onUpdateAngleNotes: actions.handleUpdateAngleNotes,
                state: state.commandCenterState
            }, void 0, false, {
                fileName: "[project]/components/command-center/CommandCenterShell.tsx",
                lineNumber: 67,
                columnNumber: 9
            }, this) : null,
            showReactPersonas ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$command$2d$center$2f$PersonasReadOnlyPanel$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PersonasReadOnlyPanel"], {
                onAddPersona: actions.handleAddPersona,
                onDeletePersona: actions.handleDeletePersona,
                onEditPersona: actions.handleEditPersona,
                onSavePersonaFields: actions.handleSavePersonaFields,
                onUpdatePersonaName: actions.handleUpdatePersonaName,
                onUpdatePersonaNotes: actions.handleUpdatePersonaNotes,
                state: state.commandCenterState
            }, void 0, false, {
                fileName: "[project]/components/command-center/CommandCenterShell.tsx",
                lineNumber: 78,
                columnNumber: 9
            }, this) : null,
            showReactCreatives ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$command$2d$center$2f$CreativeTrackerReadOnlyPanel$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CreativeTrackerReadOnlyPanel"], {
                onCreateCreative: actions.handleCreateCreative,
                onDeleteCreative: actions.handleDeleteCreative,
                onSaveCreative: actions.handleSaveCreative,
                onUpdateCreativeField: actions.handleUpdateCreativeField,
                onUpdateCreativeStatus: actions.handleUpdateCreativeStatus,
                state: state.commandCenterState
            }, void 0, false, {
                fileName: "[project]/components/command-center/CommandCenterShell.tsx",
                lineNumber: 89,
                columnNumber: 9
            }, this) : null,
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$command$2d$center$2f$LegacyDashboardFrame$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["LegacyDashboardFrame"], {
                compact: useReactHeader,
                onLoad: actions.handleFrameLoad,
                ref: iframeRef
            }, void 0, false, {
                fileName: "[project]/components/command-center/CommandCenterShell.tsx",
                lineNumber: 98,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/components/command-center/CommandCenterShell.tsx",
        lineNumber: 24,
        columnNumber: 5
    }, this);
}
_s(CommandCenterShell, "QAaoIGnKe4Ppc7YHQpQ5Aaj+aTI=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$hooks$2f$command$2d$center$2f$useLegacyDashboardBridge$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useLegacyDashboardBridge"]
    ];
});
_c = CommandCenterShell;
var _c;
__turbopack_context__.k.register(_c, "CommandCenterShell");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=_08ylhh3._.js.map