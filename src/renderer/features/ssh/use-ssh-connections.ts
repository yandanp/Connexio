import { useEffect, useState } from "react";
import type { SSHConnection } from "../../../shared/types";

export function useSshConnections(projectId: string, searchQuery: string) {
	const [connections, setConnections] = useState<SSHConnection[]>([]);
	const [globalConnections, setGlobalConnections] = useState<SSHConnection[]>([]);

	useEffect(() => {
		window.connexio.ssh
			.list(projectId)
			.then(setConnections)
			.catch(() => {});
		window.connexio.ssh
			.listGlobal()
			.then(setGlobalConnections)
			.catch(() => {});
	}, [projectId]);

	const saveProjectConnections = async (conns: SSHConnection[]) => {
		setConnections(conns);
		await window.connexio.ssh.save(projectId, conns);
	};

	const saveGlobal = async (conns: SSHConnection[]) => {
		setGlobalConnections(conns);
		await window.connexio.ssh.saveGlobal(conns);
	};

	const matchesSearch = (conn: SSHConnection) => {
		const query = searchQuery.trim().toLowerCase();
		if (!query) return true;
		return [conn.name, conn.host, conn.username, conn.folder, ...(conn.tags || [])]
			.filter(Boolean)
			.some((value) => String(value).toLowerCase().includes(query));
	};

	const filteredProjectConnections = connections.filter(matchesSearch);
	const filteredGlobalConnections = globalConnections.filter(matchesSearch);

	return {
		connections,
		globalConnections,
		saveProjectConnections,
		saveGlobal,
		matchesSearch,
		filteredProjectConnections,
		filteredGlobalConnections,
	};
}
