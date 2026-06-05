import { ClipboardPaste, Copy } from "lucide-react";
import ContextMenu from "./ContextMenu";

interface Props {
	x: number;
	y: number;
	hasSelection: boolean;
	onCopy: () => void;
	onPaste: () => void;
	onClose: () => void;
}

export default function TerminalContextMenu({
	x,
	y,
	hasSelection,
	onCopy,
	onPaste,
	onClose,
}: Props) {
	return (
		<ContextMenu
			x={x}
			y={y}
			onClose={onClose}
			minWidth={176}
			items={[
				{ icon: Copy, label: "Copy", shortcut: "Ctrl+C", onClick: onCopy, disabled: !hasSelection },
				{ icon: ClipboardPaste, label: "Paste", shortcut: "Ctrl+Shift+V", onClick: onPaste },
			]}
		/>
	);
}
