import { Key } from "lucide-react";

export default function SSHIdentitiesView() {
	return (
		<div className="p-3 space-y-3">
			<div className="flex items-center gap-2">
				<Key size={14} className="text-connexio-accent" />
				<div>
					<div className="text-[11px] font-semibold text-connexio-text">Identities</div>
					<div className="text-[9px] text-connexio-text-muted">
						Reusable credentials are planned for the next SSH milestone.
					</div>
				</div>
			</div>
			<div className="rounded border border-connexio-border bg-connexio-bg-secondary p-3 text-[10px] text-connexio-text-muted leading-relaxed">
				Current hosts can already save passwords/passphrases securely in the OS keychain. This tab
				will later promote those into reusable identities shared across hosts.
			</div>
		</div>
	);
}
