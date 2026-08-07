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
import ContextMenu, { type ContextMenuItem } from "../../core/ui/ContextMenu";

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
	const items: Array<ContextMenuItem | "separator"> = [];

	if (isDir) {
		items.push(
			{ icon: FilePlus, label: "New File", onClick: onNewFile },
			{ icon: FolderPlus, label: "New Folder", onClick: onNewFolder },
			{ icon: Terminal, label: "Open in Terminal", onClick: onOpenInTerminal },
			"separator",
		);
	}

	if (!isDir && (onOpenInSplitRight || onOpenInSplitDown)) {
		if (onOpenInSplitRight)
			items.push({ icon: Columns2, label: "Open in Split Right", onClick: onOpenInSplitRight });
		if (onOpenInSplitDown)
			items.push({ icon: Rows2, label: "Open in Split Down", onClick: onOpenInSplitDown });
		items.push("separator");
	}

	items.push(
		{ icon: Edit3, label: "Rename", shortcut: "F2", onClick: onRename },
		{ icon: Copy, label: "Copy Path", onClick: onCopyPath },
		{ icon: ExternalLink, label: "Open External", onClick: onOpenExternal },
		"separator",
		{ icon: Trash2, label: "Delete", onClick: onDelete, danger: true },
	);

	return <ContextMenu x={x} y={y} onClose={onClose} minWidth={208} items={items} />;
}
