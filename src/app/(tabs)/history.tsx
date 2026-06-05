import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, ScrollView, View, Pressable, Platform, Alert } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import Svg, { Path, Circle, Line } from 'react-native-svg';
import { useTheme } from '../../hooks/use-theme';
import { ThemedText } from '../../components/themed-text';
import { ThemedView } from '../../components/themed-view';
import { StorageService, DriveSession } from '../../services/storage-service';
import { Spacing } from '../../constants/theme';

export default function HistoryScreen() {
  const theme = useTheme();
  const router = useRouter();

  const [history, setHistory] = useState<DriveSession[]>([]);
  const [stats, setStats] = useState<any>(null);

  // Reload history whenever the tab gains focus
  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [])
  );

  const loadHistory = async () => {
    const list = await StorageService.getHistory();
    const aggStats = await StorageService.getAggregatedStats();
    setHistory(list);
    setStats(aggStats);
  };

  const confirmClear = () => {
    if (Platform.OS === 'web') {
      if (confirm('Clear all driving history?')) {
        clearHistory();
      }
    } else {
      Alert.alert(
        'Clear History',
        'Are you sure you want to delete all historical drives? This cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete All', style: 'destructive', onPress: clearHistory },
        ]
      );
    }
  };

  const clearHistory = async () => {
    await StorageService.clearHistory();
    loadHistory();
  };

  const formatDate = (isoString: string): string => {
    const date = new Date(isoString);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (sec: number): string => {
    const mins = Math.floor(sec / 60);
    if (mins < 1) return `${sec}s`;
    return `${mins}m ${sec % 60}s`;
  };

  // Render SVG Line Chart of Scores Trend
  const renderTrendChart = () => {
    if (history.length < 2) return null;

    // Last 7 sessions, reversed for chronological order (left to right)
    const recentSessions = [...history.slice(0, 7)].reverse();
    const width = 300;
    const height = 70;

    let pathD = '';
    const points: { x: number; y: number; score: number }[] = [];

    recentSessions.forEach((session, i) => {
      const x = (i / (recentSessions.length - 1)) * (width - 20) + 10;
      // Score ranges 0 - 100. Map to Y. (Score 100 -> top, Score 50 -> bottom)
      const scoreScale = Math.max(40, session.score); // Clamp bottom scale to 40 for graph visual
      const y = height - ((scoreScale - 40) / 60) * (height - 20) - 10;
      points.push({ x, y, score: session.score });

      if (i === 0) {
        pathD += `M ${x} ${y}`;
      } else {
        pathD += ` L ${x} ${y}`;
      }
    });

    return (
      <View style={[styles.chartContainer, { borderColor: theme.border }]}>
        <ThemedText style={styles.chartTitle}>Score Progression Trend</ThemedText>
        <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
          {/* Median line (score 80) */}
          <Line
            x1="0"
            y1={height - ((80 - 40) / 60) * (height - 20) - 10}
            x2={width}
            y2={height - ((80 - 40) / 60) * (height - 20) - 10}
            stroke={theme.border}
            strokeWidth="0.8"
            strokeDasharray="4 4"
          />
          {/* Trend line */}
          <Path d={pathD} fill="none" stroke={theme.primary} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          {/* Dots */}
          {points.map((pt, idx) => (
            <Circle key={idx} cx={pt.x} cy={pt.y} r="4.5" fill={theme.primary} stroke="#FFFFFF" strokeWidth="1.5" />
          ))}
        </Svg>
      </View>
    );
  };

  if (!stats) {
    return (
      <View style={[styles.loaderContainer, { backgroundColor: theme.background }]}>
        <ThemedText themeColor="textSecondary">Loading history data...</ThemedText>
      </View>
    );
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={[styles.container, { paddingBottom: Spacing.seven }]}
      style={{ backgroundColor: theme.background }}
    >
      {/* Historical statistics dashboard */}
      {history.length > 0 ? (
        <>
          <View style={styles.statsOverview}>
            <ThemedView type="backgroundElement" style={styles.statBox}>
              <ThemedText type="small" themeColor="textSecondary">AVG SCORE</ThemedText>
              <ThemedText type="title" style={{ color: stats.averageScore >= 85 ? theme.success : theme.warning, fontSize: 32 }}>
                {stats.averageScore}
              </ThemedText>
            </ThemedView>
            <ThemedView type="backgroundElement" style={styles.statBox}>
              <ThemedText type="small" themeColor="textSecondary">TOTAL DISTANCE</ThemedText>
              <ThemedText type="bold" style={styles.statBoxVal}>
                {(stats.totalDuration * 0.012).toFixed(1)} km
              </ThemedText>
            </ThemedView>
            <ThemedView type="backgroundElement" style={styles.statBox}>
              <ThemedText type="small" themeColor="textSecondary">TOTAL EVENTS</ThemedText>
              <ThemedText type="bold" style={styles.statBoxVal}>{stats.totalEvents}</ThemedText>
            </ThemedView>
          </View>

          {renderTrendChart()}

          {/* List of past trips */}
          <View style={styles.listSection}>
            <View style={styles.listHeaderRow}>
              <ThemedText type="subtitle" style={styles.listTitle}>
                Driving Log
              </ThemedText>
              <Pressable onPress={confirmClear}>
                <ThemedText type="smallBold" style={{ color: theme.error }}>
                  Wipe Data
                </ThemedText>
              </Pressable>
            </View>

            {history.map((session) => {
              // Score badge colors
              let badgeBg: string = theme.success;
              if (session.score < 70) badgeBg = theme.error;
              else if (session.score < 85) badgeBg = theme.warning;
              else if (session.score < 95) badgeBg = theme.primary;

              return (
                <Pressable
                  key={session.id}
                  onPress={() => router.push(`/summary/${session.id}`)}
                  style={({ pressed }) => [
                    styles.tripItemCard,
                    {
                      backgroundColor: theme.backgroundElement,
                      borderColor: theme.border,
                      opacity: pressed ? 0.9 : 1,
                    },
                  ]}
                >
                  <View style={styles.tripMetaCol}>
                    <ThemedText type="bold" style={styles.tripDate}>
                      {formatDate(session.date)}
                    </ThemedText>
                    <View style={styles.tripDetailsRow}>
                      <ThemedText type="small" themeColor="textSecondary">
                        Duration: {formatDuration(session.duration)}
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">•</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {session.totalEvents} events
                      </ThemedText>
                    </View>
                  </View>

                  <View style={styles.tripScoreCol}>
                    <View style={[styles.scoreBadge, { backgroundColor: badgeBg }]}>
                      <ThemedText style={styles.scoreBadgeText}>{session.score}</ThemedText>
                    </View>
                    <ThemedText type="smallBold" themeColor="textSecondary">
                      {session.rating}
                    </ThemedText>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </>
      ) : (
        /* Empty History State */
        <View style={styles.emptyContainer}>
          <Svg width="64" height="64" viewBox="0 0 24 24" style={styles.emptyIcon}>
            <Circle cx="12" cy="12" r="9" stroke={theme.textSecondary} strokeWidth="1.5" fill="none" />
            <Path d="M12 6v6l4 2" stroke={theme.textSecondary} strokeWidth="1.5" fill="none" />
          </Svg>
          <ThemedText type="bold" style={{ fontSize: 18, marginTop: 12 }}>
            No Drives Recorded Yet
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.emptyDesc}>
            Start a drive session on the Dashboard tab, or run a simulated trip from settings to view driving analysis.
          </ThemedText>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.four,
    gap: Spacing.five,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsOverview: {
    flexDirection: 'row',
    gap: 8,
  },
  statBox: {
    flex: 1,
    borderRadius: 12,
    padding: Spacing.three,
    alignItems: 'center',
    gap: 4,
    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
  },
  statBoxVal: {
    fontSize: 16,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  chartContainer: {
    borderWidth: 1,
    borderRadius: 16,
    padding: Spacing.four,
    backgroundColor: 'rgba(30, 41, 59, 0.3)',
    gap: 8,
    borderCurve: 'continuous',
  },
  chartTitle: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  listSection: {
    gap: 10,
  },
  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  listTitle: {
    fontWeight: '800',
    fontSize: 18,
  },
  tripItemCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.four,
    borderRadius: 14,
    borderWidth: 1,
    borderCurve: 'continuous',
  },
  tripMetaCol: {
    gap: 4,
  },
  tripDate: {
    fontSize: 15,
  },
  tripDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tripScoreCol: {
    alignItems: 'center',
    gap: 4,
  },
  scoreBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreBadgeText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 14,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.eight,
    gap: 4,
  },
  emptyIcon: {
    opacity: 0.6,
  },
  emptyDesc: {
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 260,
    marginTop: 4,
  },
});
