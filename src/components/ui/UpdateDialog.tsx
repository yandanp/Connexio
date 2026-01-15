/**
 * UpdateDialog Component
 *
 * Shows update availability and handles download/install process.
 * Uses tauri-plugin-updater for auto-update functionality.
 */

import { useState, useEffect, useCallback } from "react";
import { check, Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./dialog";
import { Button } from "./button";
import { Download, RefreshCw, CheckCircle, AlertCircle, Loader2 } from "lucide-react";

interface UpdateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  checkOnMount?: boolean;
}

type UpdateStatus =
  | "idle"
  | "checking"
  | "available"
  | "downloading"
  | "ready"
  | "error"
  | "up-to-date";

export function UpdateDialog({
  open,
  onOpenChange,
  checkOnMount = false,
}: UpdateDialogProps) {
  const [status, setStatus] = useState<UpdateStatus>("idle");
  const [update, setUpdate] = useState<Update | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadedBytes, setDownloadedBytes] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);

  const checkForUpdates = useCallback(async () => {
    setStatus("checking");
    setError(null);

    try {
      const updateResult = await check();

      if (updateResult) {
        setUpdate(updateResult);
        setStatus("available");
      } else {
        setStatus("up-to-date");
      }
    } catch (err) {
      console.error("Update check failed:", err);
      setError(err instanceof Error ? err.message : "Failed to check for updates");
      setStatus("error");
    }
  }, []);

  const downloadAndInstall = useCallback(async () => {
    if (!update) return;

    setStatus("downloading");
    setDownloadProgress(0);
    setDownloadedBytes(0);
    setTotalBytes(0);

    try {
      await update.downloadAndInstall((event) => {
        if (event.event === "Started") {
          setTotalBytes(event.data.contentLength || 0);
        } else if (event.event === "Progress") {
          setDownloadedBytes((prev) => {
            const newBytes = prev + (event.data.chunkLength || 0);
            if (totalBytes > 0) {
              setDownloadProgress(Math.round((newBytes / totalBytes) * 100));
            }
            return newBytes;
          });
        } else if (event.event === "Finished") {
          setDownloadProgress(100);
        }
      });

      setStatus("ready");
    } catch (err) {
      console.error("Download failed:", err);
      setError(err instanceof Error ? err.message : "Failed to download update");
      setStatus("error");
    }
  }, [update, totalBytes]);

  const restartApp = useCallback(async () => {
    try {
      await relaunch();
    } catch (err) {
      console.error("Relaunch failed:", err);
      setError("Failed to restart application. Please restart manually.");
    }
  }, []);

  // Check for updates on mount if requested
  useEffect(() => {
    if (checkOnMount && open && status === "idle") {
      checkForUpdates();
    }
  }, [checkOnMount, open, status, checkForUpdates]);

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {status === "checking" && <Loader2 className="h-5 w-5 animate-spin" />}
            {status === "available" && <Download className="h-5 w-5 text-blue-500" />}
            {status === "downloading" && <Loader2 className="h-5 w-5 animate-spin" />}
            {status === "ready" && <CheckCircle className="h-5 w-5 text-green-500" />}
            {status === "up-to-date" && <CheckCircle className="h-5 w-5 text-green-500" />}
            {status === "error" && <AlertCircle className="h-5 w-5 text-red-500" />}
            {status === "idle" && <RefreshCw className="h-5 w-5" />}
            Software Update
          </DialogTitle>
          <DialogDescription>
            {status === "idle" && "Check for available updates."}
            {status === "checking" && "Checking for updates..."}
            {status === "available" && update && (
              <>
                Version <strong>{update.version}</strong> is available!
                {update.currentVersion && (
                  <> (Current: {update.currentVersion})</>
                )}
              </>
            )}
            {status === "downloading" && "Downloading update..."}
            {status === "ready" && "Update downloaded and ready to install."}
            {status === "up-to-date" && "You're running the latest version!"}
            {status === "error" && (error || "An error occurred.")}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {/* Release notes */}
          {status === "available" && update?.body && (
            <div className="mb-4">
              <h4 className="text-sm font-medium mb-2">What's New:</h4>
              <div className="text-sm text-muted-foreground bg-muted/50 rounded-md p-3 max-h-40 overflow-y-auto whitespace-pre-wrap">
                {update.body}
              </div>
            </div>
          )}

          {/* Download progress */}
          {status === "downloading" && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Downloading...</span>
                <span>
                  {formatBytes(downloadedBytes)}
                  {totalBytes > 0 && ` / ${formatBytes(totalBytes)}`}
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${downloadProgress}%` }}
                />
              </div>
              <div className="text-center text-sm text-muted-foreground">
                {downloadProgress}%
              </div>
            </div>
          )}

          {/* Ready to install */}
          {status === "ready" && (
            <div className="text-center py-2">
              <p className="text-sm text-muted-foreground mb-2">
                The update has been downloaded. Restart to apply changes.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {status === "idle" && (
            <Button onClick={checkForUpdates}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Check for Updates
            </Button>
          )}

          {status === "checking" && (
            <Button disabled>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Checking...
            </Button>
          )}

          {status === "available" && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Later
              </Button>
              <Button onClick={downloadAndInstall}>
                <Download className="h-4 w-4 mr-2" />
                Download & Install
              </Button>
            </>
          )}

          {status === "downloading" && (
            <Button disabled>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Downloading...
            </Button>
          )}

          {status === "ready" && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Restart Later
              </Button>
              <Button onClick={restartApp}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Restart Now
              </Button>
            </>
          )}

          {status === "up-to-date" && (
            <Button onClick={() => onOpenChange(false)}>Close</Button>
          )}

          {status === "error" && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button onClick={checkForUpdates}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Hook to check for updates on app startup
 */
export function useAutoUpdateCheck() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [update, setUpdate] = useState<Update | null>(null);

  useEffect(() => {
    const checkUpdate = async () => {
      try {
        const result = await check();
        if (result) {
          setUpdate(result);
          setUpdateAvailable(true);
        }
      } catch (err) {
        console.error("Auto update check failed:", err);
      }
    };

    // Check after a short delay to not block app startup
    const timer = setTimeout(checkUpdate, 3000);
    return () => clearTimeout(timer);
  }, []);

  return { updateAvailable, update };
}
