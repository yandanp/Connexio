import { TitleBar } from "./TitleBar";
import { WorkspaceSidebar } from "@/components/ui";

interface MainLayoutProps {
  children: React.ReactNode;
  /** Title to display in the title bar */
  title?: string;
  /** Callback when settings button is clicked */
  onSettingsClick?: () => void;
  /** Callback when about button is clicked */
  onAboutClick?: () => void;
}

export function MainLayout({ children, title, onSettingsClick, onAboutClick }: MainLayoutProps) {
  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-background">
      <TitleBar title={title} onSettingsClick={onSettingsClick} onAboutClick={onAboutClick} />
      <div className="flex-1 flex overflow-hidden">
        {/* Workspace Sidebar - Icon Rail */}
        <WorkspaceSidebar />
        {/* Main Content */}
        <main className="flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  );
}
