import { useEffect, useState } from "react";

type Props = {
  baseTilePrefix: string;
  overlayTilePrefix: string | null;
  widthPts: number;
  heightPts: number;
  authHeader?: string | null;
  opacity: number;
};

/**
 * Simple red/blue overlay: base revision in blue tint, overlay revision in red tint.
 */
export default function OverlayCompare({
  baseTilePrefix,
  overlayTilePrefix,
  widthPts,
  heightPts,
  authHeader,
  opacity,
}: Props) {
  const [baseUrl, setBaseUrl] = useState<string | null>(null);
  const [overlayUrl, setOverlayUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load(prefix: string, setter: (u: string) => void) {
      const key = `${prefix}/0/0/0.webp`;
      const res = await fetch(`/api/storage/object/${encodeURIComponent(key)}`, {
        headers: authHeader ? { Authorization: authHeader } : {},
        credentials: "include",
      });
      if (!res.ok) return;
      const blob = await res.blob();
      if (!cancelled) setter(URL.createObjectURL(blob));
    }
    void load(baseTilePrefix, setBaseUrl);
    if (overlayTilePrefix) void load(overlayTilePrefix, setOverlayUrl);
    return () => {
      cancelled = true;
    };
  }, [baseTilePrefix, overlayTilePrefix, authHeader]);

  const aspect = heightPts / widthPts;

  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-slate-700 bg-slate-900" style={{ paddingTop: `${aspect * 100}%` }}>
      {baseUrl && (
        <img
          src={baseUrl}
          alt="Base revision"
          className="absolute inset-0 h-full w-full object-contain"
          style={{ filter: "sepia(1) hue-rotate(180deg) saturate(3)", opacity: 0.85 }}
        />
      )}
      {overlayUrl && (
        <img
          src={overlayUrl}
          alt="Overlay revision"
          className="absolute inset-0 h-full w-full object-contain"
          style={{ filter: "sepia(1) hue-rotate(-50deg) saturate(4)", opacity }}
        />
      )}
      <div className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-1 text-[10px] text-white">
        Blue = base · Red = compare · opacity {Math.round(opacity * 100)}%
      </div>
    </div>
  );
}
