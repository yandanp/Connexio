import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function getLatestVersion(): string {
  return "1.0.0";
}

export function getDownloadUrl(os: string): string {
  const baseUrl = "https://github.com/username/connexio/releases/latest";
  const version = getLatestVersion();

  const assets: Record<string, string> = {
    windows: `Connexio_${version}_x64_en-US.msi`,
    macos: `Connexio_${version}_x64.dmg`,
    linux: `Connexio_${version}_x64.AppImage`,
  };

  return assets[os] || baseUrl;
}
