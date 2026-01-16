import { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Play, Keyboard, Palette, Layers, Zap, Settings, ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Demo - See Connexio in Action",
  description:
    "Watch demos and see Connexio's features in action. Explore the modern terminal interface.",
};

const demoSections = [
  {
    title: "Beautiful Interface",
    description: "A modern terminal that doesn't look like it's from the 90s.",
    icon: Palette,
    placeholderId: "screenshot-themes",
    features: [
      "Clean, modern design",
      "Syntax highlighting",
      "Smooth animations",
      "Responsive layout",
    ],
  },
  {
    title: "Multi-Tab Workflow",
    description: "Manage multiple terminals with ease using our tab system.",
    icon: Layers,
    placeholderId: "screenshot-sidebar",
    features: ["Drag and drop tabs", "Split views", "Session persistence", "Quick switcher"],
  },
  {
    title: "Lightning Fast",
    description: "Built on Tauri for exceptional performance.",
    icon: Zap,
    placeholderId: "screenshot-main",
    features: ["Instant startup", "Low memory usage", "Native performance", "Battery efficient"],
  },
  {
    title: "Fully Configurable",
    description: "Customize every aspect of your terminal experience.",
    icon: Settings,
    placeholderId: "screenshot-settings",
    features: ["Custom shortcuts", "Theme customization", "Font options", "Behavior settings"],
  },
];

const keyboardShortcuts = [
  { keys: "Ctrl + T", action: "New Tab" },
  { keys: "Ctrl + W", action: "Close Tab" },
  { keys: "Ctrl + `", action: "Toggle Terminal" },
  { keys: "Ctrl + /", action: "Search" },
  { keys: "Ctrl + ,", action: "Settings" },
  { keys: "F11", action: "Fullscreen" },
];

export default function DemoPage() {
  return (
    <div className="flex flex-col pt-16">
      {/* Hero */}
      <section className="py-24 bg-muted/30">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold mb-6">See Connexio in Action</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
            Explore the features that make Connexio the modern choice for developers. Watch demos,
            see screenshots, and learn keyboard shortcuts.
          </p>
          <Button asChild size="lg">
            <Link href="/download">
              <Play className="h-5 w-5 mr-2" />
              Download and Try It
            </Link>
          </Button>
        </div>
      </section>

      {/* Demo Sections */}
      <section className="py-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="space-y-24">
            {demoSections.map((section, index) => (
              <div
                key={index}
                className={`flex flex-col lg:flex-row gap-12 items-center ${
                  index % 2 === 1 ? "lg:flex-row-reverse" : ""
                }`}
              >
                {/* Content */}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <section.icon className="h-6 w-6 text-primary" />
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-bold">{section.title}</h2>
                  </div>
                  <p className="text-lg text-muted-foreground mb-6">{section.description}</p>
                  <ul className="space-y-3">
                    {section.features.map((feature, fIndex) => (
                      <li key={fIndex} className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Screenshot Placeholder */}
                <div className="flex-1 w-full">
                  <Card className="overflow-hidden">
                    <CardHeader className="bg-muted/50 pb-3">
                      <CardTitle className="text-sm font-normal flex items-center gap-2">
                        <div className="flex gap-1.5">
                          <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                          <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                          <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                        </div>
                        {section.placeholderId}.png
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="aspect-video bg-[#0d1117] flex items-center justify-center p-8">
                        <div className="text-center">
                          <section.icon className="h-16 w-16 text-primary/30 mx-auto mb-4" />
                          <p className="text-muted-foreground font-medium">{section.title}</p>
                          <p className="text-sm text-muted-foreground/70 mt-2">
                            Screenshot placeholder
                          </p>
                          <p className="text-xs text-muted-foreground/50 mt-1">
                            Replace at: /public/images/screenshots/
                            {section.placeholderId}.png
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Keyboard Shortcuts */}
      <section className="py-24 bg-muted/30">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Keyboard Shortcuts</h2>
            <p className="text-lg text-muted-foreground">
              Work faster with these keyboard shortcuts
            </p>
          </div>

          <div className="max-w-3xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {keyboardShortcuts.map((shortcut, index) => (
                <Card key={index}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <span className="text-muted-foreground">{shortcut.action}</span>
                    <kbd className="px-2 py-1 bg-muted rounded text-sm font-mono">
                      {shortcut.keys}
                    </kbd>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Ready to Try It Yourself?</h2>
          <p className="text-lg text-muted-foreground mb-8">
            Download Connexio now and experience all these features firsthand.
          </p>
          <Button asChild size="lg">
            <Link href="/download">
              Download Free
              <ArrowRight className="h-5 w-5 ml-2" />
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
