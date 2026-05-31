export interface Guide {
  id: string;
  frameId: string;
  axis: "x" | "y";
  position: number;
  locked: boolean;
}

export interface GuidesFile {
  schemaVersion: 1;
  guides: Guide[];
}
