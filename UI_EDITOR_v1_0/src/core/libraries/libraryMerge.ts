import type { Libraries } from "../schema/library";

export function libraryMerge(_base: Libraries, _external: Libraries): never {
  throw new Error(
    "Library merging is deferred to v2. v1 supports a single library per package.",
  );
}
