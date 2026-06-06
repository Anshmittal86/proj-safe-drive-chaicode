import { Platform } from 'react-native';

export const Colors = {
	light: {
		text: '#0F172A', // Slate 900
		textSecondary: '#64748B', // Slate 500
		background: '#F8FAFC', // Slate 50
		backgroundElement: '#FFFFFF', // Card White
		backgroundSelected: '#E2E8F0', // Slate 200
		border: '#E2E8F0',
		divider: '#F1F5F9', // Slate 100
		primary: '#2563EB', // Royal Blue
		success: '#10B981', // Emerald Green
		warning: '#F59E0B', // Amber Yellow
		error: '#EF4444', // Coral Red
		accent: '#8B5CF6' // Violet Accent
	},
	dark: {
		text: '#F8FAFC', // Slate 50
		textSecondary: '#94A3B8', // Slate 400
		background: '#0F172A', // Slate 900
		backgroundElement: '#1E293B', // Slate 800
		backgroundSelected: '#334155', // Slate 700
		border: '#334155',
		divider: '#0F172A', // Slate 900
		primary: '#3B82F6', // Premium Blue
		success: '#10B981', // Emerald Green
		warning: '#F59E0B', // Amber Yellow
		error: '#F87171', // Coral Red
		accent: '#A78BFA' // Light Violet Accent
	}
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
	ios: {
		sans: 'System',
		rounded: 'System',
		mono: 'Courier'
	},
	default: {
		sans: 'sans-serif',
		rounded: 'sans-serif',
		mono: 'monospace'
	}
});

export const Spacing = {
	half: 2,
	one: 4,
	two: 8,
	three: 12,
	four: 16,
	five: 24,
	six: 32,
	seven: 48,
	eight: 64
} as const;

export const Shadows = {
	small: '0 1px 2px rgba(0, 0, 0, 0.05)',
	medium: '0 4px 6px rgba(0, 0, 0, 0.1)',
	large: '0 10px 15px rgba(0, 0, 0, 0.1)'
} as const;

export const BorderRadius = {
	card: 12,
	button: 8,
	badge: 20
} as const;

export const BottomTabInset = Platform.select({ ios: 40, android: 60 }) ?? 0;
export const MaxContentWidth = 800;
