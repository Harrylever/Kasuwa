export * from "./types";
export { foodBuyer } from "./food-buyer";
export { logistics } from "./logistics";
import { foodBuyer } from "./food-buyer";
import { logistics } from "./logistics";
import type { VerticalPack } from "./types";

export const packs: Record<string, VerticalPack> = {
  food_buyer: foodBuyer,
  logistics,
};
