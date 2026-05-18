"use client";

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { dashboardTabs, type ShellProduct } from "@/components/command-center/CommandCenterHeader";
import {
  createEmptyCommandCenterState,
  readLegacyCommandCenterState,
  readLegacyProductSnapshot,
  type CommandCenterState,
  type CreativeFormValues,
  type LegacyRuntimeWindow
} from "@/lib/command-center";

type LegacyWindow = LegacyRuntimeWindow & {
  _togglePresencePanel?: (event?: Event) => void;
  addAngleRow?: () => void;
  addPersonaRow?: () => void;
  broadcastForceReload?: () => void;
  deleteAngle?: (index: number) => void;
  deleteCreative?: (id: string) => void;
  deletePersona?: (index: number) => void;
  hdrSwitchProduct?: (productId: string) => void;
  openAddProductModal?: () => void;
  openAddCreative?: () => void;
  openEditAngle?: (index: number) => void;
  openEditCreative?: (id: string) => void;
  openEditPersona?: (index: number) => void;
  resetToSeedData?: () => void;
  showTab?: (tabId: string, button?: Element | null) => void;
  syncClickUp?: () => void;
  triggerManualSync?: () => void;
  deleteManualAction?: (id: string) => void;
  updateManualActionDate?: (id: string, date: string) => void;
  updateManualActionStatus?: (id: string, status: string) => void;
  updateAngleName?: (index: number, text: string) => void;
  updateAngleNotes?: (index: number, text: string) => void;
  updateCreativeFieldInline?: (adId: string, field: string, value: string) => void;
  updateCreativeStatus?: (index: number, status: string) => void;
  updatePersonaName?: (index: number, text: string) => void;
  updatePersonaNotes?: (index: number, text: string) => void;
};

const countIds = dashboardTabs
  .map((tab) => tab.countId)
  .filter((countId): countId is string => Boolean(countId));

export function useLegacyDashboardBridge(enabled: boolean): {
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  state: {
    activeProductId: string | null;
    activeTab: string;
    apiKey: string;
    commandCenterState: CommandCenterState;
    counts: Record<string, string>;
    forceReloadVisible: boolean;
    productColor: string;
    productMenuOpen: boolean;
    productName: string;
    products: ShellProduct[];
    statusText: string;
  };
  actions: {
    callLegacy: (fnName: keyof LegacyWindow) => void;
    callLegacyWithSyntheticClick: (fnName: keyof LegacyWindow) => void;
    handleAddAngle: () => void;
    handleCreateCreative: (values: CreativeFormValues) => void;
    handleAddPersona: () => void;
    handleAddProduct: () => void;
    handleApiKeyChange: (value: string) => void;
    handleDeleteAngle: (index: number) => void;
    handleDeleteCreative: (id: string) => void;
    handleDeletePersona: (index: number) => void;
    handleDeleteAction: (id: string) => void;
    handleEditAngle: (index: number) => void;
    handleSaveCreative: (id: string, values: CreativeFormValues) => void;
    handleEditPersona: (index: number) => void;
    handleFrameLoad: () => void;
    handleProductSelect: (productId: string) => void;
    handleTabSelect: (tabId: string) => void;
    handleUpdateAngleName: (index: number, value: string) => void;
    handleUpdateAngleNotes: (index: number, value: string) => void;
    handleSaveAngleFields: (index: number, fields: { name: string; notes: string; sourceLink: string }) => void;
    handleUpdatePersonaName: (index: number, value: string) => void;
    handleUpdatePersonaNotes: (index: number, value: string) => void;
    handleSavePersonaFields: (index: number, fields: { name: string; notes: string; sourceLink: string }) => void;
    handleUpdateCreativeField: (adId: string, field: string, value: string) => void;
    handleUpdateCreativeStatus: (adId: string, status: string) => void;
    handleUpdateActionDueDate: (id: string, dueDate: string) => void;
    handleUpdateActionStatus: (id: string, status: string) => void;
    setProductMenuOpen: Dispatch<SetStateAction<boolean>>;
    syncFromLegacyDom: () => void;
  };
} {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [activeProductId, setActiveProductId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("hq");
  const [apiKey, setApiKey] = useState("");
  const [commandCenterState, setCommandCenterState] = useState<CommandCenterState>(() => createEmptyCommandCenterState());
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [forceReloadVisible, setForceReloadVisible] = useState(false);
  const [productColor, setProductColor] = useState("#94A3B8");
  const [productMenuOpen, setProductMenuOpen] = useState(false);
  const [productName, setProductName] = useState("No Product");
  const [products, setProducts] = useState<ShellProduct[]>([]);
  const [statusText, setStatusText] = useState("Not synced");

  const getLegacyWindow = useCallback(() => iframeRef.current?.contentWindow as LegacyWindow | null, []);
  const getLegacyDocument = useCallback(() => iframeRef.current?.contentDocument || null, []);

  const callLegacy = useCallback(
    (fnName: keyof LegacyWindow) => {
      const legacyWindow = getLegacyWindow();
      const fn = legacyWindow?.[fnName];
      if (typeof fn === "function") fn.call(legacyWindow);
    },
    [getLegacyWindow]
  );

  const syncFromLegacyDom = useCallback(() => {
    if (!enabled) return;
    const doc = getLegacyDocument();
    if (!doc) return;

    const nextCounts: Record<string, string> = {};
    countIds.forEach((countId) => {
      nextCounts[countId] = doc.getElementById(countId)?.textContent?.trim() || "0";
    });

    setCounts(nextCounts);
    setApiKey((doc.getElementById("apiKeyInput") as HTMLInputElement | null)?.value || "");
    setForceReloadVisible(doc.getElementById("forceReloadAllBtn")?.style.display !== "none");
    setProductColor(doc.getElementById("hdrProdDot")?.style.background || "#94A3B8");
    setProductName(doc.getElementById("hdrProdName")?.textContent?.trim() || "No Product");
    setStatusText(doc.getElementById("statusLbl")?.textContent?.trim() || "Not synced");

    const productState = readLegacyProductSnapshot(getLegacyWindow());
    setActiveProductId(productState.activeProductId);
    setProducts(productState.products as ShellProduct[]);
    setCommandCenterState(readLegacyCommandCenterState(getLegacyWindow()));

    const activeButton = doc.querySelector<HTMLButtonElement>(".tabs .tab.on");
    const onclick = activeButton?.getAttribute("onclick") || "";
    const match = onclick.match(/showTab\('([^']+)'/);
    if (match?.[1]) setActiveTab(match[1]);
  }, [enabled, getLegacyDocument, getLegacyWindow]);

  const syncSoon = useCallback(() => {
    window.setTimeout(syncFromLegacyDom, 120);
  }, [syncFromLegacyDom]);

  const hideLegacyShell = useCallback(() => {
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
  }, [enabled, getLegacyDocument]);

  const handleFrameLoad = useCallback(() => {
    hideLegacyShell();
    syncFromLegacyDom();
  }, [hideLegacyShell, syncFromLegacyDom]);

  useEffect(() => {
    if (!enabled) return undefined;
    const interval = window.setInterval(syncFromLegacyDom, 1000);
    return () => window.clearInterval(interval);
  }, [enabled, syncFromLegacyDom]);

  const handleTabSelect = useCallback(
    (tabId: string) => {
      setActiveTab(tabId);
      const legacyWindow = getLegacyWindow();
      const doc = getLegacyDocument();
      const button = doc?.querySelector(`.tabs .tab[onclick*="'${tabId}'"]`) || null;

      if (typeof legacyWindow?.showTab === "function") {
        legacyWindow.showTab(tabId, button);
      }
      window.setTimeout(syncFromLegacyDom, 50);
    },
    [getLegacyDocument, getLegacyWindow, syncFromLegacyDom]
  );

  const handleApiKeyChange = useCallback(
    (value: string) => {
      setApiKey(value);
      const legacyInput = getLegacyDocument()?.getElementById("apiKeyInput") as HTMLInputElement | null;
      if (legacyInput) {
        legacyInput.value = value;
        legacyInput.dispatchEvent(new Event("input", { bubbles: true }));
        legacyInput.dispatchEvent(new Event("change", { bubbles: true }));
      }
    },
    [getLegacyDocument]
  );

  const callLegacyWithSyntheticClick = useCallback(
    (fnName: keyof LegacyWindow) => {
      const legacyWindow = getLegacyWindow();
      const fn = legacyWindow?.[fnName];
      if (typeof fn === "function") {
        fn.call(legacyWindow, { stopPropagation() {} } as Event);
      }
    },
    [getLegacyWindow]
  );

  const handleProductSelect = useCallback(
    (productId: string) => {
      setProductMenuOpen(false);
      const legacyWindow = getLegacyWindow();
      if (typeof legacyWindow?.hdrSwitchProduct === "function") {
        legacyWindow.hdrSwitchProduct(productId);
      }
      window.setTimeout(syncFromLegacyDom, 100);
    },
    [getLegacyWindow, syncFromLegacyDom]
  );

  const handleAddProduct = useCallback(() => {
    setProductMenuOpen(false);
    callLegacy("openAddProductModal");
  }, [callLegacy]);

  const handleAddAngle = useCallback(() => {
    const legacyWindow = getLegacyWindow();
    if (typeof legacyWindow?.addAngleRow === "function") {
      legacyWindow.addAngleRow();
      syncSoon();
    }
  }, [getLegacyWindow, syncSoon]);

  const handleEditAngle = useCallback(
    (index: number) => {
      const legacyWindow = getLegacyWindow();
      if (typeof legacyWindow?.openEditAngle === "function") {
        legacyWindow.openEditAngle(index);
        syncSoon();
      }
    },
    [getLegacyWindow, syncSoon]
  );

  const handleDeleteAngle = useCallback(
    (index: number) => {
      const legacyWindow = getLegacyWindow();
      if (typeof legacyWindow?.deleteAngle === "function") {
        legacyWindow.deleteAngle(index);
        syncSoon();
      }
    },
    [getLegacyWindow, syncSoon]
  );

  const handleUpdateAngleName = useCallback(
    (index: number, value: string) => {
      const legacyWindow = getLegacyWindow();
      if (typeof legacyWindow?.updateAngleName === "function") {
        legacyWindow.updateAngleName(index, value);
        syncSoon();
      }
    },
    [getLegacyWindow, syncSoon]
  );

  const handleUpdateAngleNotes = useCallback(
    (index: number, value: string) => {
      const legacyWindow = getLegacyWindow();
      if (typeof legacyWindow?.updateAngleNotes === "function") {
        legacyWindow.updateAngleNotes(index, value);
        syncSoon();
      }
    },
    [getLegacyWindow, syncSoon]
  );

  const handleSaveAngleFields = useCallback(
    (index: number, fields: { name: string; notes: string; sourceLink: string }) => {
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
    },
    [getLegacyWindow, syncSoon]
  );

  const handleAddPersona = useCallback(() => {
    const legacyWindow = getLegacyWindow();
    if (typeof legacyWindow?.addPersonaRow === "function") {
      legacyWindow.addPersonaRow();
      syncSoon();
    }
  }, [getLegacyWindow, syncSoon]);

  const handleEditPersona = useCallback(
    (index: number) => {
      const legacyWindow = getLegacyWindow();
      if (typeof legacyWindow?.openEditPersona === "function") {
        legacyWindow.openEditPersona(index);
        syncSoon();
      }
    },
    [getLegacyWindow, syncSoon]
  );

  const handleDeletePersona = useCallback(
    (index: number) => {
      const legacyWindow = getLegacyWindow();
      if (typeof legacyWindow?.deletePersona === "function") {
        legacyWindow.deletePersona(index);
        syncSoon();
      }
    },
    [getLegacyWindow, syncSoon]
  );

  const handleUpdatePersonaName = useCallback(
    (index: number, value: string) => {
      const legacyWindow = getLegacyWindow();
      if (typeof legacyWindow?.updatePersonaName === "function") {
        legacyWindow.updatePersonaName(index, value);
        syncSoon();
      }
    },
    [getLegacyWindow, syncSoon]
  );

  const handleUpdatePersonaNotes = useCallback(
    (index: number, value: string) => {
      const legacyWindow = getLegacyWindow();
      if (typeof legacyWindow?.updatePersonaNotes === "function") {
        legacyWindow.updatePersonaNotes(index, value);
        syncSoon();
      }
    },
    [getLegacyWindow, syncSoon]
  );

  const handleSavePersonaFields = useCallback(
    (index: number, fields: { name: string; notes: string; sourceLink: string }) => {
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
    },
    [getLegacyWindow, syncSoon]
  );

  const handleUpdateCreativeField = useCallback(
    (adId: string, field: string, value: string) => {
      const legacyWindow = getLegacyWindow();
      if (typeof legacyWindow?.updateCreativeFieldInline === "function") {
        legacyWindow.updateCreativeFieldInline(adId, field, value);
        syncSoon();
      }
    },
    [getLegacyWindow, syncSoon]
  );

  const handleUpdateCreativeStatus = useCallback(
    (adId: string, status: string) => {
      const legacyWindow = getLegacyWindow();
      if (!legacyWindow?.eval) return;
      const payload = JSON.stringify({ adId, status });
      legacyWindow.eval(`(function(payload){
        var data = JSON.parse(payload);
        var idx = ADS.findIndex(function(ad) { return ad.id === data.adId; });
        if (idx === -1 || typeof updateCreativeStatus !== 'function') return;
        updateCreativeStatus(idx, data.status);
      })(${JSON.stringify(payload)})`);
      syncSoon();
    },
    [getLegacyWindow, syncSoon]
  );

  const handleCreateCreative = useCallback(
    (values: CreativeFormValues) => {
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
    },
    [getLegacyWindow, syncSoon]
  );

  const handleSaveCreative = useCallback(
    (id: string, values: CreativeFormValues) => {
      const legacyWindow = getLegacyWindow();
      if (!legacyWindow?.eval) return;
      const payload = JSON.stringify({ id, values });
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
    },
    [getLegacyWindow, syncSoon]
  );

  const handleDeleteCreative = useCallback(
    (id: string) => {
      const legacyWindow = getLegacyWindow();
      if (legacyWindow?.eval) {
        const payload = JSON.stringify({ id });
        legacyWindow.eval(`(function(payload){
          var data = JSON.parse(payload);
          if (typeof deleteCreative !== 'function') return;
          deleteCreative(data.id);
        })(${JSON.stringify(payload)})`);
        window.setTimeout(syncFromLegacyDom, 500);
      }
    },
    [getLegacyWindow, syncFromLegacyDom]
  );

  const handleUpdateActionStatus = useCallback(
    (id: string, status: string) => {
      const legacyWindow = getLegacyWindow();
      if (typeof legacyWindow?.updateManualActionStatus === "function") {
        legacyWindow.updateManualActionStatus(id, status);
        syncSoon();
      }
    },
    [getLegacyWindow, syncSoon]
  );

  const handleUpdateActionDueDate = useCallback(
    (id: string, dueDate: string) => {
      const legacyWindow = getLegacyWindow();
      if (typeof legacyWindow?.updateManualActionDate === "function") {
        legacyWindow.updateManualActionDate(id, dueDate);
        syncSoon();
      }
    },
    [getLegacyWindow, syncSoon]
  );

  const handleDeleteAction = useCallback(
    (id: string) => {
      const legacyWindow = getLegacyWindow();
      if (typeof legacyWindow?.deleteManualAction === "function") {
        legacyWindow.deleteManualAction(id);
        window.setTimeout(syncFromLegacyDom, 500);
      }
    },
    [getLegacyWindow, syncFromLegacyDom]
  );

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
      handleDeleteAction,
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
      handleUpdateActionDueDate,
      handleUpdateActionStatus,
      handleUpdateAngleName,
      handleUpdateAngleNotes,
      handleUpdatePersonaName,
      handleUpdatePersonaNotes,
      setProductMenuOpen,
      syncFromLegacyDom
    }
  };
}
