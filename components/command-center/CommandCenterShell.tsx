"use client";

import { useLegacyDashboardBridge } from "@/hooks/command-center/useLegacyDashboardBridge";
import { ActionPlanPanel } from "./ActionPlanPanel";
import { AnglesReadOnlyPanel } from "./AnglesReadOnlyPanel";
import { CommandCenterHeader } from "./CommandCenterHeader";
import { CommandHqSummary } from "./CommandHqSummary";
import { CreativeMatrixPanel } from "./CreativeMatrixPanel";
import { CreativeTrackerReadOnlyPanel } from "./CreativeTrackerReadOnlyPanel";
import { InspirationPanel } from "./InspirationPanel";
import { LegacyDashboardFrame } from "./LegacyDashboardFrame";
import { PersonasReadOnlyPanel } from "./PersonasReadOnlyPanel";
import { ProductionPanel } from "./ProductionPanel";
import { StrategistPanel } from "./StrategistPanel";

type CommandCenterShellProps = {
  useReactHeader?: boolean;
};

export function CommandCenterShell({ useReactHeader = false }: CommandCenterShellProps) {
  const { actions, iframeRef, state } = useLegacyDashboardBridge(useReactHeader);
  const showReactCommandHq = useReactHeader && state.activeTab === "hq";
  const showReactAngles = useReactHeader && state.activeTab === "angles";
  const showReactPersonas = useReactHeader && state.activeTab === "personas";
  const showReactCreatives = useReactHeader && state.activeTab === "creatives";
  const showReactMatrix = useReactHeader && state.activeTab === "matrix";
  const showReactActionPlan = useReactHeader && state.activeTab === "actions";
  const showReactProduction = useReactHeader && state.activeTab === "production";
  const showReactStrategist = useReactHeader && state.activeTab === "strategist";
  const showReactInspiration = useReactHeader && state.activeTab === "inspiration";
  const showReactTaxonomy = showReactAngles || showReactPersonas;

  return (
    <main
      className={[
        "dashboard-shell",
        useReactHeader ? "with-react-header" : "",
        showReactCommandHq ? "react-hq-active" : "",
        showReactTaxonomy ? "react-taxonomy-active" : "",
        showReactCreatives ? "react-creative-active" : "",
        showReactMatrix ? "react-matrix-active" : "",
        showReactActionPlan ? "react-action-active" : "",
        showReactProduction ? "react-production-active" : "",
        showReactStrategist ? "react-strategy-active" : "",
        showReactInspiration ? "react-inspiration-active" : ""
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {useReactHeader ? (
        <CommandCenterHeader
          activeProductId={state.activeProductId}
          activeTab={state.activeTab}
          apiKey={state.apiKey}
          counts={state.counts}
          forceReloadVisible={state.forceReloadVisible}
          onAddProduct={actions.handleAddProduct}
          onApiKeyChange={actions.handleApiKeyChange}
          onForceReload={() => actions.callLegacy("broadcastForceReload")}
          onPresenceClick={() => actions.callLegacyWithSyntheticClick("_togglePresencePanel")}
          onProductClick={() => {
            actions.setProductMenuOpen((open) => !open);
            actions.syncFromLegacyDom();
          }}
          onProductSelect={actions.handleProductSelect}
          onReset={() => {
            const ok = window.confirm("Reset all data to seed defaults? This cannot be undone.");
            if (ok) actions.callLegacy("resetToSeedData");
          }}
          onSync={() => actions.callLegacy("syncClickUp")}
          onSyncNow={() => actions.callLegacy("triggerManualSync")}
          onTabSelect={actions.handleTabSelect}
          productColor={state.productColor}
          productMenuOpen={state.productMenuOpen}
          productName={state.productName}
          products={state.products}
          statusText={state.statusText}
        />
      ) : null}
      {showReactCommandHq ? <CommandHqSummary state={state.commandCenterState} /> : null}
      {showReactAngles ? (
        <AnglesReadOnlyPanel
          onAddAngle={actions.handleAddAngle}
          onDeleteAngle={actions.handleDeleteAngle}
          onEditAngle={actions.handleEditAngle}
          onSaveAngleFields={actions.handleSaveAngleFields}
          onUpdateAngleName={actions.handleUpdateAngleName}
          onUpdateAngleNotes={actions.handleUpdateAngleNotes}
          state={state.commandCenterState}
        />
      ) : null}
      {showReactPersonas ? (
        <PersonasReadOnlyPanel
          onAddPersona={actions.handleAddPersona}
          onDeletePersona={actions.handleDeletePersona}
          onEditPersona={actions.handleEditPersona}
          onSavePersonaFields={actions.handleSavePersonaFields}
          onUpdatePersonaName={actions.handleUpdatePersonaName}
          onUpdatePersonaNotes={actions.handleUpdatePersonaNotes}
          state={state.commandCenterState}
        />
      ) : null}
      {showReactCreatives ? (
        <CreativeTrackerReadOnlyPanel
          onCreateCreative={actions.handleCreateCreative}
          onDeleteCreative={actions.handleDeleteCreative}
          onSaveCreative={actions.handleSaveCreative}
          onUpdateCreativeField={actions.handleUpdateCreativeField}
          onUpdateCreativeStatus={actions.handleUpdateCreativeStatus}
          state={state.commandCenterState}
        />
      ) : null}
      {showReactMatrix ? <CreativeMatrixPanel state={state.commandCenterState} /> : null}
      {showReactActionPlan ? (
        <ActionPlanPanel
          onDeleteAction={actions.handleDeleteAction}
          onUpdateActionDueDate={actions.handleUpdateActionDueDate}
          onUpdateActionStatus={actions.handleUpdateActionStatus}
          state={state.commandCenterState}
        />
      ) : null}
      {showReactProduction ? (
        <ProductionPanel onUpdateActionStatus={actions.handleUpdateActionStatus} state={state.commandCenterState} />
      ) : null}
      {showReactStrategist ? <StrategistPanel state={state.commandCenterState} /> : null}
      {showReactInspiration ? <InspirationPanel state={state.commandCenterState} /> : null}
      <LegacyDashboardFrame compact={useReactHeader} onLoad={actions.handleFrameLoad} ref={iframeRef} />
    </main>
  );
}
