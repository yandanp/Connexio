import { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Download,
  Monitor,
  Apple,
  Terminal,
  Github,
  FileText,
  CheckCircle,
  Clock,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Download - Get Connexio Free",
  description:
    "Download Connexio, the modern terminal application. Available for Windows, macOS, and Linux.",
};

const downloadOptions = [
  {
    platform: "Windows",
    icon: Monitor,
    arch: "x64",
    format: ".msi",
    size: "~85 MB",
    beta: false,
    downloadUrl: "#",
  },
  {
    platform: "macOS",
    icon: Apple,
    arch: "Apple Silicon & Intel",
    format: ".dmg",
    size: "~92 MB",
    beta: false,
    downloadUrl: "#",
  },
  {
    platform: "Linux",
    icon: Monitor,
    arch: "x64",
    format: ".AppImage",
    size: "~78 MB",
    beta: false,
    downloadUrl: "#",
  },
];

const releaseNotes = [
  {
    version: "v1.0.0",
    date: "January 15, 2026",
    type: "major",
    changes: [
      "Initial release",
      "Modern terminal interface with syntax highlighting",
      "Multi-tab support with drag & drop",
      "5 beautiful themes (Nord, Dracula, Tokyo Night, etc.)",
      "Fully customizable keyboard shortcuts",
      "Shell integration for bash, zsh, and fish",
      "Cross-platform support (Windows, macOS, Linux)",
    ],
  },
];

export default function DownloadPage() {
  return (
    <div className="flex flex-col pt-16">
      {/* Hero */}
      <section className="py-24 bg-muted/30">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Badge variant="outline" className="mb-4">
            <CheckCircle className="h-3 w-3 mr-1" />
            Latest Version: v1.0.0
          </Badge>
          <h1 className="text-4xl sm:text-5xl font-bold mb-6">Download Connexio Free</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
            The modern terminal application you've been waiting for. Free, open-source, and
            available on all major platforms.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            {downloadOptions.map((option) => (
              <Button key={option.platform} size="lg" asChild>
                <a href={option.downloadUrl}>
                  <option.icon className="h-5 w-5 mr-2" />
                  Download for {option.platform}
                </a>
              </Button>
            ))}
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            By downloading, you agree to our{" "}
            <a href="/terms" className="underline hover:text-foreground">
              Terms of Service
            </a>{" "}
            and{" "}
            <a href="/privacy" className="underline hover:text-foreground">
              Privacy Policy
            </a>
          </p>
        </div>
      </section>

      {/* Download Options */}
      <section className="py-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl sm:text-4xl font-bold mb-12 text-center">Choose Your Platform</h2>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {downloadOptions.map((option) => (
              <Card key={option.platform} className="text-center hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="mx-auto p-4 rounded-full bg-primary/10 mb-4">
                    <option.icon className="h-10 w-10 text-primary" />
                  </div>
                  <CardTitle className="text-2xl">{option.platform}</CardTitle>
                  <p className="text-sm text-muted-foreground">{option.arch}</p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="text-sm text-muted-foreground">
                      <p>Format: {option.format}</p>
                      <p>Size: {option.size}</p>
                    </div>
                    <Button className="w-full" asChild>
                      <a href={option.downloadUrl}>
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Alternative Download */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto text-center">
            <h3 className="text-xl font-semibold mb-4">Prefer to Build from Source?</h3>
            <p className="text-muted-foreground mb-6">
              Connexio is open source! You can build it from source or download pre-built binaries
              from GitHub.
            </p>
            <div className="flex justify-center gap-4">
              <Button variant="outline" asChild>
                <a
                  href="https://github.com/username/connexio"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Github className="h-4 w-4 mr-2" />
                  View on GitHub
                </a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Release Notes */}
      <section className="py-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-3xl sm:text-4xl font-bold">Release Notes</h2>
              <Button variant="outline" asChild>
                <a href="/changelog">
                  <FileText className="h-4 w-4 mr-2" />
                  View Full Changelog
                </a>
              </Button>
            </div>

            <div className="space-y-8">
              {releaseNotes.map((release, index) => (
                <Card key={index}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-3">
                        {release.version}
                        <Badge variant={release.type === "major" ? "default" : "secondary"}>
                          {release.type}
                        </Badge>
                      </CardTitle>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        {release.date}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {release.changes.map((change, cIndex) => (
                        <li key={cIndex} className="flex items-start gap-2">
                          <CheckCircle className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                          <span>{change}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Need Help Installing?</h2>
          <p className="text-lg opacity-90 mb-8">
            Check out our installation guide for step-by-step instructions.
          </p>
          <Button asChild size="lg" variant="secondary" className="text-primary">
            <a href="/guide">View Installation Guide</a>
          </Button>
        </div>
      </section>
    </div>
  );
}
