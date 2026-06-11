import { panelStyles, vibrancyLabel, vibrancyTertiaryLabel } from "../../styles";
import {
  EditorEyeButton,
  detailsContentStyle,
  nestedControlRowStyle,
  nestedDetailsStyle,
  nestedFieldLabelStyle,
} from "../../styleControls";
import type { EditableStyle } from "../../../pages/types";
import {
  seismicProcessingStageLabel,
  seismicProductGroups,
  type SeismicProductOption,
} from "./seismicModel";

export function SeismicProductVisibilityControls({
  products,
  productVisibility,
  productId,
  disabled,
  controlOpacity,
  commit,
}: {
  products: SeismicProductOption[];
  productVisibility: Record<string, boolean>;
  productId: string;
  disabled: boolean;
  controlOpacity: number;
  commit: (patch: Partial<EditableStyle>) => void;
}) {
  const visibleProductCount = products.filter(
    (product) => productVisibility[product.id] === true,
  ).length;
  const productGroups = seismicProductGroups(products);
  const setProductVisible = (id: string, visible: boolean) => {
    commit({
      ...(visible ? { visible: true } : {}),
      seismicProductVisibility: {
        ...productVisibility,
        [id]: visible,
      },
    });
  };
  const setVisibilityForProducts = (
    predicate: (product: SeismicProductOption) => boolean,
  ) => {
    const nextVisibility = Object.fromEntries(
      products.map((product) => [product.id, predicate(product)]),
    );
    const anyVisible = Object.values(nextVisibility).some(Boolean);
    commit({
      ...(anyVisible ? { visible: true } : {}),
      seismicProductVisibility: nextVisibility,
    });
  };
  const selectProduct = (id: string) => {
    commit({
      visible: true,
      seismicProductId: id,
      seismicProductVisibility: {
        ...productVisibility,
        [id]: true,
      },
    });
  };

  return (
    <details style={nestedDetailsStyle}>
      <summary style={panelStyles.summary}>
        Product visibility ({visibleProductCount}/{products.length})
      </summary>
      <div style={detailsContentStyle}>
        <div
          style={{
            ...nestedControlRowStyle,
            gap: 6,
            flexWrap: "wrap",
          }}
        >
          <label style={nestedFieldLabelStyle}>Visibility</label>
          {[
            {
              label: "Show all",
              testId: "seismic-products-show-all",
              onClick: () => setVisibilityForProducts(() => true),
            },
            {
              label: "Hide all",
              testId: "seismic-products-hide-all",
              onClick: () => setVisibilityForProducts(() => false),
            },
            {
              label: "3D only",
              testId: "seismic-products-show-3d-only",
              onClick: () =>
                setVisibilityForProducts(
                  (product) => product.surveyKind === "3d",
                ),
            },
            {
              label: "2D only",
              testId: "seismic-products-show-2d-only",
              onClick: () =>
                setVisibilityForProducts(
                  (product) => product.surveyKind !== "3d",
                ),
            },
          ].map((action) => (
            <button
              key={action.testId}
              type="button"
              data-testid={action.testId}
              disabled={disabled}
              onClick={action.onClick}
              style={{
                ...panelStyles.iconButton,
                width: "auto",
                padding: "3px 7px",
                fontSize: 10,
                opacity: controlOpacity,
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
        {productGroups.map((group) => (
          <div key={group.key}>
            <div
              style={{
                color: vibrancyTertiaryLabel,
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: 0,
                margin: "8px 0 3px 0",
                opacity: controlOpacity,
                textTransform: "uppercase",
              }}
            >
              {group.label}
            </div>
            {group.products.map((product) => {
              const selected = product.id === productId;
              const placementStatus =
                product.navigationPlacement?.navigationSource === "fallback"
                  ? (product.navigationPlacement.statusLabel ??
                    "Approximate legacy line placement; precise registration not validated.")
                  : null;
              return (
                <div key={product.id}>
                  <div
                    style={{
                      ...nestedControlRowStyle,
                      borderRadius: 6,
                      background: selected
                        ? "rgba(244, 240, 232, 0.08)"
                        : "transparent",
                    }}
                  >
                    <EditorEyeButton
                      testId={`seismic-product-visible-${product.id}`}
                      visible={productVisibility[product.id] === true}
                      disabled={disabled}
                      onClick={() =>
                        setProductVisible(
                          product.id,
                          productVisibility[product.id] !== true,
                        )
                      }
                      title={
                        productVisibility[product.id] === true
                          ? "Hide this product"
                          : "Show this product"
                      }
                      ariaLabel={
                        productVisibility[product.id] === true
                          ? `Hide ${product.label}`
                          : `Show ${product.label}`
                      }
                      style={{ opacity: controlOpacity }}
                    />
                    <button
                      type="button"
                      data-testid={`seismic-product-row-${product.id}`}
                      disabled={disabled}
                      onClick={() => selectProduct(product.id)}
                      style={{
                        flex: 1,
                        minWidth: 0,
                        appearance: "none",
                        border: "none",
                        background: "transparent",
                        color: selected ? vibrancyLabel : vibrancyTertiaryLabel,
                        font: "inherit",
                        fontSize: 11,
                        fontWeight: selected ? 800 : 650,
                        textAlign: "left",
                        cursor: disabled ? "default" : "pointer",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        opacity: controlOpacity,
                      }}
                      title={product.label}
                    >
                      {product.label}
                    </button>
                    <span
                      style={{
                        color: vibrancyTertiaryLabel,
                        fontSize: 10,
                        opacity: controlOpacity,
                        minWidth: 86,
                        textAlign: "right",
                      }}
                    >
                      {seismicProcessingStageLabel(product.processingStage)}
                      {product.domainUnit ? ` / ${product.domainUnit}` : ""}
                    </span>
                  </div>
                  {selected && placementStatus ? (
                    <div
                      data-testid={`seismic-product-placement-${product.id}`}
                      style={{
                        color: vibrancyTertiaryLabel,
                        fontSize: 10,
                        lineHeight: 1.35,
                        margin: "0 0 4px 32px",
                        opacity: controlOpacity,
                      }}
                    >
                      {placementStatus}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </details>
  );
}
