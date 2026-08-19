export default function SettingsCard({
	title,
	description,
	children,
}: {
	title: string;
	description?: string;
	children: React.ReactNode;
}) {
	return (
		<section className="soft-card space-y-4 p-4">
			<div>
				<h3 className="section-label">{title}</h3>
				{description && <p className="mt-1 text-[11px] text-connexio-text-muted">{description}</p>}
			</div>
			{children}
		</section>
	);
}
