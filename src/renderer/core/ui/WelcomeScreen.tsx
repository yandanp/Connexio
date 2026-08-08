import { ArrowLeft, FolderPlus, Palette, Sparkles, Terminal, Zap } from "lucide-react";
import { useState } from "react";
import { AddProjectModal, useProjectsStore } from "../../features/projects";
import { useThemeStore } from "../stores/themeStore";
import type { Project } from "../../../shared/types";

export default function WelcomeScreen({
	canClose,
	onClose,
	onProjectSelected,
}: {
	canClose?: boolean;
	onClose?: () => void;
	onProjectSelected?: () => void;
}) {
	const { projects } = useProjectsStore();
	const { themes, setTheme, currentTheme } = useThemeStore();
	const [showAddModal, setShowAddModal] = useState(false);
	const [showThemes, setShowThemes] = useState(false);

	const recentProjects = [...projects].sort((a, b) => b.lastOpenedAt - a.lastOpenedAt).slice(0, 5);

	return (
		<div className="relative flex flex-1 items-center justify-center overflow-hidden p-8">
			{canClose && (
				<button
					onClick={onClose}
					className="dock-button interaction-lift absolute left-5 top-5 z-10 flex items-center gap-2 px-3 py-2 text-xs font-semibold"
					type="button"
				>
					<ArrowLeft size={14} />
					Back to Workspace
				</button>
			)}
			<div className="pointer-events-none absolute inset-0 opacity-80 [background:radial-gradient(circle_at_50%_18%,rgba(56,189,248,0.12),transparent_28%),radial-gradient(circle_at_66%_52%,rgba(139,92,246,0.08),transparent_28%)]" />
			<div className="pointer-events-none absolute h-[520px] w-[520px] rounded-full border border-white/[0.035]" />
			<div className="pointer-events-none absolute h-[360px] w-[360px] rounded-full border border-white/[0.03]" />

			<div className="animate-fade-scale relative grid w-full max-w-5xl grid-cols-[1.05fr_0.95fr] gap-6 max-lg:max-w-2xl max-lg:grid-cols-1">
				<section className="glass-panel overflow-hidden rounded-3xl p-8 shadow-[0_24px_70px_rgba(0,0,0,0.28)]">
					<div className="mb-7 flex items-center gap-3">
						<img
							src={new URL("../../assets/icon.png", import.meta.url).href}
							alt="Connexio"
							className="h-16 w-16 rounded-[1.35rem] object-contain shadow-[0_0_34px_rgba(56,189,248,0.2)]"
						/>
						<div>
							<div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-connexio-accent">
								<Sparkles size={12} /> Project Command Center
							</div>
							<h1 className="mt-1 text-3xl font-bold tracking-[-0.03em] text-connexio-text">
								Open a project. Keep every terminal in context.
							</h1>
						</div>
					</div>

					<p className="mb-7 max-w-xl text-sm leading-6 text-connexio-text-secondary">
						Connexio organizes terminals, tasks, files, git, SSH, previews, and AI around the
						project you are working on.
					</p>

					<div className="mb-8 flex flex-wrap gap-3">
						<button
							onClick={() => setShowAddModal(true)}
							className="flex items-center gap-2 rounded-xl bg-connexio-accent px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-[0_12px_28px_rgba(56,189,248,0.22)] transition-colors hover:bg-connexio-accent-hover"
							type="button"
						>
							<FolderPlus size={16} /> Add Project
						</button>
						<button
							onClick={() => setShowThemes(!showThemes)}
							className="flex items-center gap-2 rounded-xl bg-connexio-bg-tertiary/75 px-4 py-2.5 text-sm font-medium text-connexio-text-secondary transition-colors hover:bg-connexio-bg-elevated hover:text-connexio-text"
							type="button"
						>
							<Palette size={16} /> Themes
						</button>
					</div>

					<div className="grid grid-cols-3 gap-3 max-sm:grid-cols-1">
						<FeaturePill icon={<Terminal size={14} />} label="Persistent terminals" />
						<FeaturePill icon={<Zap size={14} />} label="Detected scripts" />
						<FeaturePill icon={<Sparkles size={14} />} label="Contextual workspace" />
					</div>
				</section>

				<aside className="glass-panel rounded-3xl p-5 shadow-[0_24px_70px_rgba(0,0,0,0.22)]">
					{showThemes ? (
						<ThemeSelector themes={themes} currentTheme={currentTheme} setTheme={setTheme} />
					) : (
						<RecentProjects
							projects={recentProjects}
							onAdd={() => setShowAddModal(true)}
							onProjectSelected={onProjectSelected}
						/>
					)}
				</aside>
			</div>

			{showAddModal && <AddProjectModal onClose={() => setShowAddModal(false)} />}
		</div>
	);
}

function FeaturePill({ icon, label }: { icon: React.ReactNode; label: string }) {
	return (
		<div className="flex items-center gap-2 rounded-xl bg-white/[0.035] px-3 py-2 text-xs font-medium text-connexio-text-secondary">
			<span className="text-connexio-accent">{icon}</span>
			{label}
		</div>
	);
}

function ThemeSelector({ themes, currentTheme, setTheme }: any) {
	return (
		<div>
			<h2 className="mb-1 text-sm font-semibold text-connexio-text">Choose a theme</h2>
			<p className="mb-4 text-xs text-connexio-text-muted">Tune Connexio to your workspace mood.</p>
			<div className="space-y-2">
				{themes.map((theme: any) => (
					<button
						key={theme.id}
						onClick={() => setTheme(theme.id)}
						className={`interaction-lift flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors ${currentTheme?.id === theme.id ? "bg-connexio-accent/12 text-connexio-text shadow-[inset_2px_0_0_var(--accent-color)]" : "bg-white/[0.025] text-connexio-text-secondary hover:bg-white/[0.045]"}`}
						type="button"
					>
						<span
							className="h-3 w-3 rounded-full"
							style={{ backgroundColor: theme.colors.accentColor }}
						/>
						<span className="text-xs font-medium">{theme.name}</span>
					</button>
				))}
			</div>
		</div>
	);
}

function RecentProjects({
	projects,
	onAdd,
	onProjectSelected,
}: {
	projects: Project[];
	onAdd: () => void;
	onProjectSelected?: () => void;
}) {
	return (
		<div>
			<div className="mb-4 flex items-center justify-between">
				<div>
					<h2 className="text-sm font-semibold text-connexio-text">Recent projects</h2>
					<p className="text-xs text-connexio-text-muted">Jump back into a saved workspace.</p>
				</div>
			</div>
			{projects.length > 0 ? (
				<div className="space-y-2">
					{projects.map((project) => (
						<RecentProjectItem
							key={project.id}
							project={project}
							onProjectSelected={onProjectSelected}
						/>
					))}
				</div>
			) : (
				<button
					onClick={onAdd}
					className="interaction-lift flex w-full items-center gap-3 rounded-2xl bg-white/[0.035] p-4 text-left transition-colors hover:bg-white/[0.055]"
					type="button"
				>
					<FolderPlus size={18} className="text-connexio-accent" />
					<div>
						<p className="text-sm font-medium text-connexio-text">Add your first project</p>
						<p className="text-xs text-connexio-text-muted">
							Create a workspace with persistent terminal tabs.
						</p>
					</div>
				</button>
			)}
		</div>
	);
}

function RecentProjectItem({
	project,
	onProjectSelected,
}: {
	project: Project;
	onProjectSelected?: () => void;
}) {
	const { setActiveProject } = useProjectsStore();

	return (
		<button
			onClick={() => {
				setActiveProject(project.id);
				onProjectSelected?.();
			}}
			className="group interaction-lift flex w-full items-center gap-3 rounded-xl bg-white/[0.025] px-3 py-2.5 text-left transition-colors hover:bg-white/[0.055]"
			type="button"
		>
			<div className="h-8 w-8 flex-shrink-0 rounded-lg bg-connexio-accent/10 shadow-[inset_2px_0_0_var(--accent-color)]" />
			<div className="min-w-0 flex-1">
				<p className="truncate text-xs font-semibold text-connexio-text">{project.name}</p>
				<p className="truncate text-[10px] text-connexio-text-muted">{project.path}</p>
			</div>
		</button>
	);
}
