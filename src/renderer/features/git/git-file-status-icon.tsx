import { FileCode, FileMinus, FilePlus, FileQuestion, FileWarning } from "lucide-react";
import type { FileGroup } from "./git-file-grouping";

export function getStatusIcon(status: string, group: FileGroup) {
	if (group === "untracked") return <FileQuestion size={12} className="text-connexio-text-muted" />;
	switch (status) {
		case "M":
			return <FileCode size={12} className="text-yellow-400" />;
		case "A":
			return <FilePlus size={12} className="text-green-400" />;
		case "D":
			return <FileMinus size={12} className="text-red-400" />;
		case "U":
			return <FileWarning size={12} className="text-orange-400" />;
		default:
			return <FileCode size={12} className="text-connexio-text-muted" />;
	}
}
