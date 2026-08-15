import { Eye, EyeOff, Key, X } from "lucide-react";
import { useState } from "react";
import type { SSHConnection } from "../../../shared/types";

interface SSHConnectPromptProps {
	connection: SSHConnection;
	status: string;
	onConfirm: (password: string, remember: boolean) => void;
	onCancel: () => void;
}

export default function SSHConnectPrompt({
	connection,
	status,
	onConfirm,
	onCancel,
}: SSHConnectPromptProps) {
	const [password, setPassword] = useState("");
	const [showPassword, setShowPassword] = useState(false);
	const [remember, setRemember] = useState(false);

	return (
		<div className="m-2 p-2 rounded border border-connexio-accent/40 bg-connexio-bg-tertiary space-y-2">
			<div className="flex items-center gap-2">
				<Key size={12} className="text-connexio-accent" />
				<div className="flex-1 min-w-0">
					<div className="text-[11px] font-semibold text-connexio-text truncate">
						Connect to {connection.name}
					</div>
					<div className="text-[9px] text-connexio-text-muted truncate">
						{connection.username}@{connection.host}:{connection.port}
					</div>
				</div>
				<button onClick={onCancel} className="p-0.5 rounded hover:bg-connexio-bg" type="button">
					<X size={10} />
				</button>
			</div>
			<div className="relative">
				<input
					type={showPassword ? "text" : "password"}
					value={password}
					onChange={(e) => setPassword(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "Enter") onConfirm(password, remember);
						if (e.key === "Escape") onCancel();
					}}
					placeholder={connection.authMethod === "key" ? "Private key passphrase" : "Password"}
					className="w-full pr-7 px-2 py-1 text-[11px] bg-connexio-bg border border-connexio-border rounded text-connexio-text outline-none focus:border-connexio-accent"
					autoFocus
				/>
				<button
					onClick={() => setShowPassword((value) => !value)}
					className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-connexio-bg-tertiary"
					type="button"
				>
					{showPassword ? (
						<EyeOff size={10} className="text-connexio-text-muted" />
					) : (
						<Eye size={10} className="text-connexio-text-muted" />
					)}
				</button>
			</div>
			<label className="flex items-center gap-1 text-[9px] text-connexio-text-muted">
				<input
					type="checkbox"
					checked={remember}
					onChange={(e) => setRemember(e.target.checked)}
					className="w-3 h-3"
				/>
				Save {connection.authMethod === "key" ? "passphrase" : "password"} in OS keychain
			</label>
			<div className="flex gap-1">
				<button
					onClick={() => onConfirm(password, remember)}
					className="px-2 py-1 text-[10px] rounded bg-connexio-accent text-connexio-bg"
					type="button"
				>
					Connect
				</button>
				<button
					onClick={onCancel}
					className="px-2 py-1 text-[10px] rounded text-connexio-text-muted hover:bg-connexio-bg"
					type="button"
				>
					Cancel
				</button>
			</div>
		</div>
	);
}
