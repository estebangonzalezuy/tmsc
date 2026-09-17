import type { ComponentType } from "react";
import type { Params } from "./params";
import GridColumns from "./grid-columns";
import GridBaseline from "./grid-baseline";
import GridMargins from "./grid-margins";
import TypeScale from "./type-scale";
import TypeMeasure from "./type-measure";
import TypeHierarchy from "./type-hierarchy";
import CompPlacement from "./comp-placement";
import CompBalance from "./comp-balance";
import CompContrast from "./comp-contrast";
import MotionEasing from "./motion-easing";
import MotionDuration from "./motion-duration";
import MotionStagger from "./motion-stagger";

/* The figures a page may ask for, by the id a `:::figure` line uses — which
   is the file's name, so scripts/fundamentals/build.mjs can check a source
   against this folder without importing it. This module is deliberately not
   "use client": each figure is its own island, and a server-side registry
   sends a page only the ones it actually renders. */

export type FigureComponent = ComponentType<{ params: Params; caption?: string }>;

export const FIGURES: Record<string, FigureComponent> = {
  "grid-columns": GridColumns,
  "grid-baseline": GridBaseline,
  "grid-margins": GridMargins,
  "type-scale": TypeScale,
  "type-measure": TypeMeasure,
  "type-hierarchy": TypeHierarchy,
  "comp-placement": CompPlacement,
  "comp-balance": CompBalance,
  "comp-contrast": CompContrast,
  "motion-easing": MotionEasing,
  "motion-duration": MotionDuration,
  "motion-stagger": MotionStagger,
};
