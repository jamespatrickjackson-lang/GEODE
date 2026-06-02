export interface DeviceProfile {
  id: string;
  name: string;
  preferredSize: { w: number; h: number };
  safeAreaInsets: { left: number; top: number; right: number; bottom: number };
}

export interface InputProfile {
  id: string;
  name: string;
  primaryPointer: "mouse" | "touch" | "stylus" | "remote";
  hover: boolean;
}

export interface UseCaseProfile {
  id: string;
  name: string;
  description: string;
}

export interface ProfileSelection {
  deviceId: string;
  inputId: string;
  useCaseId: string;
}

export const DEFAULT_DEVICE_PROFILES: readonly DeviceProfile[] = [
  {
    id: "desktop-1080p",
    name: "Desktop 1920x1080",
    preferredSize: { w: 1920, h: 1080 },
    safeAreaInsets: { left: 0, top: 0, right: 0, bottom: 0 },
  },
  {
    id: "tablet-portrait",
    name: "Tablet portrait",
    preferredSize: { w: 834, h: 1194 },
    safeAreaInsets: { left: 24, top: 24, right: 24, bottom: 24 },
  },
  {
    id: "phone-portrait",
    name: "Phone portrait",
    preferredSize: { w: 393, h: 852 },
    safeAreaInsets: { left: 16, top: 56, right: 16, bottom: 16 },
  },
  {
    id: "projector-1080p",
    name: "Projector 1920x1080",
    preferredSize: { w: 1920, h: 1080 },
    safeAreaInsets: { left: 64, top: 64, right: 64, bottom: 64 },
  },
];

export const DEFAULT_INPUT_PROFILES: readonly InputProfile[] = [
  { id: "mouse-keyboard", name: "Mouse + keyboard", primaryPointer: "mouse", hover: true },
  { id: "touch-primary", name: "Touch", primaryPointer: "touch", hover: false },
  { id: "stylus-primary", name: "Stylus", primaryPointer: "stylus", hover: true },
  { id: "presentation-remote", name: "Presentation remote", primaryPointer: "remote", hover: false },
];

export const DEFAULT_USE_CASE_PROFILES: readonly UseCaseProfile[] = [
  {
    id: "technical-editing",
    name: "Technical editing",
    description: "Dense panels, frequent keyboard use, mouse-primary.",
  },
  {
    id: "client-presentation",
    name: "Client presentation",
    description: "Bigger touch targets, simpler chrome, projection-friendly contrast.",
  },
];

export function deviceProfileById(id: string): DeviceProfile | undefined {
  return DEFAULT_DEVICE_PROFILES.find((p) => p.id === id);
}

export function inputProfileById(id: string): InputProfile | undefined {
  return DEFAULT_INPUT_PROFILES.find((p) => p.id === id);
}

export function useCaseProfileById(id: string): UseCaseProfile | undefined {
  return DEFAULT_USE_CASE_PROFILES.find((p) => p.id === id);
}
