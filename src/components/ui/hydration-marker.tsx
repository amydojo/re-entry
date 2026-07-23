"use client";

export function HydrationMarker() {
  return (
    <span
      hidden
      data-hydration-marker
      ref={() => {
        document.documentElement.dataset.hydrated = "true";
      }}
    />
  );
}
