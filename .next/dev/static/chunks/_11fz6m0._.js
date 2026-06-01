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
function normalizeStatus(status) {
    return String(status || "").trim().toLowerCase();
}
function plural(count, singular, pluralLabel = `${singular}s`) {
    return count === 1 ? singular : pluralLabel;
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
_s(useLegacyDashboardBridge, "5b/FgYgRXd2cmw5z7iN/c99boh8=");
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
"[project]/components/command-center/CommandCenterShell.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "CommandCenterShell",
    ()=>CommandCenterShell
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$hooks$2f$command$2d$center$2f$useLegacyDashboardBridge$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/hooks/command-center/useLegacyDashboardBridge.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$command$2d$center$2f$CommandCenterHeader$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/command-center/CommandCenterHeader.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$command$2d$center$2f$CommandHqSummary$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/command-center/CommandHqSummary.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$command$2d$center$2f$LegacyDashboardFrame$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/command-center/LegacyDashboardFrame.tsx [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
;
;
function CommandCenterShell({ useReactHeader = false }) {
    _s();
    const { actions, iframeRef, state } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$hooks$2f$command$2d$center$2f$useLegacyDashboardBridge$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useLegacyDashboardBridge"])(useReactHeader);
    const showReactCommandHq = useReactHeader && state.activeTab === "hq";
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("main", {
        className: [
            "dashboard-shell",
            useReactHeader ? "with-react-header" : "",
            showReactCommandHq ? "react-hq-active" : ""
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
                lineNumber: 27,
                columnNumber: 9
            }, this) : null,
            showReactCommandHq ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$command$2d$center$2f$CommandHqSummary$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CommandHqSummary"], {
                state: state.commandCenterState
            }, void 0, false, {
                fileName: "[project]/components/command-center/CommandCenterShell.tsx",
                lineNumber: 56,
                columnNumber: 29
            }, this) : null,
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$command$2d$center$2f$LegacyDashboardFrame$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["LegacyDashboardFrame"], {
                compact: useReactHeader,
                onLoad: actions.handleFrameLoad,
                ref: iframeRef
            }, void 0, false, {
                fileName: "[project]/components/command-center/CommandCenterShell.tsx",
                lineNumber: 57,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/components/command-center/CommandCenterShell.tsx",
        lineNumber: 17,
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
"[project]/node_modules/next/dist/compiled/react/cjs/react-jsx-dev-runtime.development.js [app-client] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = /*#__PURE__*/ __turbopack_context__.i("[project]/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
/**
 * @license React
 * react-jsx-dev-runtime.development.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */ "use strict";
"production" !== ("TURBOPACK compile-time value", "development") && function() {
    function getComponentNameFromType(type) {
        if (null == type) return null;
        if ("function" === typeof type) return type.$$typeof === REACT_CLIENT_REFERENCE ? null : type.displayName || type.name || null;
        if ("string" === typeof type) return type;
        switch(type){
            case REACT_FRAGMENT_TYPE:
                return "Fragment";
            case REACT_PROFILER_TYPE:
                return "Profiler";
            case REACT_STRICT_MODE_TYPE:
                return "StrictMode";
            case REACT_SUSPENSE_TYPE:
                return "Suspense";
            case REACT_SUSPENSE_LIST_TYPE:
                return "SuspenseList";
            case REACT_ACTIVITY_TYPE:
                return "Activity";
            case REACT_VIEW_TRANSITION_TYPE:
                return "ViewTransition";
        }
        if ("object" === typeof type) switch("number" === typeof type.tag && console.error("Received an unexpected object in getComponentNameFromType(). This is likely a bug in React. Please file an issue."), type.$$typeof){
            case REACT_PORTAL_TYPE:
                return "Portal";
            case REACT_CONTEXT_TYPE:
                return type.displayName || "Context";
            case REACT_CONSUMER_TYPE:
                return (type._context.displayName || "Context") + ".Consumer";
            case REACT_FORWARD_REF_TYPE:
                var innerType = type.render;
                type = type.displayName;
                type || (type = innerType.displayName || innerType.name || "", type = "" !== type ? "ForwardRef(" + type + ")" : "ForwardRef");
                return type;
            case REACT_MEMO_TYPE:
                return innerType = type.displayName || null, null !== innerType ? innerType : getComponentNameFromType(type.type) || "Memo";
            case REACT_LAZY_TYPE:
                innerType = type._payload;
                type = type._init;
                try {
                    return getComponentNameFromType(type(innerType));
                } catch (x) {}
        }
        return null;
    }
    function testStringCoercion(value) {
        return "" + value;
    }
    function checkKeyStringCoercion(value) {
        try {
            testStringCoercion(value);
            var JSCompiler_inline_result = !1;
        } catch (e) {
            JSCompiler_inline_result = !0;
        }
        if (JSCompiler_inline_result) {
            JSCompiler_inline_result = console;
            var JSCompiler_temp_const = JSCompiler_inline_result.error;
            var JSCompiler_inline_result$jscomp$0 = "function" === typeof Symbol && Symbol.toStringTag && value[Symbol.toStringTag] || value.constructor.name || "Object";
            JSCompiler_temp_const.call(JSCompiler_inline_result, "The provided key is an unsupported type %s. This value must be coerced to a string before using it here.", JSCompiler_inline_result$jscomp$0);
            return testStringCoercion(value);
        }
    }
    function getTaskName(type) {
        if (type === REACT_FRAGMENT_TYPE) return "<>";
        if ("object" === typeof type && null !== type && type.$$typeof === REACT_LAZY_TYPE) return "<...>";
        try {
            var name = getComponentNameFromType(type);
            return name ? "<" + name + ">" : "<...>";
        } catch (x) {
            return "<...>";
        }
    }
    function getOwner() {
        var dispatcher = ReactSharedInternals.A;
        return null === dispatcher ? null : dispatcher.getOwner();
    }
    function UnknownOwner() {
        return Error("react-stack-top-frame");
    }
    function hasValidKey(config) {
        if (hasOwnProperty.call(config, "key")) {
            var getter = Object.getOwnPropertyDescriptor(config, "key").get;
            if (getter && getter.isReactWarning) return !1;
        }
        return void 0 !== config.key;
    }
    function defineKeyPropWarningGetter(props, displayName) {
        function warnAboutAccessingKey() {
            specialPropKeyWarningShown || (specialPropKeyWarningShown = !0, console.error("%s: `key` is not a prop. Trying to access it will result in `undefined` being returned. If you need to access the same value within the child component, you should pass it as a different prop. (https://react.dev/link/special-props)", displayName));
        }
        warnAboutAccessingKey.isReactWarning = !0;
        Object.defineProperty(props, "key", {
            get: warnAboutAccessingKey,
            configurable: !0
        });
    }
    function elementRefGetterWithDeprecationWarning() {
        var componentName = getComponentNameFromType(this.type);
        didWarnAboutElementRef[componentName] || (didWarnAboutElementRef[componentName] = !0, console.error("Accessing element.ref was removed in React 19. ref is now a regular prop. It will be removed from the JSX Element type in a future release."));
        componentName = this.props.ref;
        return void 0 !== componentName ? componentName : null;
    }
    function ReactElement(type, key, props, owner, debugStack, debugTask) {
        var refProp = props.ref;
        type = {
            $$typeof: REACT_ELEMENT_TYPE,
            type: type,
            key: key,
            props: props,
            _owner: owner
        };
        null !== (void 0 !== refProp ? refProp : null) ? Object.defineProperty(type, "ref", {
            enumerable: !1,
            get: elementRefGetterWithDeprecationWarning
        }) : Object.defineProperty(type, "ref", {
            enumerable: !1,
            value: null
        });
        type._store = {};
        Object.defineProperty(type._store, "validated", {
            configurable: !1,
            enumerable: !1,
            writable: !0,
            value: 0
        });
        Object.defineProperty(type, "_debugInfo", {
            configurable: !1,
            enumerable: !1,
            writable: !0,
            value: null
        });
        Object.defineProperty(type, "_debugStack", {
            configurable: !1,
            enumerable: !1,
            writable: !0,
            value: debugStack
        });
        Object.defineProperty(type, "_debugTask", {
            configurable: !1,
            enumerable: !1,
            writable: !0,
            value: debugTask
        });
        Object.freeze && (Object.freeze(type.props), Object.freeze(type));
        return type;
    }
    function jsxDEVImpl(type, config, maybeKey, isStaticChildren, debugStack, debugTask) {
        var children = config.children;
        if (void 0 !== children) if (isStaticChildren) if (isArrayImpl(children)) {
            for(isStaticChildren = 0; isStaticChildren < children.length; isStaticChildren++)validateChildKeys(children[isStaticChildren]);
            Object.freeze && Object.freeze(children);
        } else console.error("React.jsx: Static children should always be an array. You are likely explicitly calling React.jsxs or React.jsxDEV. Use the Babel transform instead.");
        else validateChildKeys(children);
        if (hasOwnProperty.call(config, "key")) {
            children = getComponentNameFromType(type);
            var keys = Object.keys(config).filter(function(k) {
                return "key" !== k;
            });
            isStaticChildren = 0 < keys.length ? "{key: someKey, " + keys.join(": ..., ") + ": ...}" : "{key: someKey}";
            didWarnAboutKeySpread[children + isStaticChildren] || (keys = 0 < keys.length ? "{" + keys.join(": ..., ") + ": ...}" : "{}", console.error('A props object containing a "key" prop is being spread into JSX:\n  let props = %s;\n  <%s {...props} />\nReact keys must be passed directly to JSX without using spread:\n  let props = %s;\n  <%s key={someKey} {...props} />', isStaticChildren, children, keys, children), didWarnAboutKeySpread[children + isStaticChildren] = !0);
        }
        children = null;
        void 0 !== maybeKey && (checkKeyStringCoercion(maybeKey), children = "" + maybeKey);
        hasValidKey(config) && (checkKeyStringCoercion(config.key), children = "" + config.key);
        if ("key" in config) {
            maybeKey = {};
            for(var propName in config)"key" !== propName && (maybeKey[propName] = config[propName]);
        } else maybeKey = config;
        children && defineKeyPropWarningGetter(maybeKey, "function" === typeof type ? type.displayName || type.name || "Unknown" : type);
        return ReactElement(type, children, maybeKey, getOwner(), debugStack, debugTask);
    }
    function validateChildKeys(node) {
        isValidElement(node) ? node._store && (node._store.validated = 1) : "object" === typeof node && null !== node && node.$$typeof === REACT_LAZY_TYPE && ("fulfilled" === node._payload.status ? isValidElement(node._payload.value) && node._payload.value._store && (node._payload.value._store.validated = 1) : node._store && (node._store.validated = 1));
    }
    function isValidElement(object) {
        return "object" === typeof object && null !== object && object.$$typeof === REACT_ELEMENT_TYPE;
    }
    var React = __turbopack_context__.r("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)"), REACT_ELEMENT_TYPE = Symbol.for("react.transitional.element"), REACT_PORTAL_TYPE = Symbol.for("react.portal"), REACT_FRAGMENT_TYPE = Symbol.for("react.fragment"), REACT_STRICT_MODE_TYPE = Symbol.for("react.strict_mode"), REACT_PROFILER_TYPE = Symbol.for("react.profiler"), REACT_CONSUMER_TYPE = Symbol.for("react.consumer"), REACT_CONTEXT_TYPE = Symbol.for("react.context"), REACT_FORWARD_REF_TYPE = Symbol.for("react.forward_ref"), REACT_SUSPENSE_TYPE = Symbol.for("react.suspense"), REACT_SUSPENSE_LIST_TYPE = Symbol.for("react.suspense_list"), REACT_MEMO_TYPE = Symbol.for("react.memo"), REACT_LAZY_TYPE = Symbol.for("react.lazy"), REACT_ACTIVITY_TYPE = Symbol.for("react.activity"), REACT_VIEW_TRANSITION_TYPE = Symbol.for("react.view_transition"), REACT_CLIENT_REFERENCE = Symbol.for("react.client.reference"), ReactSharedInternals = React.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, hasOwnProperty = Object.prototype.hasOwnProperty, isArrayImpl = Array.isArray, createTask = console.createTask ? console.createTask : function() {
        return null;
    };
    React = {
        react_stack_bottom_frame: function(callStackForError) {
            return callStackForError();
        }
    };
    var specialPropKeyWarningShown;
    var didWarnAboutElementRef = {};
    var unknownOwnerDebugStack = React.react_stack_bottom_frame.bind(React, UnknownOwner)();
    var unknownOwnerDebugTask = createTask(getTaskName(UnknownOwner));
    var didWarnAboutKeySpread = {};
    exports.Fragment = REACT_FRAGMENT_TYPE;
    exports.jsxDEV = function(type, config, maybeKey, isStaticChildren) {
        var trackActualOwner = 1e4 > ReactSharedInternals.recentlyCreatedOwnerStacks++;
        if (trackActualOwner) {
            var previousStackTraceLimit = Error.stackTraceLimit;
            Error.stackTraceLimit = 10;
            var debugStackDEV = Error("react-stack-top-frame");
            Error.stackTraceLimit = previousStackTraceLimit;
        } else debugStackDEV = unknownOwnerDebugStack;
        return jsxDEVImpl(type, config, maybeKey, isStaticChildren, debugStackDEV, trackActualOwner ? createTask(getTaskName(type)) : unknownOwnerDebugTask);
    };
}();
}),
"[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = /*#__PURE__*/ __turbopack_context__.i("[project]/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
'use strict';
if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
;
else {
    module.exports = __turbopack_context__.r("[project]/node_modules/next/dist/compiled/react/cjs/react-jsx-dev-runtime.development.js [app-client] (ecmascript)");
}
}),
]);

//# sourceMappingURL=_11fz6m0._.js.map