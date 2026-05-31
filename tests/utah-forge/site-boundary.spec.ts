import { expect, test } from "@playwright/test";

test("FORGE site boundary renders as a solid aligned terrain ribbon", async ({
  page,
}) => {
  await page.goto("/?project=utah-forge", { waitUntil: "networkidle" });
  await expect(page.locator("canvas")).toHaveCount(1);

  const readBoundaryState = () =>
    page.evaluate(() => {
        const sceneHandle = (
          window as unknown as {
            __scene?: {
              manager?: {
                getLayer?: (id: string) =>
                  | {
                      traverse: (
                        fn: (obj: {
                          geometry?: {
                            getAttribute?: (name: string) =>
                              | {
                                  count: number;
                                  getX: (index: number) => number;
                                  getY: (index: number) => number;
                                }
                              | undefined;
                          };
                          material?: {
                            dashed?: boolean;
                            linewidth?: number;
                            worldUnits?: boolean;
                          };
                          userData?: Record<string, unknown>;
                        }) => void,
                      ) => void;
                    }
                  | undefined;
              };
            };
          }
        ).__scene;
        const layer = sceneHandle?.manager?.getLayer?.(
          "utah-forge-site-boundary",
        );
        let sourceRing: Array<[number, number]> = [];
        let fillBoundaryMatches = 0;
        let fillVertexCount = 0;
        let outline: {
          dashed: boolean | null;
          linewidth: number | null;
          worldUnits: boolean | null;
        } | null = null;

        layer?.traverse((obj) => {
          const rawLines = obj.userData?.sourceLineStrings;
          if (Array.isArray(rawLines) && sourceRing.length === 0) {
            const firstLine = rawLines.find(
              (line): line is Array<[number, number, number]> =>
                Array.isArray(line) && line.length >= 3,
            );
            if (firstLine) {
              sourceRing = firstLine.map((point) => [point[0], point[1]]);
            }
          }

          if (obj.userData?.terrainDrapedSiteGuideLine === true) {
            outline = {
              dashed:
                typeof obj.material?.dashed === "boolean"
                  ? obj.material.dashed
                  : null,
              linewidth:
                typeof obj.material?.linewidth === "number"
                  ? obj.material.linewidth
                  : null,
              worldUnits:
                typeof obj.material?.worldUnits === "boolean"
                  ? obj.material.worldUnits
                  : null,
            };
          }

          if (obj.userData?.terrainDrapedSiteGuideFill === true) {
            const position = obj.geometry?.getAttribute?.("position");
            if (!position) return;
            fillVertexCount = position.count;
            const fillPoints = new Set<string>();
            for (let index = 0; index < position.count; index += 1) {
              fillPoints.add(
                `${position.getX(index).toFixed(3)},${position
                  .getY(index)
                  .toFixed(3)}`,
              );
            }
            fillBoundaryMatches = sourceRing.filter((point) =>
              fillPoints.has(`${point[0].toFixed(3)},${point[1].toFixed(3)}`),
            ).length;
          }
        });

        return {
          sourceRingCount: sourceRing.length,
          fillBoundaryMatches,
          fillVertexCount,
          outline,
        };
    });

  await expect.poll(readBoundaryState).toMatchObject({
      sourceRingCount: expect.any(Number),
      fillVertexCount: expect.any(Number),
      outline: {
        dashed: false,
        worldUnits: true,
      },
    });

  const boundaryState = await readBoundaryState();
  expect(boundaryState.sourceRingCount).toBeGreaterThan(3);
  expect(boundaryState.outline?.linewidth ?? 0).toBeGreaterThanOrEqual(60);
  expect(boundaryState.fillVertexCount).toBeGreaterThan(0);
  expect(boundaryState.fillBoundaryMatches).toBeGreaterThanOrEqual(
    Math.floor(boundaryState.sourceRingCount * 0.9),
  );
});
