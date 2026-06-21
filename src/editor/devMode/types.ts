export interface HoverInfo {
  x: number;
  y: number;
  source: string;
  note?: string;
  label: string;
  rect?: DOMRect;
  padding?: PaddingHit;
  box?: BoxModelInfo;
  locked?: boolean;
  element?: Element;
  containerName?: string;
  containerType?: string;
  containerScope?: string;
  textElement?: HTMLElement;
  textValue?: string;
  textSource?: string;
}

export interface BoxModelInfo {
  rect: DOMRect;
  content: RectLike;
  paddingTop: RectLike | null;
  paddingRight: RectLike | null;
  paddingBottom: RectLike | null;
  paddingLeft: RectLike | null;
}

export interface RectLike {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface PaddingHit {
  sides: string[];
  source: string;
}

export interface ContainerOutlineInfo {
  key: string;
  rect: DOMRect;
  name: string;
  type: string;
  scope?: string;
  element: Element;
}
