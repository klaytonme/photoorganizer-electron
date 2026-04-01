/** @type {import('tailwindcss').Config} */
module.exports = {
	content: ['./pages/**/*.{js,jsx}', './components/**/*.{js,jsx}'],
	theme: {
		extend: {
			fontFamily: {
				display: ['DM Serif Display', 'Georgia', 'serif'],
				mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
				sans: ['DM Sans', 'sans-serif'],
			},
			colors: {
				surface: {
					0: '#0a0a0a',
					1: '#111111',
					2: '#1a1a1a',
					3: '#242424',
					4: '#2e2e2e',
				},
				border: '#2e2e2e',
				accent: '#e8d5b0',       // warm gold
				'accent-dim': '#a89060',
				confirm: '#4ade80',
				trash: '#f87171',
			},
			boxShadow: {
				'inner-strong': 'inset 0 2px 8px rgba(0,0,0,0.6)',
				'glow-confirm': '0 0 12px rgba(74,222,128,0.35)',
				'glow-accent': '0 0 20px rgba(232,213,176,0.15)',
			},
		},
	},
	plugins: [],
};