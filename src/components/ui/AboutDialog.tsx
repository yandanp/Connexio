/**
 * AboutDialog - Application information and version display
 *
 * Story 1.8: Display Application Version Information
 *
 * Features:
 * - App name and logo
 * - Version number
 * - Description
 * - Links to resources
 */

import { useEffect, useState } from "react";
import { Link2, Github, Heart, ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { getAppVersion, getTauriVersion, isTauri } from "@/lib/tauri";
import { cn } from "@/lib/utils";

interface AboutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface AppInfo {
  version: string;
  tauriVersion: string;
}

export function AboutDialog({ open, onOpenChange }: AboutDialogProps) {
  const [appInfo, setAppInfo] = useState<AppInfo>({
    version: "0.1.0",
    tauriVersion: "2.x",
  });

  useEffect(() => {
    if (open && isTauri()) {
      Promise.all([getAppVersion(), getTauriVersion()]).then(([version, tauriVersion]) => {
        setAppInfo({ version, tauriVersion });
      });
    }
  }, [open]);

  const currentYear = new Date().getFullYear();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader className="items-center text-center">
          {/* App Logo */}
          <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-2">
            <Link2 className="h-8 w-8 text-primary" />
          </div>

          <DialogTitle className="text-2xl font-bold">Connexio</DialogTitle>
          <DialogDescription className="text-center">
            Modern Windows terminal with session persistence
          </DialogDescription>
        </DialogHeader>

        {/* Version Info */}
        <div className="space-y-3 py-4">
          <InfoRow label="Version" value={appInfo.version} />
          <InfoRow label="Tauri" value={appInfo.tauriVersion} />
          <InfoRow label="Platform" value="Windows" />
        </div>

        {/* Divider */}
        <div className="border-t border-border" />

        {/* Features */}
        <div className="py-4 space-y-2">
          <p className="text-sm text-muted-foreground text-center">
            ✨ Session persistence across restarts
          </p>
          <p className="text-sm text-muted-foreground text-center">🎨 Beautiful built-in themes</p>
          <p className="text-sm text-muted-foreground text-center">
            ⚡ Multi-shell support (PowerShell, CMD, WSL, Git Bash)
          </p>
        </div>

        {/* Divider */}
        <div className="border-t border-border" />

        {/* Footer */}
        <div className="pt-4 space-y-3">
          {/* Links */}
          <div className="flex justify-center gap-4">
            <LinkButton
              href="https://github.com/user/connexio"
              icon={<Github className="h-4 w-4" />}
              label="GitHub"
            />
            <LinkButton
              href="https://github.com/user/connexio/releases"
              icon={<ExternalLink className="h-4 w-4" />}
              label="Releases"
            />
          </div>

          {/* Copyright */}
          <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1">
            Made with <Heart className="h-3 w-3 text-red-500 fill-red-500" /> by Bos Yanda
          </p>
          <p className="text-xs text-muted-foreground text-center">
            © {currentYear} Connexio. All rights reserved.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Info row component
 */
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono text-foreground">{value}</span>
    </div>
  );
}

/**
 * Link button component
 */
function LinkButton({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  const handleClick = async () => {
    try {
      const { openUrl } = await import("@tauri-apps/plugin-opener");
      await openUrl(href);
    } catch {
      // Fallback to window.open
      window.open(href, "_blank");
    }
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm",
        "text-muted-foreground hover:text-foreground",
        "hover:bg-muted transition-colors"
      )}
    >
      {icon}
      {label}
    </button>
  );
}
