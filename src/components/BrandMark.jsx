import { MARK_LAYERS, MARK_RADIUS, MARK_SCALE_SMALL, MARK_SIZE, MARK_TILE, MARK_TRANSFORM } from "./brandMarkArt";

// The Kiliforma mark: a "K" built as a gold roof truss with white rivets,
// crossed by a green leaf, on a dark forest-green tile. The artwork lives in
// brandMarkArt.js, shared with the favicon and the home-screen icons so they
// cannot drift apart.
//
// Colours are fixed: the mark must look the same wherever it appears, on
// white, on the cream landing page and on the green bands.
export default function BrandMark({ size = 36, title = "Kiliforma", className }) {
  const centre = MARK_SIZE / 2;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${MARK_SIZE} ${MARK_SIZE}`}
      className={className}
      role={title ? "img" : undefined}
      aria-label={title || undefined}
      aria-hidden={title ? undefined : true}
      style={{ display: "block", flexShrink: 0 }}
    >
      <rect width={MARK_SIZE} height={MARK_SIZE} rx={MARK_RADIUS} fill={MARK_TILE} />
      <g transform={`translate(${centre} ${centre}) scale(${MARK_SCALE_SMALL}) translate(-${centre} -${centre})`}>
        <g transform={MARK_TRANSFORM}>
          {MARK_LAYERS.map(layer => (
            <path key={layer.colour} fill={layer.colour} d={layer.d} />
          ))}
        </g>
      </g>
    </svg>
  );
}

// The mark with the name beside it, for navigation bars and sign-in.
// `tone="light"` is for dark backgrounds. The name is split Ki/li/forma so
// the last syllable can carry the brand green, as it does on the landing page.
export function BrandLockup({ size = 36, tone = "dark", className }) {
  const ink = tone === "light" ? "#ffffff" : "#111827";
  const second = tone === "light" ? "#86efac" : "#15803d";
  return (
    <span className={className} style={{ display: "inline-flex", alignItems: "center", gap: Math.round(size * 0.28) }}>
      <BrandMark size={size} title="" />
      <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.05, fontWeight: 700, fontSize: Math.round(size * 0.44), letterSpacing: "-0.02em" }}>
        <span style={{ color: ink }}>Kili</span>
        <span style={{ color: second }}>forma</span>
      </span>
    </span>
  );
}
