import { Bell, X } from "lucide-react";
import { useEffect } from "react";
import { useNotificationStore } from "../stores/notificationStore";

export default function NotificationToast() {
	const { toast, dismissToast } = useNotificationStore();

	useEffect(() => {
		if (!toast) return;
		const timer = setTimeout(dismissToast, 4000);
		return () => clearTimeout(timer);
	}, [toast, dismissToast]);

	if (!toast) return null;

	return (
		<div className="fixed bottom-4 right-4 z-[300] animate-slide-up">
			<div className="flex items-start gap-3 px-4 py-3 bg-connexio-bg-secondary border border-connexio-border rounded-lg shadow-2xl max-w-[320px] min-w-[260px]">
				{/* Icon */}
				<div className="flex-shrink-0 mt-0.5">
					<div className="w-7 h-7 rounded-full bg-connexio-accent/10 flex items-center justify-center">
						<Bell size={13} className="text-connexio-accent" />
					</div>
				</div>

				{/* Content */}
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-1.5">
						{toast.provider && (
							<span className="text-[9px] font-semibold uppercase tracking-wider text-connexio-accent bg-connexio-accent/10 px-1.5 py-0.5 rounded">
								{toast.provider}
							</span>
						)}
					</div>
					<p className="text-xs font-medium text-connexio-text mt-1 truncate">
						{toast.title}
					</p>
					{toast.body && (
						<p className="text-[11px] text-connexio-text-secondary mt-0.5 line-clamp-2">
							{toast.body}
						</p>
					)}
				</div>

				{/* Close */}
				<button
					onClick={dismissToast}
					className="flex-shrink-0 p-0.5 rounded hover:bg-connexio-bg-tertiary transition-colors"
					type="button"
				>
					<X size={12} className="text-connexio-text-muted" />
				</button>
			</div>
		</div>
	);
}
