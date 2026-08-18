import { terminal } from "./terminal";
import { project } from "./projects";
import { session } from "./session";
import { settings } from "./settings";
import { workspace } from "./workspace";
import { tasks } from "./tasks";
import { pinned } from "./pinned";
import { ssh } from "./ssh";
import { git } from "./git";
import { worktree } from "./worktree";
import { theme } from "./theme";
import { app } from "./app";
import { updater } from "./updater";
import { notification } from "./notification";
import { discord } from "./discord";
import { remote } from "./remote";

export const connexioRemoteApi = {
	terminal,
	project,
	session,
	settings,
	workspace,
	tasks,
	pinned,
	ssh,
	git,
	worktree,
	theme,
	app,
	updater,
	notification,
	discord,
	remote,
};

export default connexioRemoteApi;
