// Assembles the eight node kinds into the registry lib/postgraph.ts's
// runtime edge (`import { NODE_KINDS } from "@/components/postlab/nodes"`,
// at the bottom of that file) reaches for. Listed in the same order as
// postgraph.ts's NODE_KINDS_LIST, cosmetic but keeps the two easy to eyeball
// against each other.

import type { NodeKind, NodeKindImpl } from "@/lib/postgraph";
import field from "./field";
import photo from "./photo";
import type_ from "./type";
import shape from "./shape";
import kinetic from "./kinetic";
import filter from "./filter";
import mix from "./mix";
import frame from "./frame";
import showreel from "./showreel";

export const NODE_KINDS: Record<NodeKind, NodeKindImpl> = {
  field,
  photo,
  type: type_,
  shape,
  kinetic,
  filter,
  mix,
  frame,
  showreel,
};
