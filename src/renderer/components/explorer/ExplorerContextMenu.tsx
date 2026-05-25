import {
	Columns2,
	Copy,
	Edit3,
	ExternalLink,
	FilePlus,
	FolderPlus,
	Rows2,
	Terminal,
	Trash2,
} from "lucide-react";
import { useEffect, useRef } from "react";

interface Props {
	x: number;
	y: number;
	isDir: boolean;
	onClose: () => void;
	onRename: () => void;
	onDelete: () => void;
	onNewFile: () => void;
	onNewFolder: () => void;
	onCopyPath: () => void;
	onOpenInTerminal: () => void;
	onOpenExternal: () => void;
	onOpenInSplitRight?: () => void;
	onOpenInSplitDown?: () => void;
}

export default function ExplorerContextMenu({
	x,
	y,
	isDir,
	onClose,
	onRename,
	onDelete,
	onNewFile,
	onNewFolder,
	onCopyPath,
	onOpenInTerminal,
	onOpenExternal,
	onOpenInSplitRight,
	onOpenInSplitDown,
}: Props) {
	const menuRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
				onClose();
			}
		};
		const handleEscape = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		document.addEventListener("mousedown", handleClickOutside);
		document.addEventListener("keydown", handleEscape);
		return () => {
			document.removeEventListener("mousedown", handleClickOutside);
			document.removeEventListener("keydown", handleEscape);
		};
	}, [onClose]);

	const width = 180;
	const height = isDir ? 250 : 230;
	const left = Math.min(x, window.innerWidth - width - 8);
	const top = Math.min(y, window.innerHeight - height - 8);

	const MenuItem = ({
		icon: Icon,
		label,
		onClick,
		danger,
	}: {
		icon: any;
		label: string;
		onClick: () => void;
		danger?: boolean;
	}) => (
		<button
			onClick={() => {
				onClick();
				onClose();
			}}
			className={`flex items-center gap-2 w-full px-3 py-1.5 text-[11px] text-left transition-colors ${
				danger
					? "text-red-400 hover:bg-red-500/10"
					: "text-connexio-text hover:bg-connexio-bg-tertiary"
			}`}
			type="button"
		>
			<Icon size={12} className="flex-shrink-0" />
			{label}
		</button>
	);

	return (
		<div
			ref={menuRef}
			style={{ position: "fixed", left, top, zIndex: 9999, width }}
			className="bg-connexio-bg-secondary border border-connexio-border rounded-md shadow-xl py-1"
		>
			{isDir && (
				<>
					<MenuItem icon={FilePlus} label="New File" onClick={onNewFile} />
					<MenuItem icon={FolderPlus} label="New Folder" onClick={onNewFolder} />
					<MenuItem icon={Terminal} label="Open in Terminal" onClick={onOpenInTerminal} />
					<div className="h-px bg-connexio-border my-1" />
				</>
			)}
			{!isDir && (onOpenInSplitRight || onOpenInSplitDown) && (
				<>
					{onOpenInSplitRight && (
						<MenuItem icon={Columns2} label="Open in Split Right" onClick={onOpenInSplitRight} />
					)}
					{onOpenInSplitDown && (
						<MenuItem icon={Rows2} label="Open in Split Down" onClick={onOpenInSplitDown} />
					)}
					<div className="h-px bg-connexio-border my-1" />
				</>
			)}
			<MenuItem icon={Edit3} label="Rename" onClick={onRename} />
			<MenuItem icon={Copy} label="Copy Path" onClick={onCopyPath} />
			<MenuItem icon={ExternalLink} label="Open External" onClick={onOpenExternal} />
			<div className="h-px bg-connexio-border my-1" />
			<MenuItem icon={Trash2} label="Delete" onClick={onDelete} danger />
		</div>
	);
}
