export default function SkeletonList() {
	return (
		<div className="px-2 py-1 space-y-1">
			{[0, 1, 2].map((i) => (
				<div key={i} className="flex items-center gap-1 px-2 py-1">
					<div className="w-3 h-3 rounded bg-connexio-bg-tertiary/80 animate-pulse" />
					<div
						className="flex-1 h-3 rounded bg-connexio-bg-tertiary/80 animate-pulse"
						style={{ animationDelay: `${i * 80}ms` }}
					/>
					<div className="w-6 h-3 rounded bg-connexio-bg-tertiary/80 animate-pulse" />
				</div>
			))}
		</div>
	);
}
