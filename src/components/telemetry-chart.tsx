import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';
import { useTheme } from '../hooks/use-theme';
import { ThemedText } from './themed-text';

interface TelemetryChartProps {
	title: string;
	points: { x: number; y: number; z: number }[];
	maxPoints?: number;
	height?: number;
	yRange?: [number, number]; // [min, max]
}

export function TelemetryChart({
	title,
	points,
	maxPoints = 40,
	height = 90,
	yRange = [-15, 15]
}: TelemetryChartProps) {
	const theme = useTheme();

	// Create SVG path strings for X, Y, and Z lines
	const generatePath = (axis: 'x' | 'y' | 'z') => {
		if (points.length < 2) return '';

		const width = 320; // fixed relative SVG scale width
		const [yMin, yMax] = yRange;
		const ySpan = yMax - yMin;

		let path = '';
		points.forEach((pt, index) => {
			// Scale X across the width
			const x = (index / (maxPoints - 1)) * width;

			// Scale Y between yMin and yMax, invert for SVG coordinates (0 is top)
			const val = pt[axis];
			const normalizedY = (val - yMin) / ySpan;
			const y = height - Math.max(0, Math.min(1, normalizedY)) * height;

			if (index === 0) {
				path += `M ${x.toFixed(1)} ${y.toFixed(1)}`;
			} else {
				path += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
			}
		});

		return path;
	};

	const pathX = generatePath('x');
	const pathY = generatePath('y');
	const pathZ = generatePath('z');

	return (
		<View style={[styles.container, { borderColor: theme.border }]}>
			<View style={styles.header}>
				<ThemedText style={styles.title}>{title}</ThemedText>
				<View style={styles.legend}>
					<View style={styles.legendItem}>
						<View style={[styles.dot, { backgroundColor: '#EF4444' }]} />
						<ThemedText type="code" style={styles.legendText}>
							X
						</ThemedText>
					</View>
					<View style={styles.legendItem}>
						<View style={[styles.dot, { backgroundColor: '#10B981' }]} />
						<ThemedText type="code" style={styles.legendText}>
							Y
						</ThemedText>
					</View>
					<View style={styles.legendItem}>
						<View style={[styles.dot, { backgroundColor: '#3B82F6' }]} />
						<ThemedText type="code" style={styles.legendText}>
							Z
						</ThemedText>
					</View>
				</View>
			</View>

			<View style={[styles.chartContainer, { height }]}>
				<Svg width="100%" height={height} viewBox={`0 0 320 ${height}`} preserveAspectRatio="none">
					{/* Horizontal grid baseline (0) */}
					<Line
						x1="0"
						y1={height / 2}
						x2="320"
						y2={height / 2}
						stroke={theme.border}
						strokeWidth="1"
						strokeDasharray="4 4"
					/>

					{/* X axis line (Red) */}
					{pathX ?
						<Path
							d={pathX}
							fill="none"
							stroke="#EF4444"
							strokeWidth="2"
							strokeLinejoin="round"
							strokeLinecap="round"
						/>
					:	null}

					{/* Y axis line (Green) */}
					{pathY ?
						<Path
							d={pathY}
							fill="none"
							stroke="#10B981"
							strokeWidth="2"
							strokeLinejoin="round"
							strokeLinecap="round"
						/>
					:	null}

					{/* Z axis line (Blue) */}
					{pathZ ?
						<Path
							d={pathZ}
							fill="none"
							stroke="#3B82F6"
							strokeWidth="2"
							strokeLinejoin="round"
							strokeLinecap="round"
						/>
					:	null}
				</Svg>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		borderWidth: 1,
		borderRadius: 12,
		padding: 10,
		marginVertical: 6,
		alignSelf: 'stretch',
		backgroundColor: 'rgba(30, 41, 59, 0.4)', // semi-transparent card dark
		borderCurve: 'continuous'
	},
	header: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginBottom: 6
	},
	title: {
		fontSize: 10,
		fontWeight: '700',
		textTransform: 'uppercase',
		letterSpacing: 0.5
	},
	legend: {
		flexDirection: 'row',
		gap: 4
	},
	legendItem: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 4
	},
	dot: {
		width: 6,
		height: 6,
		borderRadius: 3,
		borderCurve: 'continuous'
	},
	legendText: {
		fontSize: 8,
		fontWeight: '700'
	},
	chartContainer: {
		alignSelf: 'stretch',
		overflow: 'hidden'
	}
});
