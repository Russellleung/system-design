import type { PoseTemplate } from "@/lib/photo-coach";

type Point = readonly [number, number];
type PoseShape = {
  head: readonly [number, number, number];
  segments: ReadonlyArray<readonly [Point, Point]>;
  joints: ReadonlyArray<Point>;
};

const poses: Record<Exclude<PoseTemplate, "none">, PoseShape> = {
  "three-quarter": {
    head: [52, 20, 9],
    segments: [
      [[48, 31], [44, 68]], [[48, 39], [30, 55]], [[30, 55], [38, 78]],
      [[48, 39], [65, 51]], [[65, 51], [57, 74]], [[44, 68], [35, 108]],
      [[35, 108], [31, 149]], [[44, 68], [57, 107]], [[57, 107], [66, 146]],
    ],
    joints: [[48, 31], [48, 39], [30, 55], [65, 51], [44, 68], [35, 108], [57, 107], [31, 149], [66, 146]],
  },
  "weight-shift": {
    head: [50, 19, 9],
    segments: [
      [[50, 30], [50, 69]], [[50, 39], [31, 56]], [[31, 56], [24, 82]],
      [[50, 39], [69, 56]], [[69, 56], [72, 82]], [[50, 69], [38, 108]],
      [[38, 108], [29, 149]], [[50, 69], [59, 106]], [[59, 106], [64, 149]],
    ],
    joints: [[50, 30], [50, 39], [31, 56], [69, 56], [50, 69], [38, 108], [59, 106], [29, 149], [64, 149]],
  },
  walking: {
    head: [48, 19, 9],
    segments: [
      [[48, 30], [49, 68]], [[48, 39], [31, 60]], [[31, 60], [23, 84]],
      [[48, 39], [66, 57]], [[66, 57], [75, 78]], [[49, 68], [35, 105]],
      [[35, 105], [20, 144]], [[49, 68], [62, 106]], [[62, 106], [79, 143]],
    ],
    joints: [[48, 30], [48, 39], [31, 60], [66, 57], [49, 68], [35, 105], [62, 106], [20, 144], [79, 143]],
  },
  "seated-angle": {
    head: [46, 19, 9],
    segments: [
      [[46, 30], [48, 69]], [[47, 41], [30, 57]], [[30, 57], [41, 78]],
      [[47, 41], [64, 57]], [[64, 57], [55, 79]], [[48, 69], [36, 94]],
      [[36, 94], [67, 104]], [[67, 104], [76, 142]], [[48, 69], [58, 94]],
      [[58, 94], [36, 112]], [[36, 112], [24, 145]],
    ],
    joints: [[46, 30], [47, 41], [30, 57], [64, 57], [48, 69], [36, 94], [67, 104], [58, 94], [36, 112], [76, 142], [24, 145]],
  },
  "over-shoulder": {
    head: [55, 20, 9],
    segments: [
      [[51, 31], [44, 69]], [[50, 40], [32, 52]], [[32, 52], [27, 76]],
      [[50, 40], [65, 57]], [[65, 57], [59, 80]], [[44, 69], [35, 109]],
      [[35, 109], [28, 149]], [[44, 69], [56, 108]], [[56, 108], [62, 149]],
    ],
    joints: [[51, 31], [50, 40], [32, 52], [65, 57], [44, 69], [35, 109], [56, 108], [28, 149], [62, 149]],
  },
  relaxed: {
    head: [50, 19, 9],
    segments: [
      [[50, 30], [50, 69]], [[50, 40], [35, 57]], [[35, 57], [32, 83]],
      [[50, 40], [65, 57]], [[65, 57], [68, 83]], [[50, 69], [41, 108]],
      [[41, 108], [39, 149]], [[50, 69], [59, 108]], [[59, 108], [61, 149]],
    ],
    joints: [[50, 30], [50, 40], [35, 57], [65, 57], [50, 69], [41, 108], [59, 108], [39, 149], [61, 149]],
  },
};

function Lines({ pose, colour, width }: { pose: PoseShape; colour: string; width: number }) {
  return <>
    <circle cx={pose.head[0]} cy={pose.head[1]} r={pose.head[2]} fill="none" stroke={colour} strokeWidth={width} strokeDasharray="4 4" />
    {pose.segments.map(([from, to], index) => <line key={index} x1={from[0]} y1={from[1]} x2={to[0]} y2={to[1]} stroke={colour} strokeWidth={width} strokeDasharray="5 5" strokeLinecap="round" />)}
    {pose.joints.map(([x, y], index) => <circle key={index} cx={x} cy={y} r={width + 1} fill={colour} />)}
  </>;
}

export function PoseGuide({ template, mirrored }: { template: PoseTemplate; mirrored: boolean }) {
  if (template === "none") return null;
  const pose = poses[template];
  return (
    <svg aria-hidden="true" viewBox="0 0 100 160" preserveAspectRatio="xMidYMid meet" className="pointer-events-none absolute inset-[5%] h-[90%] w-[90%]">
      <g transform={mirrored ? "translate(100 0) scale(-1 1)" : undefined}>
        <Lines pose={pose} colour="rgba(23, 27, 24, .55)" width={4} />
        <Lines pose={pose} colour="#fff8ef" width={1.8} />
      </g>
    </svg>
  );
}
