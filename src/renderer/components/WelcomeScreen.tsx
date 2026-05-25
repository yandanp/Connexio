import { FolderPlus, Palette, Terminal } from "lucide-react";
import { useState } from "react";
import { useProjectStore } from "../stores/projectStore";
import { useThemeStore } from "../stores/themeStore";
import AddProjectModal from "./AddProjectModal";

export default function WelcomeScreen() {
	const { projects } = useProjectStore();
	const { themes, setTheme, currentTheme } = useThemeStore();
	const [showAddModal, setShowAddModal] = useState(false);
	const [showThemes, setShowThemes] = useState(false);

	// Recent projects (sorted by lastOpenedAt)
	const recentProjects = [...projects]
		.sort((a, b) => b.lastOpenedAt - a.lastOpenedAt)
		.slice(0, 5);

	return (
		<div className="flex-1 flex items-center justify-center">
			<div className="text-center max-w-md">
				{/* Logo */}
				<div className="flex justify-center mb-6">
					<div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-connexio-accent to-purple-600 flex items-center justify-center shadow-lg shadow-connexio-accent/20">
						<Terminal size={32} className="text-white" />
					</div>
				</div>

				<h1 className="text-2xl font-bold text-connexio-text mb-2">
					Welcome to Connexio
				</h1>
				<p className="text-sm text-connexio-text-secondary mb-8">
					Organize your terminals by project. Add a project to get started.
				</p>

				{/* Quick actions */}
				<div className="flex justify-center gap-3 mb-8">
					<button
						onClick={() => setShowAddModal(true)}
						className="flex items-center gap-2 px-4 py-2.5 bg-connexio-accent text-white text-sm font-medium rounded-lg hover:bg-connexio-accent-hover transition-colors"
						type="button"
					>
						<FolderPlus size={16} />
						Add Project
					</button>
					<button
						onClick={() => setShowThemes(!showThemes)}
						className="flex items-center gap-2 px-4 py-2.5 bg-connexio-bg-tertiary border border-connexio-border text-connexio-text-secondary text-sm font-medium rounded-lg hover:bg-connexio-bg-secondary transition-colors"
						type="button"
					>
						<Palette size={16} />
						Themes
					</button>
				</div>

				{/* Theme selector */}
				{showThemes && (
					<div className="mb-8 p-4 bg-connexio-bg-secondary border border-connexio-border rounded-lg">
						<h3 className="text-xs font-semibold text-connexio-text-secondary mb-3 uppercase tracking-wider">
							Select Theme
						</h3>
						<div className="flex flex-wrap justify-center gap-2">
							{themes.map((theme) => (
								<button
									key={theme.id}
									onClick={() => setTheme(theme.id)}
									className={`flex items-center gap-2 px-3 py-2 rounded border transition-colors ${
										currentTheme?.id === theme.id
											? "border-connexio-accent bg-connexio-accent/10"
											: "border-connexio-border hover:border-connexio-text-muted"
									}`}
									type="button"
								>
									<div
										className="w-3 h-3 rounded-full"
										style={{ backgroundColor: theme.colors.accentColor }}
									/>
									<span className="text-xs text-connexio-text">
										{theme.name}
									</span>
								</button>
							))}
						</div>
					</div>
				)}

				{/* Recent projects */}
				{recentProjects.length > 0 && (
					<div className="text-left">
						<h3 className="text-xs font-semibold text-connexio-text-secondary mb-2 uppercase tracking-wider">
							Recent Projects
						</h3>
						<div className="space-y-1">
							{recentProjects.map((project) => (
								<RecentProjectItem key={project.id} project={project} />
							))}
						</div>
					</div>
				)}
			</div>

			{showAddModal && (
				<AddProjectModal onClose={() => setShowAddModal(false)} />
			)}
		</div>
	);
}

function RecentProjectItem({
	project,
}: {
	project: import("../../shared/types").Project;
}) {
	const { setActiveProject } = useProjectStore();

	return (
		<button
			onClick={() => setActiveProject(project.id)}
			className="w-full flex items-center gap-3 px-3 py-2 rounded hover:bg-connexio-bg-tertiary transition-colors text-left"
			type="button"
		>
			<div className="w-2 h-2 rounded-full bg-connexio-accent/60" />
			<div className="flex-1 min-w-0">
				<p className="text-xs text-connexio-text truncate">{project.name}</p>
				<p className="text-[10px] text-connexio-text-muted truncate">
					{project.path}
				</p>
			</div>
		</button>
	);
}
