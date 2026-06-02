export interface IconLibraryEntry {
  id: string;
  name: string;
  svgPath: string;
  viewBox: string;
  defaultSize: { w: number; h: number };
  rationale?: string;
}
