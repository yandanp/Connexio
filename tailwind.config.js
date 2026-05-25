/** @type {import('tailwindcss').Config} */
module.exports = {
	content: ["./src/renderer/**/*.{js,ts,jsx,tsx,html}"],
	darkMode: "class",
	theme: {
		extend: {
			colors: {
				connexio: {
					bg: "var(--bg-primary)",
					"bg-secondary": "var(--bg-secondary)",
					"bg-tertiary": "var(--bg-tertiary)",
					border: "var(--border-color)",
					accent: "var(--accent-color)",
					"accent-hover": "var(--accent-hover)",
					text: "var(--text-primary)",
					"text-secondary": "var(--text-secondary)",
					"text-muted": "var(--text-muted)",
				},
			},
		},
	},
	plugins: [],
};
