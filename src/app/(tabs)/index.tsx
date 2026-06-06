import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInUp, FadeOut, LinearTransition } from 'react-native-reanimated';
import { CircularProgress } from '../../components/circular-progress';
import { TelemetryChart } from '../../components/telemetry-chart';
import { ThemedText } from '../../components/themed-text';
import { ThemedView } from '../../components/themed-view';
import { Spacing } from '../../constants/theme';
import { useTheme } from '../../hooks/use-theme';
import { SensorService, TelemetryData } from '../../services/sensor-service';
import {
	DriveEvent,
	DriveSession,
	RoutePoint,
	StorageService
} from '../../services/storage-service';

export default function DriveScreen() {
	const theme = useTheme();
	const router = useRouter();

	// Session State
	const [isDriving, setIsDriving] = useState(false);
	const [isSimulated, setIsSimulated] = useState(false);
	const [score, setScore] = useState(100);
	const [duration, setDuration] = useState(0);
	const [speed, setSpeed] = useState(0); // km/h
	const [totalEvents, setTotalEvents] = useState(0);
	const [eventsList, setEventsList] = useState<DriveEvent[]>([]);
	const [recentAlert, setRecentAlert] = useState<string | null>(null);

	// Telemetry buffer state for the active chart
	const [telemetryPoints, setTelemetryPoints] = useState<{ x: number; y: number; z: number }[]>([]);

	// Historical summaries for resting dashboard view
	const [overallStats, setOverallStats] = useState({
		totalDrives: 0,
		averageScore: 100,
		totalDuration: 0
	});

	const alertTimer = useRef<any>(null);
	const durationInterval = useRef<any>(null);

	// Load stats on screen focus
	useEffect(() => {
		loadOverallStats();

		// Check if settings tab requested a simulation start
		const checkSimRequest = setInterval(() => {
			const profile = (SensorService as any).simStartRequestedProfile;
			if (profile && !SensorService.getIsActive()) {
				delete (SensorService as any).simStartRequestedProfile;
				startSession(profile);
			}
		}, 300);

		return () => {
			clearInterval(checkSimRequest);
			if (durationInterval.current) clearInterval(durationInterval.current);
		};
	}, []);

	const loadOverallStats = async () => {
		const stats = await StorageService.getAggregatedStats();
		setOverallStats({
			totalDrives: stats.totalDrives,
			averageScore: stats.averageScore,
			totalDuration: stats.totalDuration
		});
	};

	const startSession = async (simProfile?: 'commute' | 'sport' | 'distracted') => {
		// Reset state
		setScore(100);
		setDuration(0);
		setSpeed(0);
		setTotalEvents(0);
		setEventsList([]);
		setRecentAlert(null);
		setTelemetryPoints([]);

		const callbacks = {
			onEventDetected: (event: DriveEvent) => {
				setScore((prev) => Math.max(0, prev + event.scoreImpact));
				setTotalEvents((prev) => prev + 1);
				setEventsList((prev) => [event, ...prev].slice(0, 5)); // Keep last 5

				// Flash Alert banner
				if (alertTimer.current) clearTimeout(alertTimer.current);
				setRecentAlert(`${event.label} detected! ${event.scoreImpact} pts`);
				alertTimer.current = setTimeout(() => {
					setRecentAlert(null);
				}, 3000);
			},
			onTelemetryUpdated: (data: TelemetryData) => {
				setTelemetryPoints((prev) => {
					const updated = [
						...prev,
						{
							x: data.userAccel.x,
							y: data.userAccel.y,
							z: data.userAccel.z
						}
					];
					if (updated.length > 40) updated.shift();
					return updated;
				});
			},
			onLocationUpdated: (point: RoutePoint) => {
				// Convert speed from m/s to km/h
				setSpeed(Math.round(point.speed * 3.6));
			},
			onSessionEnded: (session: DriveSession) => {
				setIsDriving(false);
				setIsSimulated(false);
				if (durationInterval.current) clearInterval(durationInterval.current);

				// Redirect to detail report screen
				router.push(`/summary/${session.id}`);
				loadOverallStats();
			},
			onError: (err: string) => {
				alert(err);
			}
		};

		if (simProfile) {
			setIsDriving(true);
			setIsSimulated(true);
			SensorService.startSimulation(simProfile, callbacks);
		} else {
			setIsDriving(true);
			setIsSimulated(false);
			await SensorService.startDrive(callbacks);
		}

		// Set duration updater
		durationInterval.current = setInterval(() => {
			setDuration((d) => d + 1);
		}, 1000);
	};

	const endSession = async () => {
		if (durationInterval.current) clearInterval(durationInterval.current);
		await SensorService.endDrive();
	};

	const formatDuration = (sec: number): string => {
		const hours = Math.floor(sec / 3600);
		const minutes = Math.floor((sec % 3600) / 60);
		const seconds = sec % 60;
		return [
			hours > 0 ? String(hours).padStart(2, '0') : null,
			String(minutes).padStart(2, '0'),
			String(seconds).padStart(2, '0')
		]
			.filter(Boolean)
			.join(':');
	};

	return (
		<View style={[styles.container, { backgroundColor: theme.background }]}>
			{!isDriving ?
				/* ==================== RESTING DASHBOARD ==================== */
				<ScrollView
					contentContainerStyle={styles.restingContainer}
					contentInsetAdjustmentBehavior="automatic"
				>
					{/* Welcome Card */}
					<View style={styles.headerHero}>
						<ThemedText type="title" style={styles.mainTitle}>
							Drive Safe
						</ThemedText>
						<ThemedText type="small" themeColor="textSecondary" style={styles.subSubtitle}>
							Telematics and Driving Safety Analytics
						</ThemedText>
					</View>

					{/* Aggregate Stats Card */}
					<ThemedView type="backgroundElement" style={styles.statsOverviewCard}>
						<View style={styles.statsCardGrid}>
							<View style={styles.statsCardCol}>
								<ThemedText type="small" themeColor="textSecondary" style={styles.statLabel}>
									Overall Score
								</ThemedText>
								<ThemedText
									style={[
										styles.statValue,
										{ color: overallStats.averageScore >= 85 ? theme.success : theme.warning }
									]}
								>
									{overallStats.totalDrives > 0 ? overallStats.averageScore : '--'}
								</ThemedText>
							</View>
							<View style={styles.statsCardDivider} />
							<View style={styles.statsCardCol}>
								<ThemedText type="small" themeColor="textSecondary" style={styles.statLabel}>
									Total Trips
								</ThemedText>
								<ThemedText style={styles.statValue}>{overallStats.totalDrives}</ThemedText>
							</View>
							<View style={styles.statsCardDivider} />
							<View style={styles.statsCardCol}>
								<ThemedText type="small" themeColor="textSecondary" style={styles.statLabel}>
									Hours Driven
								</ThemedText>
								<ThemedText style={styles.statValue}>
									{(overallStats.totalDuration / 3600).toFixed(1)}
								</ThemedText>
							</View>
						</View>
					</ThemedView>

					{/* Calibration Hint */}
					{!SensorService.getIsCalibrated() && (
						<ThemedView type="backgroundSelected" style={styles.alertBanner}>
							<ThemedText type="smallBold" style={{ color: theme.warning }}>
								⚠️ Device Not Calibrated
							</ThemedText>
							<ThemedText type="small" themeColor="textSecondary">
								Head to the Settings tab to calibrate your device's mounting angle for higher
								detection accuracy.
							</ThemedText>
						</ThemedView>
					)}

					{/* Big Circular Start Button */}
					<View style={styles.startBtnContainer}>
						<Pressable
							onPress={() => startSession()}
							style={({ pressed }) => [
								styles.startCircle,
								{
									backgroundColor: theme.primary,
									opacity: pressed ? 0.9 : 1,
									boxShadow: `0 10px 25px rgba(59, 130, 246, 0.4)`
								}
							]}
						>
							<ThemedText style={styles.startBtnText}>START TRIP</ThemedText>
							<ThemedText type="small" style={styles.startBtnSubtext}>
								Record Sensors
							</ThemedText>
						</Pressable>
					</View>
				</ScrollView>
			:	/* ==================== ACTIVE DRIVING HUD ==================== */
				<ScrollView
					contentContainerStyle={[styles.activeContainer, { paddingBottom: Spacing.six }]}
					contentInsetAdjustmentBehavior="automatic"
				>
					{/* Simulation Header Badge */}
					{isSimulated && (
						<View style={[styles.simBadge, { backgroundColor: theme.accent }]}>
							<ThemedText style={styles.simBadgeText}>DRIVE SIMULATION ACTIVE</ThemedText>
						</View>
					)}

					{/* Real-time Alert Banner Popup */}
					{recentAlert && (
						<Animated.View
							entering={FadeInUp.duration(350)}
							exiting={FadeOut.duration(300)}
							style={[styles.alertBannerHUD, { backgroundColor: theme.error }]}
						>
							<ThemedText style={styles.alertHUDText}>{recentAlert}</ThemedText>
						</Animated.View>
					)}

					{/* Circular Score Gauge */}
					<View style={styles.activeScoreRow}>
						<CircularProgress score={score} size={200} />
					</View>

					{/* HUD Telemetry Stats */}
					<View style={styles.hudStatsGrid}>
						<ThemedView type="backgroundElement" style={styles.hudStatBox}>
							<ThemedText type="small" themeColor="textSecondary">
								DURATION
							</ThemedText>
							<ThemedText type="bold" style={styles.hudStatVal}>
								{formatDuration(duration)}
							</ThemedText>
						</ThemedView>
						<ThemedView type="backgroundElement" style={styles.hudStatBox}>
							<ThemedText type="small" themeColor="textSecondary">
								SPEED
							</ThemedText>
							<ThemedText type="bold" style={styles.hudStatVal}>
								{speed} km/h
							</ThemedText>
						</ThemedView>
						<ThemedView type="backgroundElement" style={styles.hudStatBox}>
							<ThemedText type="small" themeColor="textSecondary">
								EVENTS
							</ThemedText>
							<ThemedText type="bold" style={styles.hudStatVal}>
								{totalEvents}
							</ThemedText>
						</ThemedView>
					</View>

					{/* Scrolling Real-time Waves */}
					<TelemetryChart title="Live User Acceleration (Filtered)" points={telemetryPoints} />

					{/* Recent Events List */}
					<View style={styles.activeEventsSection}>
						<ThemedText type="bold" style={styles.eventsTitle}>
							Session Feed
						</ThemedText>
						{eventsList.length === 0 ?
							<ThemedView type="backgroundElement" style={styles.emptyFeed}>
								<ThemedText type="small" themeColor="textSecondary">
									Smooth driving in progress. No events detected.
								</ThemedText>
							</ThemedView>
						:	eventsList.map((item) => (
								<Animated.View
									key={item.id}
									entering={FadeInUp}
									layout={LinearTransition}
									style={[
										styles.eventItemRow,
										{
											backgroundColor: theme.backgroundElement,
											borderLeftColor: item.scoreImpact <= -10 ? theme.error : theme.warning
										}
									]}
								>
									<View>
										<ThemedText type="bold" style={styles.eventItemLabel}>
											{item.label}
										</ThemedText>
										<ThemedText type="small" themeColor="textSecondary">
											{formatDuration(Math.floor(item.timestamp / 1000))} into drive
										</ThemedText>
									</View>
									<ThemedText type="bold" style={styles.eventItemImpact}>
										{item.scoreImpact} pts
									</ThemedText>
								</Animated.View>
							))
						}
					</View>

					{/* End Drive Button */}
					<Pressable
						onPress={endSession}
						style={[styles.stopButton, { backgroundColor: theme.error }]}
					>
						<ThemedText style={styles.stopButtonText}>END DRIVE</ThemedText>
					</Pressable>
				</ScrollView>
			}
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1
	},
	restingContainer: {
		padding: Spacing.four,
		gap: Spacing.five
	},
	headerHero: {
		marginTop: Spacing.two,
		alignItems: 'center',
		gap: 2
	},
	mainTitle: {
		fontSize: 42,
		fontWeight: '900',
		letterSpacing: -1
	},
	subSubtitle: {
		fontSize: 14,
		textAlign: 'center'
	},
	statsOverviewCard: {
		borderRadius: 16,
		borderCurve: 'continuous',
		paddingVertical: Spacing.four,
		boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
	},
	statsCardGrid: {
		flexDirection: 'row',
		justifyContent: 'space-around',
		alignItems: 'center'
	},
	statsCardCol: {
		alignItems: 'center',
		flex: 1
	},
	statLabel: {
		fontSize: 10,
		fontWeight: '700',
		textTransform: 'uppercase',
		letterSpacing: 0.6
	},
	statValue: {
		fontSize: 24,
		fontWeight: '800',
		marginTop: 4
	},
	statsCardDivider: {
		width: 1,
		height: 36,
		backgroundColor: 'rgba(255, 255, 255, 0.1)'
	},
	alertBanner: {
		borderRadius: 12,
		borderCurve: 'continuous',
		padding: Spacing.three,
		gap: 4
	},
	startBtnContainer: {
		justifyContent: 'center',
		alignItems: 'center',
		marginVertical: Spacing.six
	},
	startCircle: {
		width: 170,
		height: 170,
		borderRadius: 85,
		borderCurve: 'continuous',
		justifyContent: 'center',
		alignItems: 'center',
		gap: 2
	},
	startBtnText: {
		color: '#FFFFFF',
		fontWeight: '900',
		fontSize: 20,
		letterSpacing: 0.5
	},
	startBtnSubtext: {
		color: 'rgba(255, 255, 255, 0.7)',
		fontSize: 11,
		fontWeight: '700',
		textTransform: 'uppercase'
	},
	activeContainer: {
		padding: Spacing.four,
		gap: Spacing.four
	},
	simBadge: {
		borderRadius: 8,
		borderCurve: 'continuous',
		paddingVertical: 4,
		paddingHorizontal: 8,
		alignSelf: 'center'
	},
	simBadgeText: {
		color: '#FFFFFF',
		fontSize: 10,
		fontWeight: '900',
		letterSpacing: 0.8
	},
	alertBannerHUD: {
		borderRadius: 10,
		borderCurve: 'continuous',
		paddingHorizontal: Spacing.four,
		paddingVertical: Spacing.two,
		alignItems: 'center',
		boxShadow: '0 4px 12px rgba(239, 68, 68, 0.15)'
	},
	alertHUDText: {
		color: '#FFFFFF',
		fontWeight: '700',
		fontSize: 13,
		textAlign: 'center'
	},
	activeScoreRow: {
		alignItems: 'center',
		marginVertical: Spacing.two
	},
	hudStatsGrid: {
		flexDirection: 'row',
		gap: 8
	},
	hudStatBox: {
		flex: 1,
		borderRadius: 12,
		borderCurve: 'continuous',
		padding: Spacing.two,
		alignItems: 'center',
		gap: Spacing.one,
		boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
	},
	hudStatVal: {
		fontSize: 18,
		fontVariant: ['tabular-nums']
	},
	activeEventsSection: {
		gap: Spacing.one
	},
	eventsTitle: {
		fontSize: 14,
		fontWeight: '800',
		textTransform: 'uppercase',
		letterSpacing: 0.8,
		marginBottom: Spacing.one
	},
	emptyFeed: {
		borderRadius: 12,
		borderCurve: 'continuous',
		padding: Spacing.four,
		alignItems: 'center',
		boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
	},
	eventItemRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		padding: Spacing.three,
		borderRadius: 12,
		borderCurve: 'continuous',
		borderLeftWidth: 4,
		boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
	},
	eventItemLabel: {
		fontSize: 13
	},
	eventItemImpact: {
		fontSize: 14,
		color: '#EF4444'
	},
	stopButton: {
		borderRadius: 12,
		borderCurve: 'continuous',
		height: 52,
		justifyContent: 'center',
		alignItems: 'center',
		marginTop: 12,
		boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
	},
	stopButtonText: {
		color: '#FFFFFF',
		fontWeight: '800',
		fontSize: 16,
		letterSpacing: 0.5
	}
});
