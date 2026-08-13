export const colors = {
  background: '#f4f6fb',
  surface: '#ffffff',
  border: '#e6e9f0',
  text: '#111827',
  textMuted: '#64748b',
  textFaint: '#9aa3b2',

  primary: '#2563eb',
  primaryDark: '#1d4ed8',
  teal: '#0f766e',
  purple: '#7c3aed',
  amber: '#b45309',
  pink: '#be185d',
  indigo: '#4338ca',
  cyan: '#0891b2',

  success: '#16a34a',
  successBg: '#dcfce7',
  successBorder: '#bbf7d0',
  successText: '#166534',

  danger: '#dc2626',
  dangerBg: '#fee2e2',
  dangerBorder: '#fecaca',
  dangerText: '#991b1b',

  warning: '#f59e0b',
  warningBg: '#fffbeb',
  warningBorder: '#fde68a',
  warningText: '#92400e',

  info: '#2563eb',
  infoBg: '#eff6ff',
  infoBorder: '#bfdbfe',
  infoText: '#1e40af',
};

// Subtle elevation for card-style surfaces, tuned to look right on both iOS (shadow*) and
// Android (elevation).
export const cardShadow = {
  shadowColor: '#0f172a',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.06,
  shadowRadius: 8,
  elevation: 2,
};

// A fixed palette to hash a branch's jobSite string against — jobSite is free text (there's no
// Branch entity in the backend yet), so this is the pragmatic way to give every branch a
// consistent color without a schema change: same name always lands on the same color, and it
// works for however many branches an org ends up with.
const BRANCH_PALETTE = [
  '#2563eb', // blue
  '#0f766e', // teal
  '#7c3aed', // purple
  '#b45309', // amber
  '#be185d', // pink
  '#4338ca', // indigo
  '#0891b2', // cyan
  '#16a34a', // green
  '#c2410c', // orange
  '#9333ea', // violet
];

export function colorForBranch(jobSite: string): string {
  let hash = 0;
  for (let i = 0; i < jobSite.length; i++) {
    hash = (hash * 31 + jobSite.charCodeAt(i)) >>> 0;
  }
  return BRANCH_PALETTE[hash % BRANCH_PALETTE.length];
}
