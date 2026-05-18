"use client";

import type { Product } from "@/lib/command-center";

export type DashboardTab = {
  id: string;
  label: string;
  countId?: string;
};

export type ShellProduct = Pick<Product, "id" | "name" | "color" | "clickupListId">;

type CommandCenterHeaderProps = {
  activeTab: string;
  activeProductId: string | null;
  apiKey: string;
  counts: Record<string, string>;
  forceReloadVisible: boolean;
  productColor: string;
  productMenuOpen: boolean;
  productName: string;
  products: ShellProduct[];
  statusText: string;
  onApiKeyChange: (value: string) => void;
  onAddProduct: () => void;
  onForceReload: () => void;
  onPresenceClick: () => void;
  onProductClick: () => void;
  onProductSelect: (productId: string) => void;
  onReset: () => void;
  onSync: () => void;
  onSyncNow: () => void;
  onTabSelect: (tabId: string) => void;
};

export const dashboardTabs: DashboardTab[] = [
  { id: "hq", label: "Command HQ" },
  { id: "angles", label: "Angles", countId: "anglesCount" },
  { id: "personas", label: "Personas", countId: "personasCount" },
  { id: "creatives", label: "Creative Tracker", countId: "creativesCount" },
  { id: "matrix", label: "Creative Matrix", countId: "matrixCount" },
  { id: "actions", label: "Action Plan", countId: "actionsCount" },
  { id: "production", label: "Production", countId: "prodCount" },
  { id: "strategist", label: "Strategist", countId: "strategistCount" },
  { id: "inspiration", label: "Inspiration", countId: "inspirationCount" }
];

export function CommandCenterHeader({
  activeTab,
  activeProductId,
  apiKey,
  counts,
  forceReloadVisible,
  productColor,
  productMenuOpen,
  productName,
  products,
  statusText,
  onApiKeyChange,
  onAddProduct,
  onForceReload,
  onPresenceClick,
  onProductClick,
  onProductSelect,
  onReset,
  onSync,
  onSyncNow,
  onTabSelect
}: CommandCenterHeaderProps) {
  return (
    <>
      <header className="next-hdr" aria-label="Immuvi Command Center header">
        <div className="next-hdr-inner">
          <div className="next-hdr-logo">
            <div>
              <div className="next-hdr-logo-name">Immuvi Command Center</div>
              <div className="next-hdr-logo-sub">Kids Mental Health Creative Ops</div>
            </div>
            <div className="next-hdr-prod-wrap">
            <button className="next-hdr-prod-btn" onClick={onProductClick} type="button">
              <span className="next-hdr-prod-dot" style={{ background: productColor || "#94A3B8" }} />
              <span>{productName || "No Product"}</span>
              <svg width="10" height="6" viewBox="0 0 10 6" fill="none" aria-hidden="true">
                <path
                  d="M1 1L5 5L9 1"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                />
              </svg>
            </button>
              {productMenuOpen ? (
                <div className="next-hdr-prod-dd">
                  {products.map((product) => {
                    const isActive = product.id === activeProductId;
                    return (
                      <button
                        className={isActive ? "next-hdr-prod-dd-item active" : "next-hdr-prod-dd-item"}
                        key={product.id}
                        onClick={() => onProductSelect(product.id)}
                        type="button"
                      >
                        <span className="next-hdr-prod-dd-dot" style={{ background: product.color || "#4F46E5" }} />
                        <span className="next-hdr-prod-dd-name">{product.name}</span>
                        {product.clickupListId ? <span className="next-hdr-prod-dd-badge">&#10003; ClickUp</span> : null}
                        {isActive ? <span className="next-hdr-prod-check">&#10003;</span> : null}
                      </button>
                    );
                  })}
                  <button className="next-hdr-prod-dd-item" onClick={onAddProduct} type="button">
                    <span className="next-hdr-prod-dd-add">Add Product</span>
                  </button>
                </div>
              ) : null}
            </div>
          </div>
          <div className="next-hdr-right">
            <input
              className="next-api-inp"
              onChange={(event) => onApiKeyChange(event.target.value)}
              placeholder="ClickUp API Key"
              type="text"
              value={apiKey}
            />
            <button className="next-btn-sync" onClick={onSync} type="button">
              Sync ClickUp
            </button>
            <button className="next-btn-ghost" onClick={onReset} type="button">
              &#8635; Reset
            </button>
            <div className="next-live-sync-bar">
              <span className="next-live-dot" />
              <span className="next-live-sync-lbl">{statusText || "Not synced"}</span>
              <button className="next-btn-sync-now" onClick={onSyncNow} title="Sync now" type="button">
                &#8635;
              </button>
              <button
                className="next-btn-sync-now next-force-reload"
                onClick={onForceReload}
                title="Force everyone's tab to reload"
                type="button"
                style={{ display: forceReloadVisible ? "inline-flex" : "none" }}
              >
                &#x1F504;
              </button>
            </div>
            <button className="next-presence-bar" onClick={onPresenceClick} type="button">
              <span>&#9679; 1 online</span>
            </button>
          </div>
        </div>
      </header>
      <nav className="next-tabs-wrap" aria-label="Dashboard sections">
        <div className="next-tabs" role="tablist">
          {dashboardTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                aria-selected={isActive}
                className={isActive ? "next-tab on" : "next-tab"}
                key={tab.id}
                onClick={() => onTabSelect(tab.id)}
                role="tab"
                type="button"
              >
                {tab.label}
                {tab.countId ? <span className="next-tab-count">{counts[tab.countId] || "0"}</span> : null}
              </button>
            );
          })}
          <button
            aria-selected={activeTab === "admin"}
            className={activeTab === "admin" ? "next-tab next-admin-tab on" : "next-tab next-admin-tab"}
            onClick={() => onTabSelect("admin")}
            role="tab"
            type="button"
          >
            Admin
          </button>
        </div>
      </nav>
    </>
  );
}
