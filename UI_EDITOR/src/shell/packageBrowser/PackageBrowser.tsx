import { useEffect } from "react";
import { theme } from "../styles/theme";
import { useShell } from "../state/ShellContext";
import { clientListPackages } from "../../core/packageIO/packageWriteClient";
import { readPackage } from "../../core/packageIO/readPackage";

export function PackageBrowser() {
  const { state, dispatch } = useShell();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const ids = await clientListPackages();
        if (cancelled) return;
        dispatch({ type: "PACKAGE_LIST_LOADED", entries: ids.map((id) => ({ id })) });
        if (!state.pkg && ids.length > 0) {
          const pkg = await readPackage(ids[0]!);
          if (cancelled) return;
          dispatch({ type: "PACKAGE_LOADED", pkg, pkgPath: `packages/${ids[0]}` });
        }
      } catch (err) {
        if (cancelled) return;
        dispatch({
          type: "TOAST_PUSHED",
          toast: {
            id: `t-${Date.now()}`,
            severity: "error",
            message: `Failed to load packages: ${(err as Error).message}`,
            createdAt: Date.now(),
          },
        });
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      style={{
        width: 200,
        background: theme.background.panel,
        borderRight: theme.border.hairline,
        color: theme.foreground.primary,
        font: `${theme.font.bodySize}px ${theme.font.ui}`,
        padding: theme.spacing.sm,
        display: "flex",
        flexDirection: "column",
        gap: theme.spacing.xs,
      }}
    >
      <div
        style={{
          color: theme.foreground.tertiary,
          fontSize: theme.font.bodySize - 1,
          padding: `${theme.spacing.xs}px ${theme.spacing.sm}px`,
          textTransform: "uppercase",
          letterSpacing: 0.5,
        }}
      >
        Packages
      </div>
      {state.availablePackages.length === 0 && (
        <div style={{ color: theme.foreground.tertiary, padding: theme.spacing.sm }}>
          Loading...
        </div>
      )}
      {state.availablePackages.map((entry) => {
        const active = state.pkg?.manifest.id === entry.id;
        return (
          <button
            key={entry.id}
            type="button"
            style={{
              background: active ? theme.background.panelRaised : "transparent",
              color: active ? theme.foreground.primary : theme.foreground.secondary,
              border: "none",
              borderRadius: theme.radius.control,
              padding: `${theme.spacing.xs}px ${theme.spacing.sm}px`,
              textAlign: "left",
              cursor: "pointer",
              font: "inherit",
            }}
            onClick={async () => {
              try {
                const pkg = await readPackage(entry.id);
                dispatch({ type: "PACKAGE_LOADED", pkg, pkgPath: `packages/${entry.id}` });
              } catch (err) {
                dispatch({
                  type: "TOAST_PUSHED",
                  toast: {
                    id: `t-${Date.now()}`,
                    severity: "error",
                    message: `Load failed: ${(err as Error).message}`,
                    createdAt: Date.now(),
                  },
                });
              }
            }}
          >
            {entry.id}
          </button>
        );
      })}
    </div>
  );
}
