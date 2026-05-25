import { expect, test } from "@playwright/test";
import type { EditableStyle } from "../../src/pages/types";
import {
  cleanDemoBoreholePath,
  resolveDemoBoreholeWellStyle,
  resolveDemoOrientationBlockStyle,
} from "../../src/projectModules/utahForge/siteDetails";

test("site detail defaults resolve per well and preserve legacy radius fallback", () => {
  const style: EditableStyle = { demoBoreholePipeRadiusM: 14 };

  const injection = resolveDemoBoreholeWellStyle(style, "16A(78)-32");
  const production = resolveDemoBoreholeWellStyle(style, "16B(78)-32");

  expect(injection.pipeDiameterM).toBe(28);
  expect(injection.color).toBe("#35d7ff");
  expect(injection.collarLabelText).toBe("16A injection");
  expect(production.pipeDiameterM).toBe(28);
  expect(production.color).toBe("#ff7440");
  expect(production.collarLabelText).toBe("16B production");
});

test("site detail structured well and block styles override independently", () => {
  const style: EditableStyle = {
    demoBoreholeWells: {
      "16A(78)-32": {
        visible: false,
        pipeDiameterM: 32,
        color: "#00ffff",
        lineStyle: "dashed",
        dashLengthM: 400,
        dashGapM: 200,
        centerlineVisible: false,
        collarLabelVisible: false,
        toeLabelText: "Custom injection toe",
      },
    },
    demoBoreholeBlock: {
      visible: false,
      widthM: 140,
      fillColor: "#eeeeee",
      outlineVisible: false,
      labelText: "Demo block",
    },
  };

  const injection = resolveDemoBoreholeWellStyle(style, "16A(78)-32");
  const production = resolveDemoBoreholeWellStyle(style, "16B(78)-32");
  const block = resolveDemoOrientationBlockStyle(style);

  expect(injection.visible).toBe(false);
  expect(injection.pipeDiameterM).toBe(32);
  expect(injection.lineStyle).toBe("dashed");
  expect(injection.dashLengthM).toBe(400);
  expect(injection.centerlineVisible).toBe(false);
  expect(injection.collarLabelVisible).toBe(false);
  expect(injection.toeLabelText).toBe("Custom injection toe");
  expect(production.visible).toBe(true);
  expect(production.lineStyle).toBe("solid");
  expect(block.visible).toBe(false);
  expect(block.widthM).toBe(140);
  expect(block.outlineVisible).toBe(false);
  expect(block.labelText).toBe("Demo block");
});

test("site detail path cleanup preserves endpoints", () => {
  const survey: [number, number, number][] = [
    [0, 0, 0],
    [10, 4, -10],
    [20, -5, -20],
    [30, 6, -30],
    [40, 0, -40],
  ];

  const smoothed = cleanDemoBoreholePath(survey, "smoothed", 0.5);
  const normalized = cleanDemoBoreholePath(
    survey,
    "presentation-normalized",
    0.75,
  );

  expect(smoothed[0]).toEqual(survey[0]);
  expect(smoothed[smoothed.length - 1]).toEqual(survey[survey.length - 1]);
  expect(normalized[0]).toEqual(survey[0]);
  expect(normalized[normalized.length - 1]).toEqual(survey[survey.length - 1]);
  expect(Math.abs(normalized[2][1])).toBeLessThan(Math.abs(survey[2][1]));
});
