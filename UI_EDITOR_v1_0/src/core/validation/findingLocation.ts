import type { ValidationFindingLocation } from "../schema/validation";

export function locationForComponent(
  packageId: string,
  frameId: string,
  componentId: string,
  propertyPath?: string,
): ValidationFindingLocation {
  return propertyPath !== undefined
    ? { packageId, frameId, componentId, propertyPath }
    : { packageId, frameId, componentId };
}

export function locationForContainer(
  packageId: string,
  frameId: string,
  containerId: string,
  propertyPath?: string,
): ValidationFindingLocation {
  return propertyPath !== undefined
    ? { packageId, frameId, containerId, propertyPath }
    : { packageId, frameId, containerId };
}

export function locationForFrame(packageId: string, frameId: string): ValidationFindingLocation {
  return { packageId, frameId };
}

export function locationForLibrary(packageId: string, libraryEntryId: string): ValidationFindingLocation {
  return { packageId, libraryEntryId };
}
