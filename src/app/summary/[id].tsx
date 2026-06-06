import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { CircularProgress } from '../../components/circular-progress';
import { RouteReplay } from '../../components/route-replay';
import { ThemedText } from '../../components/themed-text';
import { ThemedView } from '../../components/themed-view';
import { Spacing } from '../../constants/theme';
import { useTheme } from '../../hooks/use-theme';
import { DriveSession, StorageService } from '../../services/storage-service';

export default function SummaryScreen() {
	const theme = useTheme();
	const router = useRouter();
	const { id } = useLocalSearchParams<{ id: string }>();

	const [session, setSession] = useState<DriveSession | null>(null);

	useEffect(() => {
		if (id) {
			loadSession();
		}
	}, [id]);

	const loadSession = async () => {
		const data = await StorageService.getDriveById(id);
		setSession(data);
	};

	const confirmDelete = () => {
		if (Platform.OS === 'web') {
			if (confirm('Delete this drive session?')) {
				deleteSession();
			}
		} else {
			Alert.alert('Delete Drive', 'Are you sure you want to delete this trip log from history?', [
				{ text: 'Cancel', style: 'cancel' },
				{ text: 'Delete', style: 'destructive', onPress: deleteSession }
			]);
		}
	};

	const deleteSession = async () => {
		if (session) {
			await StorageService.deleteDrive(session.id);
			router.back();
		}
	};

	const formatDate = (isoString: string): string => {
		const date = new Date(isoString);
		return date.toLocaleDateString(undefined, {
			weekday: 'long',
			month: 'long',
			day: 'numeric',
			year: 'numeric'
		});
	};

	const formatTime = (timestampMs: number): string => {
		const date = new Date(timestampMs);
		return date.toLocaleTimeString(undefined, {
			hour: '2-digit',
			minute: '2-digit'
		});
	};

	const formatDuration = (sec: number): string => {
		const hrs = Math.floor(sec / 3600);
		const mins = Math.floor((sec % 3600) / 60);
		const seconds = sec % 60;
		return [hrs > 0 ? `${hrs}h` : null, mins > 0 ? `${mins}m` : null, `${seconds}s`]
			.filter(Boolean)
			.join(' ');
	};

	if (!session) {
		return (
			<View style={[styles.loaderContainer, { backgroundColor: theme.background }]}>
				<ThemedText themeColor="textSecondary">Loading drive summary...</ThemedText>
			</View>
		);
	}

	return (
		<ScrollView
			contentInsetAdjustmentBehavior="automatic"
			contentContainerStyle={[styles.container, { paddingBottom: Spacing.seven }]}
			style={{ backgroundColor: theme.background }}
		>
			{/* Overview Metadata */}
			<View style={styles.header}>
				<ThemedText type="bold" style={styles.dateText}>
					{formatDate(session.date)}
				</ThemedText>
				<ThemedText type="small" themeColor="textSecondary">
					Started at {formatTime(session.startTime)} • Total Duration:{' '}
					{formatDuration(session.duration)}
				</ThemedText>
			</View>

			{/* Main Score Panel */}
			<ThemedView type="backgroundElement" style={styles.scoreCard}>
				<View style={styles.scoreRow}>
					<CircularProgress score={session.score} size={150} />
					<View style={styles.scoreBreakdownCol}>
						<View style={styles.breakdownItem}>
							<ThemedText type="small" themeColor="textSecondary">
								TRIP RATING
							</ThemedText>
							<ThemedText type="subtitle" style={styles.ratingVal}>
								{session.rating}
							</ThemedText>
						</View>
						<View style={styles.breakdownItem}>
							<ThemedText type="small" themeColor="textSecondary">
								TOTAL EVENTS
							</ThemedText>
							<ThemedText type="subtitle">{session.totalEvents}</ThemedText>
						</View>
					</View>
				</View>

				{/* Detailed Event Grid Breakdown */}
				<View style={styles.eventGrid}>
					<View style={styles.gridCell}>
						<ThemedText type="code" style={styles.cellCount}>
							{session.eventBreakdown.harsh_brake || 0}
						</ThemedText>
						<ThemedText type="small" themeColor="textSecondary">
							Harsh Brake
						</ThemedText>
					</View>
					<View style={styles.gridCell}>
						<ThemedText type="code" style={styles.cellCount}>
							{session.eventBreakdown.harsh_accel || 0}
						</ThemedText>
						<ThemedText type="small" themeColor="textSecondary">
							Harsh Accel
						</ThemedText>
					</View>
					<View style={styles.gridCell}>
						<ThemedText type="code" style={styles.cellCount}>
							{session.eventBreakdown.sharp_turn || 0}
						</ThemedText>
						<ThemedText type="small" themeColor="textSecondary">
							Sharp Turn
						</ThemedText>
					</View>
				</View>
				<View style={styles.eventGrid}>
					<View style={styles.gridCell}>
						<ThemedText type="code" style={styles.cellCount}>
							{session.eventBreakdown.aggressive_steer || 0}
						</ThemedText>
						<ThemedText type="small" themeColor="textSecondary">
							Agg. Steer
						</ThemedText>
					</View>
					<View style={styles.gridCell}>
						<ThemedText type="code" style={styles.cellCount}>
							{session.eventBreakdown.excessive_movement || 0}
						</ThemedText>
						<ThemedText type="small" themeColor="textSecondary">
							Device Move
						</ThemedText>
					</View>
					<View style={styles.gridCell}>
						<ThemedText type="code" style={styles.cellCount}>
							{session.eventBreakdown.phone_handling || 0}
						</ThemedText>
						<ThemedText type="small" themeColor="textSecondary">
							Phone Use
						</ThemedText>
					</View>
				</View>
			</ThemedView>

			{/* AI Driving Feedback Report */}
			{session.aiFeedback && (
				<View style={styles.section}>
					<ThemedText type="bold" style={styles.sectionTitle}>
						Coaching Feedback
					</ThemedText>
					<ThemedView type="backgroundElement" style={styles.feedbackCard}>
						<ThemedText style={styles.feedbackText}>{session.aiFeedback}</ThemedText>
					</ThemedView>
				</View>
			)}

			{/* SVG Interactive Route Replay Map */}
			<View style={styles.section}>
				<ThemedText type="bold" style={styles.sectionTitle}>
					Route Replay & Event Pins
				</ThemedText>
				<ThemedText type="small" themeColor="textSecondary" style={styles.sectionDesc}>
					Tap on color-coded letter pins to check details of infractions recorded at that location.
				</ThemedText>
				<RouteReplay path={session.path} timeline={session.timeline} />
			</View>

			{/* Timeline of events */}
			<View style={styles.section}>
				<ThemedText type="bold" style={styles.sectionTitle}>
					Trip Event Timeline
				</ThemedText>
				{session.timeline.length === 0 ?
					<ThemedView type="backgroundElement" style={styles.emptyFeed}>
						<ThemedText type="small" themeColor="textSecondary">
							Excellent! No unsafe driving incidents were triggered during this trip.
						</ThemedText>
					</ThemedView>
				:	<View style={styles.timelineList}>
						{session.timeline.map((item, idx) => (
							<View key={item.id} style={styles.timelineItem}>
								{/* Timeline connector circle/line */}
								<View style={styles.connectorCol}>
									<View
										style={[
											styles.timelineDot,
											{ backgroundColor: item.scoreImpact <= -10 ? theme.error : theme.warning }
										]}
									/>
									{idx < session.timeline.length - 1 && (
										<View style={[styles.timelineLine, { backgroundColor: theme.border }]} />
									)}
								</View>

								{/* Event info card */}
								<ThemedView type="backgroundElement" style={styles.timelineCard}>
									<View style={styles.timelineHeader}>
										<ThemedText type="bold">{item.label}</ThemedText>
										<ThemedText type="bold" style={styles.impactText}>
											{item.scoreImpact} pts
										</ThemedText>
									</View>
									<View style={styles.timelineFooter}>
										<ThemedText type="small" themeColor="textSecondary">
											Occurred at: {formatDuration(Math.floor(item.timestamp / 1000))}
										</ThemedText>
										<ThemedText type="small" themeColor="textSecondary">
											Peak value: {item.magnitude}{' '}
											{item.type === 'phone_handling' ?
												'°'
											: item.type === 'excessive_movement' ?
												'σ'
											: item.type.includes('turn') || item.type.includes('steer') ?
												'rad/s'
											:	'm/s²'}
										</ThemedText>
									</View>
								</ThemedView>
							</View>
						))}
					</View>
				}
			</View>

			{/* Delete Button */}
			<Pressable onPress={confirmDelete} style={[styles.deleteBtn, { borderColor: theme.error }]}>
				<ThemedText type="bold" style={{ color: theme.error }}>
					Delete Drive Log
				</ThemedText>
			</Pressable>
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
	header: {
		gap: 2
	},
	dateText: {
		fontSize: 20,
		fontWeight: '800'
	},
	scoreCard: {
		borderRadius: 16,
		borderCurve: 'continuous',
		padding: Spacing.four,
		gap: Spacing.four,
		boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
	},
	scoreRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-around'
	},
	scoreBreakdownCol: {
		gap: Spacing.four,
		flex: 1,
		paddingLeft: Spacing.four
	},
	breakdownItem: {
		gap: 2
	},
	ratingVal: {
		fontWeight: '800'
	},
	eventGrid: {
		flexDirection: 'row',
		borderTopWidth: 1,
		borderTopColor: 'rgba(255, 255, 255, 0.05)',
		paddingTop: Spacing.three,
		marginTop: Spacing.one
	},
	gridCell: {
		flex: 1,
		alignItems: 'center',
		gap: 4
	},
	cellCount: {
		fontSize: 20,
		fontWeight: '800'
	},
	section: {
		gap: Spacing.two
	},
	sectionTitle: {
		fontSize: 16,
		fontWeight: '800',
		textTransform: 'uppercase',
		letterSpacing: 0.8
	},
	sectionDesc: {
		lineHeight: 18,
		marginBottom: 4
	},
	feedbackCard: {
		borderRadius: 14,
		borderCurve: 'continuous',
		padding: Spacing.four,
		boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
	},
	feedbackText: {
		fontSize: 14,
		lineHeight: 22
	},
	emptyFeed: {
		borderRadius: 12,
		borderCurve: 'continuous',
		padding: Spacing.four,
		alignItems: 'center',
		boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
	},
	timelineList: {
		gap: 2
	},
	timelineItem: {
		flexDirection: 'row',
		gap: Spacing.three
	},
	connectorCol: {
		width: 14,
		alignItems: 'center'
	},
	timelineDot: {
		width: 12,
		height: 12,
		borderRadius: 6,
		borderCurve: 'continuous',
		zIndex: 10,
		marginTop: Spacing.four
	},
	timelineLine: {
		width: 2,
		flex: 1,
		marginVertical: -8 // pull overlap
	},
	timelineCard: {
		flex: 1,
		borderRadius: 12,
		borderCurve: 'continuous',
		padding: Spacing.three,
		gap: Spacing.one,
		marginBottom: Spacing.two,
		boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
	},
	timelineHeader: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center'
	},
	impactText: {
		color: '#EF4444'
	},
	timelineFooter: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center'
	},
	deleteBtn: {
		borderWidth: 1.5,
		borderRadius: 12,
		borderCurve: 'continuous',
		height: 48,
		justifyContent: 'center',
		alignItems: 'center',
		marginTop: Spacing.four
	}
});
