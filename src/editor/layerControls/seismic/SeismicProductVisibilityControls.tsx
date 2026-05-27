import { panelStyles, vibrancyLabel, vibrancyTertiaryLabel } from "../../styles";
import {
  detailsContentStyle,
  nestedControlRowStyle,
  nestedDetailsStyle,
  nestedFieldLabelStyle,
} from "../../styleControls";
import type { EditableStyle } from "../../../pages/types";
import type { SeismicProductOption } from "./seismicModel";

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
  const setProductVisible = (id: string, visible: boolean) => {
    commit({
      seismicProductVisibility: {
        ...productVisibility,
        [id]: visible,
      },
    });
  };
  const setVisibilityForProducts = (
    predicate: (product: SeismicProductOption) => boolean,
  ) => {
    commit({
      seismicProductVisibility: Object.fromEntries(
        products.map((product) => [product.id, predicate(product)]),
      ),
    });
  };
  const selectProduct = (id: string) => {
    commit({
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
        {products.map((product) => {
          const selected = product.id === productId;
          return (
            <div
              key={product.id}
              style={{
                ...nestedControlRowStyle,
                borderRadius: 6,
                background: selected
                  ? "rgba(244, 240, 232, 0.08)"
                  : "transparent",
              }}
            >
              <input
                data-testid={`seismic-product-visible-${product.id}`}
                type="checkbox"
                checked={productVisibility[product.id] === true}
                disabled={disabled}
                onChange={(e) =>
                  setProductVisible(product.id, e.target.checked)
                }
                title="Show or hide this product"
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
                  fontSize: 11,
                  opacity: controlOpacity,
                  minWidth: 54,
                  textAlign: "right",
                }}
              >
                {product.raymarchCapable ? "3D" : (product.surveyKind ?? "2D")}
                {product.domainUnit ? ` / ${product.domainUnit}` : ""}
              </span>
            </div>
          );
        })}
      </div>
    </details>
  );
}
