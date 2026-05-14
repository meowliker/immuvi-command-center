import { forwardRef } from "react";

type LegacyDashboardFrameProps = {
  compact?: boolean;
  onLoad?: () => void;
};

export const LegacyDashboardFrame = forwardRef<HTMLIFrameElement, LegacyDashboardFrameProps>(
  function LegacyDashboardFrame({ compact = false, onLoad }, ref) {
    return (
      <iframe
        className="legacy-dashboard-frame"
        data-compact-shell={compact ? "true" : "false"}
        onLoad={onLoad}
        ref={ref}
        src="/immuvi-command-center.html"
        title="Immuvi Command Center"
      />
    );
  }
);
