import {
  LayerBooleanStyleControl,
  LayerNumberStyleControl,
  type LayerStyleSetter,
  type PageStyleClearer,
  type PageStyleSetter,
} from "../../styleControls";
import type { EditableStyle, PresentationPage } from "../../../pages/types";

export function PointMarkerControls({
  style,
  isEnv,
  currentPage,
  layerId,
  setEnvLayerStyle,
  setPageLayerOverride,
  clearPageLayerOverride,
}: {
  style: EditableStyle;
  isEnv: boolean;
  currentPage: PresentationPage | null;
  layerId: string;
  setEnvLayerStyle: LayerStyleSetter;
  setPageLayerOverride: PageStyleSetter;
  clearPageLayerOverride: PageStyleClearer;
}) {
  return (
    <>
      <LayerNumberStyleControl
        label="Marker radius"
        field="pointMarkerRadiusM"
        fallback={900}
        min={100}
        max={6000}
        step={50}
        decimals={0}
        style={style}
        isEnv={isEnv}
        currentPage={currentPage}
        layerId={layerId}
        setEnvLayerStyle={setEnvLayerStyle}
        setPageLayerOverride={setPageLayerOverride}
        clearPageLayerOverride={clearPageLayerOverride}
      />
      <LayerNumberStyleControl
        label="Marker lift"
        field="pointMarkerLiftM"
        fallback={0}
        min={-3000}
        max={6000}
        step={50}
        decimals={0}
        style={style}
        isEnv={isEnv}
        currentPage={currentPage}
        layerId={layerId}
        setEnvLayerStyle={setEnvLayerStyle}
        setPageLayerOverride={setPageLayerOverride}
        clearPageLayerOverride={clearPageLayerOverride}
      />
      <LayerNumberStyleControl
        label="Label lift"
        field="pointMarkerLabelLiftM"
        fallback={1200}
        min={0}
        max={10000}
        step={100}
        decimals={0}
        style={style}
        isEnv={isEnv}
        currentPage={currentPage}
        layerId={layerId}
        setEnvLayerStyle={setEnvLayerStyle}
        setPageLayerOverride={setPageLayerOverride}
        clearPageLayerOverride={clearPageLayerOverride}
      />
      <LayerBooleanStyleControl
        label="Align to topo"
        field="pointMarkerAlignToTopo"
        fallback={false}
        style={style}
        isEnv={isEnv}
        currentPage={currentPage}
        layerId={layerId}
        setEnvLayerStyle={setEnvLayerStyle}
        setPageLayerOverride={setPageLayerOverride}
        clearPageLayerOverride={clearPageLayerOverride}
        testId="point-marker-align-to-topo"
      />
    </>
  );
}
