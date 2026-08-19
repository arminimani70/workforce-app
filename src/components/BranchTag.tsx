import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colorForBranch } from '../theme/colors';

// A small colored pill for a branch — every branch gets a consistent color via colorForBranch
// (hashed from its name), so the same branch always renders the same color everywhere it shows
// up (Schedule, Build Schedule, Time Clock), making it easy to spot at a glance which branch a
// shift or person belongs to. `label` overrides what text is shown (e.g. "Downtown ·
// Front Desk") while the color still comes from `jobSite` alone, so a combined label still
// gets the right branch's color.
export function BranchTag({ jobSite, label }: { jobSite: string; label?: string }) {
  const color = colorForBranch(jobSite);
  return (
    <View style={[styles.tag, { backgroundColor: `${color}1a`, borderColor: color }]}>
      <Text style={[styles.text, { color }]}>{label ?? jobSite}</Text>
    </View>
  );
}

// A compact stand-in for BranchTag in dense lists (e.g. "Working Today") where a full pill per
// row would be too heavy — just a colored dot before the name, same color as that branch's tag
// everywhere else.
export function BranchDot({ jobSite }: { jobSite: string }) {
  return <View style={[styles.dot, { backgroundColor: colorForBranch(jobSite) }]} />;
}

const styles = StyleSheet.create({
  tag: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  text: { fontSize: 11, fontWeight: '700' },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 999,
  },
});
