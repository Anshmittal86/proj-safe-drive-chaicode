import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '../hooks/use-theme';
import { ThemedText } from './themed-text';

interface CircularProgressProps {
	score: number;
	size?: number;
	strokeWidth?: number;
	showRatingLabel?: boolean;
}

export function CircularProgress({
	score,
	size = 180,
	strokeWidth = 14,
	showRatingLabel = true
}: CircularProgressProps) {
	const theme = useTheme();

	// Clamp score
	const clampedScore = Math.max(0, Math.min(100, score));

	// Circle Math
	const radius = (size - strokeWidth) / 2;
	const circumference = 2 * Math.PI * radius;
	const strokeDashoffset = circumference - (clampedScore / 100) * circumference;

	// Determine colors based on score
	let strokeColor: string = theme.success; // Green
	let ratingText = 'Elite';
	let ratingColor: string = theme.success;

	if (clampedScore < 70) {
		strokeColor = theme.error; // Red
		ratingText = 'Risky';
		ratingColor = theme.error;
	} else if (clampedScore < 85) {
		strokeColor = theme.warning; // Orange/Yellow
		ratingText = 'Average';
		ratingColor = theme.warning;
	} else if (clampedScore < 95) {
		strokeColor = theme.primary; // Blue
		ratingText = 'Safe';
		ratingColor = theme.primary;
	}

	return (
		<View style={[styles.container, { width: size, height: size }]}>
			<Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
				{/* Background track circle */}
				<Circle
					cx={size / 2}
					cy={size / 2}
					r={radius}
					stroke={theme.backgroundSelected}
					strokeWidth={strokeWidth}
					fill="transparent"
				/>

				{/* Foreground progress circle */}
				<Circle
					cx={size / 2}
					cy={size / 2}
					r={radius}
					stroke={strokeColor}
					strokeWidth={strokeWidth}
					strokeDasharray={circumference}
					strokeDashoffset={strokeDashoffset}
					strokeLinecap="round"
					fill="transparent"
					transform={`rotate(-90 ${size / 2} ${size / 2})`}
				/>
			</Svg>

			{/* Centered Score text overlay */}
			<View style={styles.textContainer}>
				<ThemedText style={{ fontSize: size * 0.2, fontWeight: '800', lineHeight: size * 0.22 }}>
					{clampedScore}
				</ThemedText>
				<ThemedText
					type="small"
					themeColor="textSecondary"
					style={[styles.maxText, { lineHeight: 10, marginTop: -4 }]}
				>
					/ 100
				</ThemedText>
				{showRatingLabel && (
					<ThemedText
						style={[styles.ratingText, { color: ratingColor, fontSize: size * 0.08, marginTop: 2 }]}
					>
						{ratingText.toUpperCase()}
					</ThemedText>
				)}
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		justifyContent: 'center',
		alignItems: 'center',
		position: 'relative'
	},
	textContainer: {
		position: 'absolute',
		justifyContent: 'center',
		alignItems: 'center'
	},
	maxText: {
		fontSize: 10,
		fontWeight: '600',
		marginTop: -6
	},
	ratingText: {
		fontWeight: '800',
		letterSpacing: 1.5
	}
});
