import { Check, FolderOpen, Zap } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { v4 as uuid } from "uuid";
import type { SSHConnection, SSHSecretRef } from "../../../shared/types";

export default function SSHEditForm({
	connection,
	section = "basic",
	onSectionChange,
	onSave,
	onCancel,
}: {
	connection?: SSHConnection;
	section?: "basic" | "auth" | "advanced";
	onSectionChange?: (section: "basic" | "auth" | "advanced") => void;
	onSave: (conn: SSHConnection) => void;
	onCancel: () => void;
}) {
	const [name, setName] = useState(connection?.name || "");
	const [host, setHost] = useState(connection?.host || "");
	const [port, setPort] = useState(connection?.port || 22);
	const [username, setUsername] = useState(connection?.username || "");
	const [authMethod, setAuthMethod] = useState<"password" | "key" | "agent">(
		connection?.authMethod || "password",
	);
	const [privateKeyPath, setPrivateKeyPath] = useState(connection?.privateKeyPath || "");
	const [testPassword, setTestPassword] = useState("");
	const [rememberSecret, setRememberSecret] = useState(false);
	const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
	const [testMessage, setTestMessage] = useState("");
	const [testFingerprint, setTestFingerprint] = useState<string | null>(null);
	const [testHostTrust, setTestHostTrust] = useState<"unknown" | "trusted" | "changed" | null>(
		null,
	);
	const [folder, setFolder] = useState(connection?.folder || "");
	const [tags, setTags] = useState((connection?.tags || []).join(", "));
	const [keepAliveSecs, setKeepAliveSecs] = useState(connection?.keepAliveSecs || 30);
	const [validationError, setValidationError] = useState("");
	const nameRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		nameRef.current?.focus();
	}, []);

	const handleSelectKey = async () => {
		const keyPath = await window.connexio.ssh.selectKey();
		if (keyPath) {
			setPrivateKeyPath(keyPath);
		}
	};

	const secretKey = (connId: string, kind: "password" | "passphrase") => `ssh:${connId}:${kind}`;
	const secretRef = (connId: string, kind: "password" | "passphrase"): SSHSecretRef => ({
		provider: "keychain",
		key: secretKey(connId, kind),
	});

	const handleSave = async () => {
		if (!name.trim() || !host.trim() || !username.trim()) {
			const missing = [
				!name.trim() && "name",
				!host.trim() && "host",
				!username.trim() && "username",
			].filter(Boolean);
			setValidationError(`Required: ${missing.join(", ")}`);
			return;
		}
		setValidationError("");
		const id = connection?.id || uuid();
		const shouldSavePassword = rememberSecret && authMethod === "password" && testPassword;
		const shouldSavePassphrase = rememberSecret && authMethod === "key" && testPassword;
		if (shouldSavePassword || shouldSavePassphrase) {
			await window.connexio.ssh.setSecret(
				secretKey(id, authMethod === "password" ? "password" : "passphrase"),
				testPassword,
			);
		}
		onSave({
			id,
			name: name.trim(),
			host: host.trim(),
			port,
			username: username.trim(),
			authMethod,
			privateKeyPath: authMethod === "key" ? privateKeyPath : undefined,
			folder: folder.trim() || undefined,
			tags: tags
				.split(",")
				.map((tag) => tag.trim())
				.filter(Boolean),
			passwordSecretRef: shouldSavePassword
				? secretRef(id, "password")
				: connection?.passwordSecretRef,
			passphraseSecretRef: shouldSavePassphrase
				? secretRef(id, "passphrase")
				: connection?.passphraseSecretRef,
			keepAliveSecs,
			startupCommands: connection?.startupCommands || [],
			tunnels: connection?.tunnels || [],
		});
	};

	const buildDraftConnection = (): SSHConnection => ({
		id: connection?.id || uuid(),
		name: name.trim() || "Untitled SSH",
		host: host.trim(),
		port,
		username: username.trim(),
		authMethod,
		privateKeyPath: authMethod === "key" ? privateKeyPath : undefined,
		folder: folder.trim() || undefined,
		tags: tags
			.split(",")
			.map((tag) => tag.trim())
			.filter(Boolean),
		keepAliveSecs,
		startupCommands: connection?.startupCommands || [],
		tunnels: connection?.tunnels || [],
	});

	const handleTestConnection = async () => {
		if (!host.trim() || !username.trim()) return;
		setTestStatus("testing");
		setTestMessage("Testing SSH connection...");
		try {
			const result = await window.connexio.ssh.testConnection(
				buildDraftConnection(),
				testPassword || undefined,
			);
			setTestStatus(result.success ? "success" : "error");
			setTestFingerprint(result.fingerprintSha256 || null);
			setTestHostTrust(result.hostTrust);
			if (result.success) {
				setTestMessage("Connection successful");
			} else {
				setTestMessage(result.message);
			}
		} catch (error) {
			setTestStatus("error");
			setTestFingerprint(null);
			setTestHostTrust(null);
			setTestMessage(String(error));
		}
	};

	const handleTrustHost = async () => {
		if (!host.trim() || !testFingerprint) return;
		await window.connexio.ssh.trustHost(host.trim(), port, testFingerprint);
		setTestHostTrust("trusted");
		setTestMessage("Host trusted");
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter") {
			e.preventDefault();
			handleSave();
		}
		if (e.key === "Escape") {
			e.preventDefault();
			onCancel();
		}
	};

	return (
		<div className="p-4 space-y-4 bg-connexio-bg-tertiary rounded-xl border border-connexio-border">
			<div className="flex items-center gap-1 rounded-lg bg-connexio-bg p-1 border border-connexio-border">
				{(["basic", "auth", "advanced"] as const).map((item) => (
					<button
						key={item}
						onClick={() => onSectionChange?.(item)}
						className={`flex-1 px-3 py-1.5 text-xs rounded-md capitalize transition-colors ${section === item ? "bg-connexio-accent/15 text-connexio-accent font-medium" : "text-connexio-text-muted hover:text-connexio-text"}`}
						type="button"
					>
						{item}
					</button>
				))}
			</div>

			{section === "basic" && (
				<div className="space-y-3">
					<div>
						<label className="block text-[11px] font-medium text-connexio-text-secondary mb-1">
							Connection name
						</label>
						<input
							ref={nameRef}
							type="text"
							placeholder="e.g. Production Server"
							value={name}
							onChange={(e) => setName(e.target.value)}
							onKeyDown={handleKeyDown}
							className="w-full px-3 py-2 text-xs bg-connexio-bg border border-connexio-border rounded-lg text-connexio-text outline-none focus:border-connexio-accent transition-colors"
						/>
					</div>
					<div>
						<label className="block text-[11px] font-medium text-connexio-text-secondary mb-1">
							Host & Port
						</label>
						<div className="flex gap-2">
							<input
								type="text"
								placeholder="hostname or IP"
								value={host}
								onChange={(e) => setHost(e.target.value)}
								onKeyDown={handleKeyDown}
								className="flex-1 px-3 py-2 text-xs bg-connexio-bg border border-connexio-border rounded-lg text-connexio-text outline-none focus:border-connexio-accent transition-colors"
							/>
							<input
								type="number"
								placeholder="22"
								value={port}
								onChange={(e) => setPort(Number(e.target.value) || 22)}
								onKeyDown={handleKeyDown}
								className="w-20 px-3 py-2 text-xs bg-connexio-bg border border-connexio-border rounded-lg text-connexio-text outline-none focus:border-connexio-accent text-center transition-colors"
							/>
						</div>
					</div>
					<div>
						<label className="block text-[11px] font-medium text-connexio-text-secondary mb-1">
							Username
						</label>
						<input
							type="text"
							placeholder="root"
							value={username}
							onChange={(e) => setUsername(e.target.value)}
							onKeyDown={handleKeyDown}
							className="w-full px-3 py-2 text-xs bg-connexio-bg border border-connexio-border rounded-lg text-connexio-text outline-none focus:border-connexio-accent transition-colors"
						/>
					</div>
				</div>
			)}

			{section === "auth" && (
				<div className="space-y-3">
					<div>
						<label className="block text-[11px] font-medium text-connexio-text-secondary mb-1">
							Authentication method
						</label>
						<div className="flex gap-1">
							{(["password", "key", "agent"] as const).map((method) => (
								<button
									key={method}
									onClick={() => setAuthMethod(method)}
									className={`flex-1 px-3 py-2 text-xs rounded-lg border transition-colors ${authMethod === method ? "border-connexio-accent bg-connexio-accent/10 text-connexio-accent font-medium" : "border-connexio-border text-connexio-text-muted hover:border-connexio-text-muted"}`}
									type="button"
								>
									{method === "password" ? "Password" : method === "key" ? "SSH Key" : "Agent"}
								</button>
							))}
						</div>
					</div>
					{authMethod === "key" && (
						<div>
							<label className="block text-[11px] font-medium text-connexio-text-secondary mb-1">
								Private key path
							</label>
							<div className="flex gap-2">
								<input
									type="text"
									placeholder="~/.ssh/id_rsa"
									value={privateKeyPath}
									onChange={(e) => setPrivateKeyPath(e.target.value)}
									onKeyDown={handleKeyDown}
									className="flex-1 px-3 py-2 text-xs bg-connexio-bg border border-connexio-border rounded-lg text-connexio-text outline-none focus:border-connexio-accent font-mono transition-colors"
								/>
								<button
									onClick={handleSelectKey}
									className="px-3 py-2 bg-connexio-bg border border-connexio-border rounded-lg hover:border-connexio-accent/50 transition-colors"
									type="button"
									title="Browse for key file"
								>
									<FolderOpen size={13} className="text-connexio-text-muted" />
								</button>
							</div>
						</div>
					)}
					{authMethod !== "agent" && (
						<div>
							<label className="block text-[11px] font-medium text-connexio-text-secondary mb-1">
								{authMethod === "key" ? "Passphrase" : "Password"}
							</label>
							<input
								type="password"
								placeholder={
									authMethod === "key" ? "Optional — for test & save" : "For test & save"
								}
								value={testPassword}
								onChange={(e) => setTestPassword(e.target.value)}
								onKeyDown={handleKeyDown}
								className="w-full px-3 py-2 text-xs bg-connexio-bg border border-connexio-border rounded-lg text-connexio-text outline-none focus:border-connexio-accent transition-colors"
							/>
							<label className="flex items-center gap-1.5 mt-2 text-[11px] text-connexio-text-muted cursor-pointer">
								<input
									type="checkbox"
									checked={rememberSecret}
									onChange={(e) => setRememberSecret(e.target.checked)}
									className="w-3.5 h-3.5 rounded"
								/>
								Save in OS keychain
							</label>
						</div>
					)}
					{testMessage && (
						<div
							className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs ${testStatus === "success" ? "text-green-400 bg-green-500/10" : testStatus === "error" ? "text-red-400 bg-red-500/10" : "text-connexio-text-muted bg-connexio-bg"}`}
						>
							{testStatus === "success" && <Check size={12} />}
							{testMessage}
						</div>
					)}
					{testFingerprint && testHostTrust !== "trusted" && (
						<button
							onClick={handleTrustHost}
							className={`w-full text-left text-xs px-3 py-2 rounded-lg border transition-colors ${testHostTrust === "changed" ? "border-red-500/50 text-red-300 bg-red-500/10" : "border-yellow-500/40 text-yellow-300 bg-yellow-500/10"}`}
							type="button"
						>
							{testHostTrust === "changed"
								? "Host key changed — trust new fingerprint"
								: "Trust this host fingerprint"}
						</button>
					)}
				</div>
			)}

			{section === "advanced" && (
				<div className="space-y-3">
					<div>
						<label className="block text-[11px] font-medium text-connexio-text-secondary mb-1">
							Folder & Keep-alive
						</label>
						<div className="flex gap-2">
							<input
								type="text"
								placeholder="Group folder"
								value={folder}
								onChange={(e) => setFolder(e.target.value)}
								onKeyDown={handleKeyDown}
								className="flex-1 px-3 py-2 text-xs bg-connexio-bg border border-connexio-border rounded-lg text-connexio-text outline-none focus:border-connexio-accent transition-colors"
							/>
							<div className="flex items-center gap-1">
								<input
									type="number"
									value={keepAliveSecs}
									onChange={(e) => setKeepAliveSecs(Number(e.target.value) || 30)}
									onKeyDown={handleKeyDown}
									className="w-16 px-2 py-2 text-xs bg-connexio-bg border border-connexio-border rounded-lg text-connexio-text outline-none focus:border-connexio-accent text-center transition-colors"
								/>
								<span className="text-[10px] text-connexio-text-muted">sec</span>
							</div>
						</div>
					</div>
					<div>
						<label className="block text-[11px] font-medium text-connexio-text-secondary mb-1">
							Tags
						</label>
						<input
							type="text"
							placeholder="production, web, aws"
							value={tags}
							onChange={(e) => setTags(e.target.value)}
							onKeyDown={handleKeyDown}
							className="w-full px-3 py-2 text-xs bg-connexio-bg border border-connexio-border rounded-lg text-connexio-text outline-none focus:border-connexio-accent transition-colors"
						/>
					</div>
				</div>
			)}

			{/* Actions */}
			{validationError && (
				<div className="text-xs text-red-400 bg-red-500/10 px-3 py-1.5 rounded-lg">
					{validationError}
				</div>
			)}
			<div className="flex items-center gap-2 pt-1 border-t border-connexio-border">
				<button
					onClick={handleTestConnection}
					disabled={!host.trim() || !username.trim() || testStatus === "testing"}
					className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-connexio-accent border border-connexio-accent/40 rounded-lg hover:bg-connexio-accent/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
					type="button"
				>
					<Zap size={11} />
					{testStatus === "testing" ? "Testing..." : "Test"}
				</button>
				<div className="flex-1" />
				<button
					onClick={onCancel}
					className="px-3 py-1.5 text-xs text-connexio-text-muted hover:text-connexio-text rounded-lg hover:bg-connexio-bg transition-colors"
					type="button"
				>
					Cancel
				</button>
				<button
					onClick={handleSave}
					className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium bg-connexio-accent text-connexio-bg rounded-lg hover:bg-connexio-accent-hover transition-colors"
					type="button"
				>
					<Check size={12} />
					{connection ? "Save" : "Add Host"}
				</button>
			</div>
		</div>
	);
}
