import { Bell, CheckCheck, Clock, Trash2, X, Zap } from "lucide-react";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { ConnexioNotification } from "../../shared/types";
import { useNotificationStore } from "../stores/notificationStore";

export default function NotificationBell() {
	const { unreadCount, isOpen, togglePanel, closePanel } =
		useNotificationStore();

	return (
		<div className="relative">
			<button
				onClick={togglePanel}
				className={`relative p-1.5 rounded transition-colors ${
					isOpen
						? "bg-connexio-accent/10 text-connexio-accent"
						: "hover:bg-connexio-bg-tertiary text-connexio-text-muted"
				}`}
				title="Notifications"
				type="button"
			>
				<Bell size={14} />
				{unreadCount > 0 && (
					<span className="absolute -top-0.5 -right-0.5 w-4 h-4 flex items-center justify-center text-[9px] font-bold text-white bg-red-500 rounded-full">
						{unreadCount > 9 ? "9+" : unreadCount}
					</span>
				)}
			</button>

			{isOpen &&
				createPortal(<NotificationPanel onClose={closePanel} />, document.body)}
		</div>
	);
}

function NotificationPanel({ onClose }: { onClose: () => void }) {
	const {
		notifications,
		markRead,
		markAllRead,
		remove,
		clear,
		handleIncoming,
		navigateToNotification,
	} = useNotificationStore();

	const sendTestNotification = () => {
		const providers = ["claude", "opencode", "codex", "pi"];
		const messages = [
			"Task completed — fixed the login bug",
			"Session idle — waiting for input",
			"Build finished successfully",
			"Refactoring done — 3 files changed",
		];
		const provider = providers[Math.floor(Math.random() * providers.length)];
		const body = messages[Math.floor(Math.random() * messages.length)];
		handleIncoming({
			id: crypto.randomUUID(),
			source: "agent",
			provider,
			title: `${provider.charAt(0).toUpperCase() + provider.slice(1)} Agent`,
			body,
			timestamp: Date.now(),
			isRead: false,
		});
	};
	const panelRef = useRef<HTMLDivElement>(null);

	// Close on outside click
	useEffect(() => {
		const handleClick = (e: MouseEvent) => {
			if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
				onClose();
			}
		};
		const timer = setTimeout(() => {
			document.addEventListener("mousedown", handleClick);
		}, 0);
		return () => {
			clearTimeout(timer);
			document.removeEventListener("mousedown", handleClick);
		};
	}, [onClose]);

	return (
		<div
			ref={panelRef}
			className="fixed top-10 right-3 z-[200] w-80 max-h-[480px] bg-connexio-bg-secondary border border-connexio-border rounded-lg shadow-2xl flex flex-col overflow-hidden"
		>
			{/* Header */}
			<div className="flex items-center justify-between px-3 py-2.5 border-b border-connexio-border">
				<div className="flex items-center gap-2">
					<Bell size={13} className="text-connexio-text-secondary" />
					<span className="text-xs font-semibold text-connexio-text">
						Notifications
					</span>
				</div>
				<div className="flex items-center gap-1">
					{/* Test button — send fake notification */}
					<button
						onClick={sendTestNotification}
						className="p-1 rounded hover:bg-connexio-bg-tertiary transition-colors"
						title="Send test notification"
						type="button"
					>
						<Zap size={12} className="text-yellow-400" />
					</button>
					{notifications.length > 0 && (
						<>
							<button
								onClick={markAllRead}
								className="p-1 rounded hover:bg-connexio-bg-tertiary transition-colors"
								title="Mark all as read"
								type="button"
							>
								<CheckCheck size={12} className="text-connexio-text-muted" />
							</button>
							<button
								onClick={clear}
								className="p-1 rounded hover:bg-connexio-bg-tertiary transition-colors"
								title="Clear all"
								type="button"
							>
								<Trash2 size={12} className="text-connexio-text-muted" />
							</button>
						</>
					)}
					<button
						onClick={onClose}
						className="p-1 rounded hover:bg-connexio-bg-tertiary transition-colors"
						type="button"
					>
						<X size={12} className="text-connexio-text-muted" />
					</button>
				</div>
			</div>

			{/* List */}
			<div className="flex-1 overflow-y-auto">
				{notifications.length === 0 ? (
					<div className="flex flex-col items-center justify-center py-10 px-4">
						<Bell size={24} className="text-connexio-text-muted/30 mb-2" />
						<p className="text-xs text-connexio-text-muted text-center">
							No notifications yet
						</p>
						<p className="text-[10px] text-connexio-text-muted/60 text-center mt-1">
							Notifications from AI agents will appear here
						</p>
					</div>
				) : (
					notifications.map((notification) => (
						<NotificationItem
							key={notification.id}
							notification={notification}
							onSelect={() => {
								markRead(notification.id);
								navigateToNotification(notification);
								onClose();
							}}
							onRemove={() => remove(notification.id)}
						/>
					))
				)}
			</div>
		</div>
	);
}

function NotificationItem({
	notification,
	onSelect,
	onRemove,
}: {
	notification: ConnexioNotification;
	onSelect: () => void;
	onRemove: () => void;
}) {
	const timeAgo = getTimeAgo(notification.timestamp);

	return (
		<div
			className={`group flex items-start gap-2.5 px-3 py-2.5 border-b border-connexio-border/50 hover:bg-connexio-bg-tertiary/50 transition-colors cursor-pointer ${
				!notification.isRead ? "bg-connexio-accent/5" : ""
			}`}
			onClick={onSelect}
			onKeyDown={(e) => {
				if (e.key === "Enter") onSelect();
			}}
			role="button"
			tabIndex={0}
		>
			{/* Unread dot */}
			<div className="flex-shrink-0 mt-1.5">
				{!notification.isRead ? (
					<div className="w-2 h-2 rounded-full bg-connexio-accent" />
				) : (
					<div className="w-2 h-2" />
				)}
			</div>

			{/* Content */}
			<div className="flex-1 min-w-0">
				<div className="flex items-center gap-1.5">
					{notification.provider && (
						<span className="text-[9px] font-semibold uppercase tracking-wider text-connexio-accent">
							{notification.provider}
						</span>
					)}
					<span className="text-[10px] text-connexio-text-muted flex items-center gap-0.5">
						<Clock size={9} />
						{timeAgo}
					</span>
				</div>
				<p className="text-xs font-medium text-connexio-text mt-0.5 truncate">
					{notification.title}
				</p>
				{notification.body && (
					<p className="text-[11px] text-connexio-text-secondary mt-0.5 line-clamp-2">
						{notification.body}
					</p>
				)}
			</div>

			{/* Remove button */}
			<button
				onClick={(e) => {
					e.stopPropagation();
					onRemove();
				}}
				className="flex-shrink-0 p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/20 transition-all"
				type="button"
			>
				<X size={10} className="text-connexio-text-muted" />
			</button>
		</div>
	);
}

function getTimeAgo(timestamp: number): string {
	const seconds = Math.floor((Date.now() - timestamp) / 1000);
	if (seconds < 60) return "just now";
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.floor(hours / 24);
	return `${days}d ago`;
}
