import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { ThemedText } from '../../components/themed-text';
import { ThemedView } from '../../components/themed-view';
import { Spacing } from '../../constants/theme';
import { useTheme } from '../../hooks/use-theme';
import { DriveSession, StorageService } from '../../services/storage-service';

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
					{ text: 'Delete All', style: 'destructive', onPress: clearHistory }
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
			minute: '2-digit'
		});
	};

	const formatDuration = (sec: number): string => {
		const mins = Math.floor(sec / 60);
		if (mins < 1) return `${sec}s`;
		return `${mins}m ${sec % 60}s`;
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
			{history.length > 0 ?
				<>
					<View style={styles.statsOverview}>
						<ThemedView type="backgroundElement" style={styles.statBox}>
							<ThemedText type="small" themeColor="textSecondary">
								AVG SCORE
							</ThemedText>
							<ThemedText
								type="title"
								style={{
									color: stats.averageScore >= 85 ? theme.success : theme.warning,
									fontSize: 32
								}}
							>
								{stats.averageScore}
							</ThemedText>
						</ThemedView>
						<ThemedView type="backgroundElement" style={styles.statBox}>
							<ThemedText type="small" themeColor="textSecondary">
								TOTAL DISTANCE
							</ThemedText>
							<ThemedText type="bold" style={styles.statBoxVal}>
								{(stats.totalDuration * 0.012).toFixed(1)} km
							</ThemedText>
						</ThemedView>
						<ThemedView type="backgroundElement" style={styles.statBox}>
							<ThemedText type="small" themeColor="textSecondary">
								TOTAL EVENTS
							</ThemedText>
							<ThemedText type="bold" style={styles.statBoxVal}>
								{stats.totalEvents}
							</ThemedText>
						</ThemedView>
					</View>

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
											opacity: pressed ? 0.9 : 1
										}
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
											<ThemedText type="small" themeColor="textSecondary">
												•
											</ThemedText>
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
			:	/* Empty History State */
				<View style={styles.emptyContainer}>
					<Svg width="64" height="64" viewBox="0 0 24 24" style={styles.emptyIcon}>
						<Circle
							cx="12"
							cy="12"
							r="9"
							stroke={theme.textSecondary}
							strokeWidth="1.5"
							fill="none"
						/>
						<Path d="M12 6v6l4 2" stroke={theme.textSecondary} strokeWidth="1.5" fill="none" />
					</Svg>
					<ThemedText type="bold" style={{ fontSize: 18, marginTop: 12 }}>
						No Drives Recorded Yet
					</ThemedText>
					<ThemedText type="small" themeColor="textSecondary" style={styles.emptyDesc}>
						Start a drive session on the Dashboard tab, or run a simulated trip from settings to
						view driving analysis.
					</ThemedText>
				</View>
			}
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	container: {
		padding: Spacing.four,
		gap: Spacing.five
	},
	loaderContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center'
	},
	statsOverview: {
		flexDirection: 'row',
		gap: Spacing.two
	},
	statBox: {
		flex: 1,
		borderRadius: 12,
		borderCurve: 'continuous',
		padding: Spacing.three,
		alignItems: 'center',
		gap: 4,
		boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
	},
	statBoxVal: {
		fontSize: 16,
		marginTop: 2,
		fontVariant: ['tabular-nums']
	},
	chartContainer: {
		borderWidth: 1,
		borderRadius: 16,
		padding: Spacing.four,
		backgroundColor: 'rgba(30, 41, 59, 0.3)',
		gap: 8,
		borderCurve: 'continuous'
	},
	chartTitle: {
		fontSize: 12,
		fontWeight: '800',
		textTransform: 'uppercase',
		letterSpacing: 0.8
	},
	listSection: {
		gap: Spacing.one
	},
	listHeaderRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginBottom: 4
	},
	listTitle: {
		fontWeight: '800',
		fontSize: 18
	},
	tripItemCard: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		padding: Spacing.four,
		borderRadius: 14,
		borderCurve: 'continuous',
		borderWidth: 1,
		boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
	},
	tripMetaCol: {
		gap: 4
	},
	tripDate: {
		fontSize: 15
	},
	tripDetailsRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: Spacing.one
	},
	tripScoreCol: {
		alignItems: 'center',
		gap: 4
	},
	scoreBadge: {
		width: 38,
		height: 38,
		borderRadius: 19,
		borderCurve: 'continuous',
		justifyContent: 'center',
		alignItems: 'center'
	},
	scoreBadgeText: {
		color: '#FFFFFF',
		fontWeight: '900',
		fontSize: 14
	},
	emptyContainer: {
		alignItems: 'center',
		justifyContent: 'center',
		paddingVertical: Spacing.eight,
		gap: 4
	},
	emptyIcon: {
		opacity: 0.6
	},
	emptyDesc: {
		textAlign: 'center',
		lineHeight: 18,
		maxWidth: 260,
		marginTop: 4
	}
});
