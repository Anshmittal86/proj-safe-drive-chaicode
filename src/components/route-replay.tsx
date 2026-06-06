import React, { useState } from 'react';
import { Dimensions, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Path, Text as SvgText } from 'react-native-svg';
import { useTheme } from '../hooks/use-theme';
import { DriveEvent, RoutePoint } from '../services/storage-service';
import { ThemedText } from './themed-text';

interface RouteReplayProps {
	path: RoutePoint[];
	timeline: DriveEvent[];
	height?: number;
}

export function RouteReplay({ path, timeline, height = 240 }: RouteReplayProps) {
	const theme = useTheme();
	const [selectedEvent, setSelectedEvent] = useState<DriveEvent | null>(null);
	const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

	if (path.length === 0) {
		return (
			<View style={[styles.emptyContainer, { height, borderColor: theme.border }]}>
				<ThemedText themeColor="textSecondary">No route data available for this trip</ThemedText>
			</View>
		);
	}

	// Get screen width for bounding box mapping
	const screenWidth = Dimensions.get('window').width - 32; // padding adjusted
	const mapWidth = Math.min(screenWidth, 600);
	const mapHeight = height;

	// Find bounding box for Latitude/Longitude
	let minLat = Infinity,
		maxLat = -Infinity;
	let minLng = Infinity,
		maxLng = -Infinity;

	path.forEach((pt) => {
		if (pt.latitude < minLat) minLat = pt.latitude;
		if (pt.latitude > maxLat) maxLat = pt.latitude;
		if (pt.longitude < minLng) minLng = pt.longitude;
		if (pt.longitude > maxLng) maxLng = pt.longitude;
	});

	// Add a small buffer padding to coordinates so path doesn't hit edge
	const latRange = maxLat - minLat;
	const lngRange = maxLng - minLng;
	const latBuffer = latRange === 0 ? 0.001 : latRange * 0.15;
	const lngBuffer = lngRange === 0 ? 0.001 : lngRange * 0.15;

	minLat -= latBuffer;
	maxLat += latBuffer;
	minLng -= lngBuffer;
	maxLng += lngBuffer;

	const latSpan = maxLat - minLat;
	const lngSpan = maxLng - minLng;

	// Conversion: Lat/Lng -> SVG X/Y coordinate space
	const project = (latitude: number, longitude: number) => {
		const x = ((longitude - minLng) / lngSpan) * mapWidth;
		const y = mapHeight - ((latitude - minLat) / latSpan) * mapHeight;
		return {
			x: Math.max(8, Math.min(mapWidth - 8, x)),
			y: Math.max(8, Math.min(mapHeight - 8, y))
		};
	};

	// Generate SVG Path
	let pathD = '';
	const projectedPoints = path.map((pt) => {
		const coord = project(pt.latitude, pt.longitude);
		return { ...coord, point: pt };
	});

	projectedPoints.forEach((pt, idx) => {
		if (idx === 0) {
			pathD += `M ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
		} else {
			pathD += ` L ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
		}
	});

	// Calculate event coordinate mapping (find closest path point based on relative timestamp)
	const mappedEvents = timeline.map((event) => {
		// Find closest route point matching relative timestamp
		const baseTime = path[0].timestamp;
		const eventTimeAbs = baseTime + event.timestamp;

		let closestIndex = 0;
		let minTimeDiff = Infinity;

		path.forEach((pt, idx) => {
			const diff = Math.abs(pt.timestamp - eventTimeAbs);
			if (diff < minTimeDiff) {
				minTimeDiff = diff;
				closestIndex = idx;
			}
		});

		const matchedPoint = path[closestIndex];
		const coord = project(matchedPoint.latitude, matchedPoint.longitude);

		return {
			event,
			x: coord.x,
			y: coord.y
		};
	});

	const handleMarkerPress = (evt: DriveEvent, x: number, y: number) => {
		setSelectedEvent(evt);
		setTooltipPos({ x, y });
	};

	// Event pin styles helper
	const getEventMarkerColor = (type: DriveEvent['type']) => {
		switch (type) {
			case 'phone_handling':
				return theme.error;
			case 'harsh_brake':
				return '#F59E0B'; // Amber
			case 'harsh_accel':
				return '#2563EB'; // Blue
			case 'sharp_turn':
				return '#8B5CF6'; // Purple
			case 'aggressive_steer':
				return '#EC4899'; // Pink
			default:
				return theme.text;
		}
	};

	const getEventLetter = (type: DriveEvent['type']) => {
		switch (type) {
			case 'phone_handling':
				return 'P';
			case 'harsh_brake':
				return 'B';
			case 'harsh_accel':
				return 'A';
			case 'sharp_turn':
				return 'T';
			case 'aggressive_steer':
				return 'S';
			default:
				return '!';
		}
	};

	const startCoord = projectedPoints[0];
	const endCoord = projectedPoints[projectedPoints.length - 1];

	return (
		<View style={[styles.container, { borderColor: theme.border }]}>
			<Pressable
				onPress={() => setSelectedEvent(null)}
				style={{ width: mapWidth, height: mapHeight }}
			>
				<Svg width={mapWidth} height={mapHeight}>
					{/* Main Driving Path (Vibrant Gradient / Styled Path) */}
					{pathD ?
						<Path
							d={pathD}
							fill="none"
							stroke={theme.primary}
							strokeWidth="4"
							strokeLinecap="round"
							strokeLinejoin="round"
							opacity="0.8"
						/>
					:	null}

					{/* Color overlays on segment markers to represent speeds or minor braking spikes */}
					{projectedPoints.map((pt, idx) => {
						if (idx === 0) return null;
						const prev = projectedPoints[idx - 1];
						// If safety color is red/orange, draw alert highlight segment
						if (pt.point.safetyColor !== '#10B981') {
							return (
								<Path
									key={`seg-${idx}`}
									d={`M ${prev.x.toFixed(1)} ${prev.y.toFixed(1)} L ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`}
									fill="none"
									stroke={pt.point.safetyColor}
									strokeWidth="5"
									strokeLinecap="round"
								/>
							);
						}
						return null;
					})}

					{/* Start Point Marker */}
					{startCoord ?
						<G>
							<Circle cx={startCoord.x} cy={startCoord.y} r="6" fill={theme.success} />
							<Circle
								cx={startCoord.x}
								cy={startCoord.y}
								r="10"
								fill="transparent"
								stroke={theme.success}
								strokeWidth="1.5"
							/>
						</G>
					:	null}

					{/* End Point Marker */}
					{endCoord ?
						<G>
							<Circle cx={endCoord.x} cy={endCoord.y} r="6" fill="#EF4444" />
							<Circle
								cx={endCoord.x}
								cy={endCoord.y}
								r="10"
								fill="transparent"
								stroke="#EF4444"
								strokeWidth="1.5"
							/>
						</G>
					:	null}

					{/* Event Pins */}
					{mappedEvents.map((me, idx) => {
						const color = getEventMarkerColor(me.event.type);
						const letter = getEventLetter(me.event.type);

						return (
							<G key={`pin-${idx}`} transform={`translate(${me.x - 10}, ${me.y - 10})`}>
								<Circle
									cx="10"
									cy="10"
									r="9"
									fill={color}
									stroke="#FFFFFF"
									strokeWidth="1.5"
									onPress={() => handleMarkerPress(me.event, me.x, me.y)}
								/>
								<SvgText
									x="10"
									y="13.5"
									fill="#FFFFFF"
									fontSize="10"
									fontWeight="bold"
									textAnchor="middle"
									onPress={() => handleMarkerPress(me.event, me.x, me.y)}
								>
									{letter}
								</SvgText>
							</G>
						);
					})}
				</Svg>

				{/* Dynamic Tooltip overlay */}
				{selectedEvent && (
					<View
						style={[
							styles.tooltip,
							{
								left: Math.max(10, Math.min(mapWidth - 140, tooltipPos.x - 65)),
								top: Math.max(10, tooltipPos.y - 65),
								backgroundColor: theme.backgroundElement,
								borderColor: theme.border
							}
						]}
					>
						<ThemedText style={styles.tooltipLabel}>{selectedEvent.label}</ThemedText>
						<ThemedText style={styles.tooltipImpact}>
							Penalty: {selectedEvent.scoreImpact} pts
						</ThemedText>
						<ThemedText type="small" themeColor="textSecondary">
							{(selectedEvent.timestamp / 1000).toFixed(0)}s into drive
						</ThemedText>
					</View>
				)}
			</Pressable>

			<View style={styles.legendContainer}>
				<View style={styles.legendRow}>
					<View style={styles.badge}>
						<ThemedText style={styles.badgeText}>B</ThemedText>
					</View>
					<ThemedText type="small" style={styles.legendText}>
						Braking
					</ThemedText>
				</View>
				<View style={styles.legendRow}>
					<View style={[styles.badge, { backgroundColor: '#2563EB' }]}>
						<ThemedText style={styles.badgeText}>A</ThemedText>
					</View>
					<ThemedText type="small" style={styles.legendText}>
						Accel
					</ThemedText>
				</View>
				<View style={styles.legendRow}>
					<View style={[styles.badge, { backgroundColor: '#8B5CF6' }]}>
						<ThemedText style={styles.badgeText}>T</ThemedText>
					</View>
					<ThemedText type="small" style={styles.legendText}>
						Turn
					</ThemedText>
				</View>
				<View style={styles.legendRow}>
					<View style={[styles.badge, { backgroundColor: '#EF4444' }]}>
						<ThemedText style={styles.badgeText}>P</ThemedText>
					</View>
					<ThemedText type="small" style={styles.legendText}>
						Phone
					</ThemedText>
				</View>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		borderWidth: 1,
		borderRadius: 16,
		overflow: 'hidden',
		alignSelf: 'stretch',
		alignItems: 'center',
		backgroundColor: 'rgba(30, 41, 59, 0.2)',
		paddingTop: 12,
		borderCurve: 'continuous'
	},
	emptyContainer: {
		borderWidth: 1,
		borderRadius: 16,
		borderCurve: 'continuous',
		justifyContent: 'center',
		alignItems: 'center',
		alignSelf: 'stretch',
		backgroundColor: 'rgba(30, 41, 59, 0.2)'
	},
	tooltip: {
		position: 'absolute',
		borderRadius: 8,
		borderCurve: 'continuous',
		borderWidth: 1,
		paddingHorizontal: 8,
		paddingVertical: 6,
		width: 130,
		boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
		alignItems: 'center'
	},
	tooltipLabel: {
		fontSize: 11,
		fontWeight: '800'
	},
	tooltipImpact: {
		fontSize: 10,
		fontWeight: '700',
		color: '#EF4444'
	},
	legendContainer: {
		flexDirection: 'row',
		alignSelf: 'stretch',
		justifyContent: 'space-around',
		paddingVertical: 10,
		backgroundColor: 'rgba(15, 23, 42, 0.6)',
		borderTopWidth: 1,
		borderTopColor: 'rgba(255, 255, 255, 0.05)'
	},
	legendRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 4
	},
	legendText: {
		fontSize: 10,
		fontWeight: '600'
	},
	badge: {
		width: 14,
		height: 14,
		borderRadius: 7,
		borderCurve: 'continuous',
		backgroundColor: '#F59E0B',
		justifyContent: 'center',
		alignItems: 'center'
	},
	badgeText: {
		color: '#FFFFFF',
		fontSize: 9,
		fontWeight: '900'
	}
});
