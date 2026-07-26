"use client";

import {
  IconBus,
  IconCategory,
  IconDots,
  IconHeart,
  IconHome,
  IconMovie,
  IconReceipt,
  IconShoppingBag,
  IconToolsKitchen2,
} from "@tabler/icons-react";
import type { CSSProperties, ComponentType } from "react";

type IconProps = {
  size?: number;
  className?: string;
  style?: CSSProperties;
  stroke?: number;
};

const map: Record<string, ComponentType<IconProps>> = {
  "tools-kitchen-2": IconToolsKitchen2,
  bus: IconBus,
  "shopping-bag": IconShoppingBag,
  receipt: IconReceipt,
  heart: IconHeart,
  movie: IconMovie,
  home: IconHome,
  dots: IconDots,
  category: IconCategory,
};

export function CategoryIcon({
  name,
  size = 24,
  className,
  color,
}: {
  name: string;
  size?: number;
  className?: string;
  color?: string;
}) {
  const Icon = map[name] ?? IconCategory;
  return (
    <Icon
      size={size}
      className={className}
      style={color ? { color } : undefined}
      stroke={1.75}
    />
  );
}

export const CATEGORY_ICON_OPTIONS = Object.keys(map);
