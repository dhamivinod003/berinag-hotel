"use client";

import { useTheme } from "./ThemeProvider";

type ThemedImageProps = {
  kind: "hero" | "room";
  index?: number;
  fallback?: string | null;
  alt: string;
  className?: string;
  priority?: boolean;
  sizes?: string;
  fill?: boolean;
};

export function ThemedImage({
  kind,
  index = 0,
  fallback,
  alt,
  className,
  priority = false,
}: ThemedImageProps) {
  const { definition } = useTheme();
  const src =
    kind === "hero"
      ? definition.heroImage
      : definition.roomImages[index % definition.roomImages.length] ??
        fallback ??
        definition.heroImage;

  return (
    // Native img so full-bleed theme photos are not recompressed by next/image.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className}
      decoding="async"
      draggable={false}
      fetchPriority={priority ? "high" : "auto"}
    />
  );
}

export function useThemedMedia() {
  const { definition } = useTheme();
  return {
    heroImage: definition.heroImage,
    roomImage: (index: number, fallback?: string | null) =>
      definition.roomImages[index % definition.roomImages.length] ??
      fallback ??
      definition.heroImage,
  };
}
