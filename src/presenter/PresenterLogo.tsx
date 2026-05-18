import { useEditor } from "../editor/EditorContext";

export function PresenterLogo() {
  const { state } = useEditor();
  const logo = state.environment.scene?.gui?.logo;
  if (!logo?.path || logo.visible === false) return null;

  const src = logo.path.startsWith("/") ? logo.path : `/${logo.path}`;
  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      style={{
        position: "absolute",
        left: `${(logo.x ?? 0.025) * 100}%`,
        top: `${(logo.y ?? 0.025) * 100}%`,
        width: `${(logo.width ?? 0.14) * 100}%`,
        height: "auto",
        opacity: logo.opacity ?? 0.92,
        objectFit: "contain",
        pointerEvents: "none",
        zIndex: 16,
        filter: "drop-shadow(0 8px 24px rgba(0, 0, 0, 0.18))",
      }}
    />
  );
}
