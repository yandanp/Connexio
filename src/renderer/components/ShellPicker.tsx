import { ChevronDown, Plus, Terminal } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ShellInfo } from "../../shared/types";
import { useSettingsStore } from "../stores/settingsStore";

interface Props {
	onSelect: (shell?: string) => void;
}

export default function ShellPicker({ onSelect }: Props) {
	const { shells, loadShells } = useSettingsStore();
	const [isOpen, setIsOpen] = useState(false);
	const triggerRef = useRef<HTMLButtonElement>(null);
	const dropdownRef = useRef<HTMLDivElement>(null);
	const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });

	useEffect(() => {
		if (shells.length === 0) {
			loadShells();
		}
	}, []);

	// Calculate dropdown position when opening
	useEffect(() => {
		if (!isOpen || !triggerRef.current) return;
		const rect = triggerRef.current.getBoundingClientRect();
		const menuWidth = 208; // w-52 = 13rem = 208px
		let left = rect.right - menuWidth;
		if (left < 8) left = 8;
		setDropdownPos({ top: rect.bottom + 4, left });
	}, [isOpen]);

	// Close dropdown on outside click
	useEffect(() => {
		if (!isOpen) return;
		const handleClick = (e: MouseEvent) => {
			const target = e.target as Node;
			if (
				triggerRef.current?.contains(target) ||
				dropdownRef.current?.contains(target)
			) {
				return;
			}
			setIsOpen(false);
		};
		document.addEventListener("mousedown", handleClick);
		return () => document.removeEventListener("mousedown", handleClick);
	}, [isOpen]);

	const handleDefaultClick = () => {
		onSelect(undefined); // Use default shell
	};

	const handleShellSelect = (shell: ShellInfo) => {
		onSelect(shell.path);
		setIsOpen(false);
	};

	return (
		<div className="relative flex items-center">
			{/* Main button — opens default shell */}
			<button
				onClick={handleDefaultClick}
				className="flex items-center justify-center w-7 h-7 rounded-l hover:bg-connexio-bg-tertiary transition-colors border-r border-connexio-border"
				title="New Terminal (default shell)"
				type="button"
			>
				<Plus size={13} className="text-connexio-text-secondary" />
			</button>

			{/* Dropdown arrow */}
			<button
				ref={triggerRef}
				onClick={() => setIsOpen(!isOpen)}
				className="flex items-center justify-center w-5 h-7 rounded-r hover:bg-connexio-bg-tertiary transition-colors"
				title="Choose shell"
				type="button"
			>
				<ChevronDown size={10} className="text-connexio-text-muted" />
			</button>

			{/* Dropdown menu — rendered via portal to avoid overflow clipping */}
			{isOpen &&
				createPortal(
					<div
						ref={dropdownRef}
						className="fixed w-52 bg-connexio-bg-secondary border border-connexio-border rounded-lg shadow-xl z-[100] py-1 overflow-hidden"
						style={{ top: dropdownPos.top, left: dropdownPos.left }}
					>
						<div className="px-3 py-1.5 border-b border-connexio-border">
							<span className="text-[10px] font-semibold text-connexio-text-muted uppercase tracking-wider">
								Select Shell
							</span>
						</div>
						{shells.map((shell) => (
							<button
								key={shell.id}
								onClick={() => handleShellSelect(shell)}
								className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-connexio-bg-tertiary transition-colors"
								type="button"
							>
								<Terminal
									size={12}
									className="text-connexio-text-muted flex-shrink-0"
								/>
								<div className="flex-1 min-w-0">
									<p className="text-xs text-connexio-text truncate">
										{shell.name}
									</p>
									<p className="text-[10px] text-connexio-text-muted truncate">
										{shell.path}
									</p>
								</div>
							</button>
						))}
						{shells.length === 0 && (
							<div className="px-3 py-3 text-center">
								<p className="text-xs text-connexio-text-muted">
									Detecting shells...
								</p>
							</div>
						)}
					</div>,
					document.body,
				)}
		</div>
	);
}
