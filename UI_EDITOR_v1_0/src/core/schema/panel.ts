export interface Panel {
  id: string;
  name: string;
  frameId: string;
  rootContainerId: string;
}

export interface Section {
  id: string;
  panelId: string;
  containerId: string;
  title?: string;
}
