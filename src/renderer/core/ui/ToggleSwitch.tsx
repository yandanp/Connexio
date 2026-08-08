export default function ToggleSwitch({
	checked,
	onChange,
}: {
	checked: boolean;
	onChange: (value: boolean) => void;
}) {
	return (
		<button
			onClick={() => onChange(!checked)}
			className={`relative h-5 w-9 rounded-full transition-colors ${
				checked
					? "bg-connexio-accent"
					: "bg-connexio-bg-tertiary shadow-[inset_0_0_0_1px_rgba(255,255,255,0.055)]"
			}`}
			type="button"
		>
			<div
				className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
					checked ? "translate-x-4" : "translate-x-0.5"
				}`}
			/>
		</button>
	);
}
