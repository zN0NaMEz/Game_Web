// ============================================
// SHARED POSE / SPELL DATA
// Used by both the landing page (HomePage) and the game (PoseWallGame)
// so the "how to play" gallery always matches what the AI detects in-game.
// ============================================

export type PoseKey = 'Two hand' | 'one side' | 'one leg up' | 'tree';

export interface PoseInfo {
  key: PoseKey;
  /** Flavor name shown on gates / hero copy, e.g. "โล่เวทพลังคู่" */
  spell: string;
  /** Plain instruction telling the player what to physically do */
  label: string;
  short: string;
  aliases: string[];
  points: number;
  accent: string;
  icon: string;
  color: string;
  glow: string;
}

export const POSES: Record<PoseKey, PoseInfo> = {
  'Two hand': {
    key: 'Two hand',
    spell: 'โล่เวทพลังคู่',
    label: 'ยกสองมือ',
    short: 'TWO HAND',
    aliases: ['two hand', 'two hands', 'สองมือ', 'ยกสองมือ', 'class 1', 'pose1', 'pose 1'],
    points: 100,
    accent: '#00e5ff',
    icon: '🙌',
    color: '#00e5ff',
    glow: 'rgba(0,229,255,0.4)',
  },
  'one side': {
    key: 'one side',
    spell: 'ดาบสายลมเฉียง',
    label: 'เอียงข้าง',
    short: 'ONE SIDE',
    aliases: ['one side', 'oneside', 'ข้างเดียว', 'เอียงข้าง', 'class 2', 'pose2', 'pose 2'],
    points: 150,
    accent: '#ff477e',
    icon: '🤾',
    color: '#ff477e',
    glow: 'rgba(255,71,126,0.4)',
  },
  'one leg up': {
    key: 'one leg up',
    spell: 'ยืนหนึ่งอัคคี',
    label: 'ยกขาข้างเดียว',
    short: 'LEG UP',
    aliases: ['one leg up', 'oneleg up', 'one leg', 'ขาเดียว', 'ยกขาข้างเดียว', 'class 3', 'pose3', 'pose 3'],
    points: 150,
    accent: '#76ff03',
    icon: '🦩',
    color: '#76ff03',
    glow: 'rgba(118,255,3,0.4)',
  },
  tree: {
    key: 'tree',
    spell: 'ต้นไม้แห่งชีวิต',
    label: 'ท่าต้นไม้',
    short: 'TREE',
    aliases: ['tree', 'tree pose', 'ต้นไม้', 'ท่าต้นไม้', 'class 4', 'pose4', 'pose 4'],
    points: 150,
    accent: '#ffab00',
    icon: '🙆',
    color: '#ffab00',
    glow: 'rgba(255,171,0,0.4)',
  },
};

export const POSE_ORDER: PoseKey[] = ['Two hand', 'one side', 'one leg up', 'tree'];

// ============================================
// HELPERS
// ============================================
export function normalizeLabel(value: string) {
  return value.trim().toLowerCase().replace(/[_-]+/g, ' ');
}

export function matchModelLabel(label: string): PoseKey | null {
  const normalized = normalizeLabel(label);
  for (const poseKey of POSE_ORDER) {
    const pose = POSES[poseKey];
    if (pose.aliases.some((alias) => normalized === normalizeLabel(alias))) {
      return poseKey;
    }
  }
  return null;
}

export function buildLabelMap(labels: string[]): Record<string, PoseKey> {
  const map: Record<string, PoseKey> = {};
  const used = new Set<PoseKey>();
  labels.forEach((label) => {
    const matched = matchModelLabel(label);
    if (matched && !used.has(matched)) {
      map[label] = matched;
      used.add(matched);
    }
  });
  const remaining = POSE_ORDER.filter((k) => !used.has(k));
  let cursor = 0;
  labels.forEach((label) => {
    if (!map[label] && cursor < remaining.length) {
      map[label] = remaining[cursor++];
    }
  });
  return map;
}

export function randomPose(prev?: PoseKey): PoseKey {
  const c = POSE_ORDER.filter((k) => k !== prev);
  return c[Math.floor(Math.random() * c.length)];
}

// ============================================
// SILHOUETTE SVG PATHS
// ============================================
export const SILHOUETTE_PATHS: Record<PoseKey, string[]> = {
  // T-pose: arms straight out to the sides, legs planted shoulder-width apart.
  'Two hand': [
    'M80 30 C65 30 55 40 55 55 C55 70 65 80 80 80 C95 80 105 70 105 55 C105 40 95 30 80 30 Z',
    'M80 80 L80 130',
    'M80 88 L45 85 L15 82',
    'M80 88 L115 85 L145 82',
    'M80 130 L60 180 L50 180',
    'M80 130 L100 180 L110 180',
  ],
  // Torso twisted to one side, both arms reaching out the same direction.
  'one side': [
    'M80 35 C68 35 60 45 60 58 C60 70 68 78 80 78 C92 78 100 70 100 58 C100 45 92 35 80 35 Z',
    'M80 78 L80 125',
    'M80 86 L120 80 L152 74',
    'M80 86 L112 100 L142 112',
    'M80 125 L70 175 L62 175',
    'M80 125 L92 175 L98 175',
  ],
  // Arms out in a T, standing on one leg with the other knee bent and tucked in.
  'one leg up': [
    'M80 32 C68 32 58 42 58 55 C58 68 68 76 80 76 C92 76 102 68 102 55 C102 42 92 32 80 32 Z',
    'M80 76 L80 120',
    'M80 84 L45 81 L15 78',
    'M80 84 L115 81 L145 78',
    'M80 120 L72 175 L65 178',
    'M80 120 L100 135 L85 150',
  ],
  // Arms bend overhead with hands meeting above the head, legs together.
  tree: [
    'M80 30 C68 30 60 40 60 52 C60 64 68 72 80 72 C92 72 100 64 100 52 C100 40 92 30 80 30 Z',
    'M80 72 L80 118',
    'M80 76 L50 40 L68 18',
    'M80 76 L110 40 L92 18',
    'M80 118 L74 178 L68 180',
    'M80 118 L86 178 L92 180',
  ],
};

export function Silhouette({ pose, size = 200 }: { pose: PoseKey; size?: number }) {
  const paths = SILHOUETTE_PATHS[pose];
  return (
    <svg width={size} height={size * 1.3} viewBox="0 0 160 210" style={{ display: 'block' }}>
      <g fill="none" stroke={POSES[pose].color} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
        {paths.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
    </svg>
  );
}
