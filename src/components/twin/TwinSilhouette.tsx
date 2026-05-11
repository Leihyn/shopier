"use client";

import { Undertone } from "@/lib/solana";
import { useTweenedTwin } from "@/lib/useTweenedTwin";

/**
 * Parametric SVG silhouette of the user's digital twin.
 *
 * v2: 9-head fashion-illustration proportions, integrated neck, tapered legs,
 * arms hanging at sides, subtle vertical gradient for dimension, more
 * pronounced body-archetype differentiation.
 *
 * No facial features (privacy by design). All math deterministic from inputs.
 */

interface SilhouetteTwin {
  heightCm: number;
  weightKg?: number;
  chestCm: number;
  waistCm: number;
  hipCm: number;
  inseamCm: number;
  shoulderCm: number;
  undertone: Undertone;
  skinTone: number; // 1-10
}

// Monk Skin Tone Scale (10 swatches, light → dark).
const MONK_SCALE = [
  "#F6E0CB", "#E5C8A8", "#D9AC83", "#C99366", "#B07C53",
  "#946845", "#7A5538", "#5F412A", "#42301F", "#2A1E14",
];

// Soft tint applied as a vertical gradient over the figure for warm/cool/neutral undertones.
const UNDERTONE_TINT: Record<Undertone, string> = {
  [Undertone.Cool]: "#A4C2E8",
  [Undertone.Warm]: "#F0C97A",
  [Undertone.Neutral]: "#FFFFFF",
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function darken(hex: string, amount: number): string {
  // amount 0..1, where 0 = same, 1 = black
  const m = hex.match(/^#([0-9a-f]{6})$/i);
  if (!m) return hex;
  const num = parseInt(m[1], 16);
  let r = (num >> 16) & 0xff;
  let g = (num >> 8) & 0xff;
  let b = num & 0xff;
  r = Math.max(0, Math.round(r * (1 - amount)));
  g = Math.max(0, Math.round(g * (1 - amount)));
  b = Math.max(0, Math.round(b * (1 - amount)));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

function skinFill(tone: number): string {
  return MONK_SCALE[clamp(Math.round(tone) - 1, 0, 9)];
}

type BodyShape =
  | "rectangle"
  | "hourglass"
  | "pear"
  | "inverted-triangle"
  | "apple";

function deriveShape(t: SilhouetteTwin): BodyShape {
  const cwDiff = t.chestCm - t.waistCm;
  const hwDiff = t.hipCm - t.waistCm;
  const chDiff = t.chestCm - t.hipCm;
  if (chDiff > 7) return "inverted-triangle";
  if (chDiff < -7) return "pear";
  const minTaper = Math.min(cwDiff, hwDiff);
  if (cwDiff > 18 && hwDiff > 18) return "hourglass";
  if (minTaper < 6) return "apple";
  return "rectangle";
}

export interface GarmentMarker {
  /** Category of the garment — drives default position */
  category: "top" | "bottom" | "shoes" | "outerwear" | "accessory" | "other";
  /** Free-text label rendered next to the marker (e.g. "Cream Wool Overshirt") */
  label: string;
  /** Optional fit hint like "mid-thigh", "ankle break", "high-rise" — refines the y position */
  fitHint?: string;
}

interface SilhouetteProps {
  twin: SilhouetteTwin;
  size?: number;
  className?: string;
  showLabel?: boolean;
  outlineOnly?: boolean;
  /** When provided, renders a second figure beside this one for comparison */
  compareTo?: SilhouetteTwin;
  compareLabel?: string;
  /** When provided, renders horizontal markers showing where decomposed garments land */
  garmentOverlay?: GarmentMarker[];
  /** Disable the tween animation (useful for static screenshots) */
  noAnimation?: boolean;
}

export default function TwinSilhouette({
  twin: rawTwin,
  size = 320,
  className,
  showLabel = false,
  outlineOnly = false,
  compareTo,
  compareLabel,
  garmentOverlay,
  noAnimation = false,
}: SilhouetteProps) {
  const tweened = useTweenedTwin(rawTwin);
  const twin = noAnimation ? rawTwin : tweened;
  const shape = deriveShape(twin);
  const skin = skinFill(twin.skinTone);
  const skinShadow = darken(skin, 0.18);
  const tint = UNDERTONE_TINT[twin.undertone];

  // 9-head fashion-illustration proportions. ViewBox 100x230.
  const VB_W = 100;
  const VB_H = 230;
  const cx = 50;
  const TOP = 6;

  // Head — 22-unit tall, slightly oval (W < H for naturalism)
  const headR = 11;
  const headCy = TOP + headR;
  const headBottom = headCy + headR;

  // Vertical landmarks (in viewBox units)
  const shoulderY = headBottom + 7;     // narrow neck region
  const bustY = shoulderY + 22;
  const waistY = bustY + 24;
  const hipY = waistY + 24;
  const crotchY = hipY + 6;
  const kneeY = crotchY + 50;
  const ankleY = TOP + 220;

  // Width derivation
  // We treat circumference as roughly 2.5–2.7× projected width (ellipse approx).
  // Visually amplify shape-archetype differences so the figure reads from across the room.
  const verticalScale = 200 / 175;
  const widthFactor = 0.40;

  let halfShoulder = clamp(twin.shoulderCm * verticalScale * 0.55, 14, 32);
  let halfChest = clamp((twin.chestCm * widthFactor * verticalScale) / 2, 10, 28);
  let halfWaist = clamp((twin.waistCm * widthFactor * verticalScale) / 2, 7, 26);
  let halfHip = clamp((twin.hipCm * widthFactor * verticalScale) / 2, 10, 30);

  // Archetype amplification — push the differences harder so each shape reads
  switch (shape) {
    case "hourglass":
      halfWaist *= 0.74;
      halfChest *= 1.04;
      halfHip *= 1.04;
      break;
    case "pear":
      halfHip *= 1.1;
      halfChest *= 0.92;
      halfShoulder = Math.min(halfShoulder, halfChest * 1.05);
      break;
    case "inverted-triangle":
      halfShoulder = Math.max(halfShoulder, halfChest * 1.18);
      halfChest *= 1.08;
      halfHip *= 0.92;
      break;
    case "apple":
      halfWaist *= 1.06;
      halfChest *= 1.02;
      break;
    case "rectangle":
      // gentle taper preserved; amplify slight waist
      halfWaist *= 0.92;
      break;
  }

  // Neck width — narrower than shoulders, integrated smoothly
  const halfNeck = clamp(halfShoulder * 0.32, 3.5, 6);

  // Build the body silhouette as a single closed path.
  // Order: top-left of neck → out to left shoulder → curve to bust →
  //        in to waist → out to hip → down outer left leg → across foot →
  //        up inner left leg to crotch → tiny bridge → down inner right leg →
  //        across foot → up outer right leg → out to hip → curve up bust →
  //        right shoulder → top-right of neck → close
  const innerLegHalfTop = halfHip * 0.32;
  const outerLegHalfTop = halfHip * 0.78;
  const halfKnee = halfHip * 0.34;
  const halfAnkle = halfHip * 0.18;
  const innerCrotchHalf = 1.0; // tiny gap between legs

  const torsoPath = [
    // Start at neck, top-left corner
    `M ${cx - halfNeck} ${headBottom + 1}`,
    // Curve out to left shoulder
    `C ${cx - halfNeck - 1} ${headBottom + 4}, ${cx - halfShoulder + 1} ${shoulderY - 4}, ${cx - halfShoulder} ${shoulderY}`,
    // Smooth curve from shoulder to bust (slight outward bow)
    `C ${cx - halfShoulder - 1} ${shoulderY + 8}, ${cx - halfChest - 1} ${bustY - 8}, ${cx - halfChest} ${bustY}`,
    // Bust to waist (in)
    `C ${cx - halfChest + 1} ${bustY + 9}, ${cx - halfWaist - 1} ${waistY - 9}, ${cx - halfWaist} ${waistY}`,
    // Waist to hip (out)
    `C ${cx - halfWaist - 1} ${waistY + 9}, ${cx - halfHip - 1} ${hipY - 9}, ${cx - halfHip} ${hipY}`,
    // Hip to outer-leg top (slight curve into thigh)
    `C ${cx - halfHip - 0.5} ${hipY + 4}, ${cx - outerLegHalfTop} ${crotchY + 6}, ${cx - outerLegHalfTop} ${crotchY + 8}`,
    // Outer left leg: curve down to knee, then ankle, then foot
    `C ${cx - outerLegHalfTop - 0.5} ${kneeY - 30}, ${cx - halfKnee - 1} ${kneeY - 4}, ${cx - halfKnee} ${kneeY}`,
    `C ${cx - halfKnee - 0.5} ${kneeY + 18}, ${cx - halfAnkle - 1} ${ankleY - 8}, ${cx - halfAnkle} ${ankleY}`,
    // Foot: slight outward toe
    `L ${cx - halfAnkle * 1.9} ${ankleY + 5}`,
    `L ${cx - halfAnkle * 0.4} ${ankleY + 5}`,
    // Inner left leg: ankle up to crotch
    `C ${cx - 0.6} ${ankleY - 8}, ${cx - innerLegHalfTop} ${kneeY + 5}, ${cx - innerLegHalfTop} ${kneeY}`,
    `C ${cx - innerLegHalfTop} ${kneeY - 18}, ${cx - innerCrotchHalf} ${crotchY + 8}, ${cx - innerCrotchHalf} ${crotchY + 4}`,
    // Tiny crotch bridge
    `L ${cx + innerCrotchHalf} ${crotchY + 4}`,
    // Inner right leg: crotch down to ankle
    `C ${cx + innerLegHalfTop} ${crotchY + 8}, ${cx + innerLegHalfTop} ${kneeY - 18}, ${cx + innerLegHalfTop} ${kneeY}`,
    `C ${cx + innerLegHalfTop} ${kneeY + 5}, ${cx + 0.6} ${ankleY - 8}, ${cx + halfAnkle * 0.4} ${ankleY + 5}`,
    // Foot
    `L ${cx + halfAnkle * 1.9} ${ankleY + 5}`,
    `L ${cx + halfAnkle} ${ankleY}`,
    // Outer right leg up
    `C ${cx + halfAnkle + 1} ${ankleY - 8}, ${cx + halfKnee + 0.5} ${kneeY + 18}, ${cx + halfKnee} ${kneeY}`,
    `C ${cx + halfKnee + 1} ${kneeY - 4}, ${cx + outerLegHalfTop + 0.5} ${kneeY - 30}, ${cx + outerLegHalfTop} ${crotchY + 8}`,
    // Outer right leg back to hip
    `C ${cx + outerLegHalfTop} ${crotchY + 6}, ${cx + halfHip + 0.5} ${hipY + 4}, ${cx + halfHip} ${hipY}`,
    // Hip up to waist
    `C ${cx + halfHip + 1} ${hipY - 9}, ${cx + halfWaist + 1} ${waistY + 9}, ${cx + halfWaist} ${waistY}`,
    // Waist up to bust
    `C ${cx + halfWaist + 1} ${waistY - 9}, ${cx + halfChest + 1} ${bustY + 9}, ${cx + halfChest} ${bustY}`,
    // Bust to right shoulder
    `C ${cx + halfChest + 1} ${bustY - 8}, ${cx + halfShoulder + 1} ${shoulderY + 8}, ${cx + halfShoulder} ${shoulderY}`,
    // Right shoulder to neck
    `C ${cx + halfShoulder - 1} ${shoulderY - 4}, ${cx + halfNeck + 1} ${headBottom + 4}, ${cx + halfNeck} ${headBottom + 1}`,
    "Z",
  ].join(" ");

  // Arms — render as separate paths for cleaner control
  // Each arm: shoulder point → elbow (waist height, slightly inward of shoulder) → wrist (hip height, just outside hip) → hand stub
  function armPath(side: "L" | "R") {
    const sign = side === "L" ? -1 : 1;
    const shoulderX = cx + sign * (halfShoulder - 0.5);
    const shoulderArmY = shoulderY + 1;
    const elbowX = cx + sign * (halfShoulder + 1.5);
    const elbowY = waistY + 2;
    const wristX = cx + sign * (halfHip * 0.85);
    const wristY = hipY + 8;
    const handTipX = cx + sign * (halfHip * 0.78);
    const handTipY = hipY + 17;

    // Outer side path then inner side back up (closed)
    const armWidthShoulder = halfShoulder * 0.18;
    const armWidthElbow = halfShoulder * 0.13;
    const armWidthWrist = halfShoulder * 0.10;

    return [
      `M ${shoulderX + sign * armWidthShoulder} ${shoulderArmY}`,
      // Outer
      `C ${elbowX + sign * armWidthElbow} ${shoulderArmY + 8}, ${elbowX + sign * armWidthElbow} ${elbowY - 6}, ${elbowX + sign * armWidthElbow} ${elbowY}`,
      `C ${wristX + sign * armWidthWrist} ${elbowY + 6}, ${wristX + sign * armWidthWrist} ${wristY - 4}, ${wristX + sign * armWidthWrist} ${wristY}`,
      // Hand tip (round)
      `L ${handTipX} ${handTipY}`,
      `L ${wristX - sign * armWidthWrist} ${wristY}`,
      // Inner back up
      `C ${wristX - sign * armWidthWrist} ${wristY - 4}, ${elbowX - sign * armWidthElbow * 0.5} ${elbowY + 6}, ${elbowX - sign * armWidthElbow * 0.5} ${elbowY}`,
      `C ${elbowX - sign * armWidthElbow * 0.5} ${elbowY - 6}, ${shoulderX - sign * armWidthShoulder * 0.5} ${shoulderArmY + 8}, ${shoulderX - sign * armWidthShoulder * 0.5} ${shoulderArmY + 1}`,
      "Z",
    ].join(" ");
  }

  const strokeColor = outlineOnly ? "currentColor" : skinShadow;
  const strokeWidth = outlineOnly ? 0.7 : 0.5;
  const fillColor = outlineOnly ? "none" : "url(#twin-skin-grad)";

  // Garment-marker positions (in viewBox y units). Each category maps to a
  // default landmark; fitHint nudges the y offset (mid-thigh, ankle break, etc).
  function markerY(m: GarmentMarker): number {
    const hint = (m.fitHint ?? "").toLowerCase();
    switch (m.category) {
      case "outerwear":
      case "top": {
        // Default: bottom of garment at hip line.
        let y = hipY;
        if (/cropped|crop/.test(hint)) y = waistY - 4;
        else if (/mid[-\s]?thigh/.test(hint)) y = (hipY + kneeY) / 2 - 6;
        else if (/long|knee|maxi/.test(hint)) y = kneeY;
        else if (/waist/.test(hint)) y = waistY;
        return y;
      }
      case "bottom": {
        // Default: ankle break.
        let y = ankleY - 4;
        if (/short|above[-\s]?knee/.test(hint)) y = kneeY - 6;
        else if (/knee|knee[-\s]?length/.test(hint)) y = kneeY + 2;
        else if (/mid[-\s]?calf/.test(hint)) y = (kneeY + ankleY) / 2;
        else if (/cropped|ankle[-\s]?break/.test(hint)) y = ankleY - 8;
        else if (/full[-\s]?length|break/.test(hint)) y = ankleY;
        return y;
      }
      case "shoes":
        return ankleY + 2;
      case "accessory":
        if (/sunglass|hat|cap/.test(hint)) return headCy;
        if (/necklace|chain|scarf/.test(hint)) return shoulderY + 6;
        if (/belt/.test(hint)) return waistY;
        if (/watch|bracelet|ring/.test(hint)) return hipY + 3;
        return waistY;
      default:
        return waistY;
    }
  }

  const garmentColor = "rgba(120,120,120,0.85)";
  const garmentTextColor = "rgba(60,60,60,0.95)";
  const markerXMargin = 4;

  // Side-by-side compose: render the secondary figure as a sibling outline.
  // Recursively reuses this component but with outlineOnly + smaller size.
  const compareEl = compareTo ? (
    <div className="flex flex-col items-center">
      <TwinSilhouette
        twin={compareTo}
        size={size}
        outlineOnly
        noAnimation
      />
      {compareLabel && (
        <p className="mt-1 text-center text-[10px] uppercase tracking-wider text-muted-foreground">
          {compareLabel}
        </p>
      )}
    </div>
  ) : null;

  return (
    <div className={className}>
      <div className={compareEl ? "flex items-end gap-3" : ""}>
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        width={size * 0.5}
        height={size}
        preserveAspectRatio="xMidYMid meet"
        aria-label={`Twin silhouette: ${shape}, skin tone ${twin.skinTone}, ${Undertone[twin.undertone]?.toLowerCase() ?? "neutral"} undertone`}
      >
        <defs>
          {/* Vertical skin gradient — slightly lighter at top, slightly shaded at bottom */}
          <linearGradient id="twin-skin-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={skin} />
            <stop offset="65%" stopColor={skin} />
            <stop offset="100%" stopColor={darken(skin, 0.08)} />
          </linearGradient>
          {/* Undertone tint as soft overlay */}
          <linearGradient id="twin-undertone-tint" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={tint} stopOpacity="0.0" />
            <stop offset="100%" stopColor={tint} stopOpacity="0.16" />
          </linearGradient>
        </defs>

        {/* Arms (drawn under torso) */}
        <path d={armPath("L")} fill={fillColor} stroke={strokeColor} strokeWidth={strokeWidth} strokeLinejoin="round" />
        <path d={armPath("R")} fill={fillColor} stroke={strokeColor} strokeWidth={strokeWidth} strokeLinejoin="round" />

        {/* Torso + legs (single path) */}
        <path
          d={torsoPath}
          fill={fillColor}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
        />

        {/* Head */}
        <ellipse
          cx={cx}
          cy={headCy}
          rx={headR}
          ry={headR * 1.15}
          fill={fillColor}
          stroke={strokeColor}
          strokeWidth={strokeWidth + 0.1}
        />

        {/* Undertone tint overlay (skips when neutral) */}
        {!outlineOnly && twin.undertone !== Undertone.Neutral && (
          <rect
            x="0"
            y="0"
            width={VB_W}
            height={VB_H}
            fill="url(#twin-undertone-tint)"
            pointerEvents="none"
          />
        )}

        {/* Garment overlay — horizontal markers + labels */}
        {garmentOverlay?.map((m, i) => {
          const y = markerY(m);
          const labelSide = i % 2 === 0 ? "right" : "left";
          const lineX1 = labelSide === "right" ? cx + halfHip + 1 : cx - halfHip - 1;
          const lineX2 = labelSide === "right" ? VB_W - markerXMargin : markerXMargin;
          const dotX = labelSide === "right" ? cx + halfHip + 0.5 : cx - halfHip - 0.5;
          const textX = labelSide === "right" ? lineX2 : lineX2;
          return (
            <g key={i}>
              {/* dot anchor on body */}
              <circle cx={dotX} cy={y} r={0.9} fill={garmentColor} />
              {/* leader line */}
              <line
                x1={lineX1}
                y1={y}
                x2={lineX2}
                y2={y}
                stroke={garmentColor}
                strokeWidth={0.4}
                strokeDasharray="1.2 1.2"
              />
              {/* label */}
              <text
                x={textX}
                y={y - 1}
                fontSize="3.4"
                fontWeight="500"
                fill={garmentTextColor}
                textAnchor={labelSide === "right" ? "end" : "start"}
              >
                {m.label.length > 28 ? `${m.label.slice(0, 26)}…` : m.label}
              </text>
            </g>
          );
        })}
      </svg>
      {compareEl}
      </div>
      {showLabel && (
        <p className="mt-2 text-center text-[10px] uppercase tracking-wider text-muted-foreground">
          {shape.replace("-", " ")} · skin {twin.skinTone}/10 · {Undertone[twin.undertone]?.toLowerCase()}
        </p>
      )}
    </div>
  );
}

export { type SilhouetteTwin, type BodyShape, deriveShape };
