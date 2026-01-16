import { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import {
  Download,
  CheckCircle,
  Terminal,
  FolderOpen,
  Settings,
  BookOpen,
  HelpCircle,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Getting Started Guide",
  description:
    "Learn how to get started with Connexio. Step-by-step guide to installation and first-time setup.",
};

const guideSteps = [
  {
    number: "01",
    title: "Download Connexio",
    description: "Get the latest version of Connexio for your operating system.",
    icon: Download,
    details: [
      "Choose your OS: Windows, macOS, or Linux",
      "Download the installer or portable version",
      "Check system requirements below",
    ],
  },
  {
    number: "02",
    title: "Install the Application",
    description: "Run the installer and follow the on-screen instructions.",
    icon: Terminal,
    details: [
      "Windows: Run the .msi installer",
      "macOS: Open the .dmg and drag to Applications",
      "Linux: Run the .AppImage or install via package manager",
    ],
  },
  {
    number: "03",
    title: "First Launch",
    description: "Open Connexio and complete the initial setup wizard.",
    icon: FolderOpen,
    details: [
      "Launch Connexio from your applications",
      "Choose your preferred theme",
      "Set up your default shell",
      "Configure initial settings",
    ],
  },
  {
    number: "04",
    title: "Customize Your Setup",
    description: "Make Connexio yours with themes, shortcuts, and more.",
    icon: Settings,
    details: [
      "Browse and apply themes",
      "Set up keyboard shortcuts",
      "Configure shell integration",
      "Add custom snippets",
    ],
  },
];

const faqs = [
  {
    question: "What are the system requirements?",
    answer:
      "Connexio requires Windows 10+, macOS 11+, or Linux (Ubuntu 20.04+, Fedora 35+, or equivalent). At least 4GB RAM and 100MB disk space recommended.",
  },
  {
    question: "Is Connexio free to use?",
    answer:
      "Yes, Connexio is completely free and open source under the MIT license. No hidden costs, no premium features.",
  },
  {
    question: "Can I import my settings from another terminal?",
    answer:
      "Yes! Connexio supports importing configurations from popular terminals. Go to Settings > Import to get started.",
  },
  {
    question: "Does Connexio support shell integration?",
    answer:
      "Yes, Connexio supports shell integration for bash, zsh, and fish. This enables features like command history and auto-suggestions.",
  },
  {
    question: "How do I report bugs or suggest features?",
    answer:
      "We welcome feedback! Visit our GitHub repository to report issues or suggest new features.",
  },
  {
    question: "Is my data secure?",
    answer:
      "Yes, Connexio is designed with security in mind. Your data stays local and is never sent to external servers.",
  },
];

export default function GuidePage() {
  return (
    <div className="flex flex-col pt-16">
      {/* Hero */}
      <section className="py-24 bg-muted/30">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Badge variant="secondary" className="mb-4">
            <BookOpen className="h-3 w-3 mr-1" />
            Getting Started
          </Badge>
          <h1 className="text-4xl sm:text-5xl font-bold mb-6">Your Guide to Connexio</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
            From installation to advanced customization, this guide will help you get the most out
            of Connexio.
          </p>
          <Button asChild size="lg">
            <Link href="/download">Get Started</Link>
          </Button>
        </div>
      </section>

      {/* Installation Steps */}
      <section className="py-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Installation Steps</h2>
            <p className="text-lg text-muted-foreground">
              Get up and running in just a few minutes
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {guideSteps.map((step, index) => (
              <Card key={index} className="relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5">
                  <step.icon className="h-32 w-32" />
                </div>
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <Badge variant="outline" className="text-lg px-3 py-1">
                      {step.number}
                    </Badge>
                    <step.icon className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-xl mt-2">{step.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground mb-4">{step.description}</p>
                  <ul className="space-y-2">
                    {step.details.map((detail, dIndex) => (
                      <li key={dIndex} className="flex items-start gap-2 text-sm">
                        <CheckCircle className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                        <span>{detail}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* System Requirements */}
      <section className="py-24 bg-muted/30">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-bold mb-8 text-center">System Requirements</h2>

            <div className="grid md:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Windows</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>Windows 10 or later</li>
                    <li>x64 architecture</li>
                    <li>4GB RAM minimum</li>
                    <li>100MB disk space</li>
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">macOS</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>macOS 11 (Big Sur) or later</li>
                    <li>Apple Silicon or Intel</li>
                    <li>4GB RAM minimum</li>
                    <li>100MB disk space</li>
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Linux</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>Ubuntu 20.04+ / Fedora 35+</li>
                    <li>x64 architecture</li>
                    <li>4GB RAM minimum</li>
                    <li>100MB disk space</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Frequently Asked Questions</h2>
            <p className="text-lg text-muted-foreground">Have questions? We have answers.</p>
          </div>

          <div className="max-w-3xl mx-auto space-y-4">
            {faqs.map((faq, index) => (
              <Card key={index}>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <HelpCircle className="h-5 w-5 text-primary" />
                    {faq.question}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{faq.answer}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Ready to Get Started?</h2>
          <p className="text-lg opacity-90 mb-8">
            Download Connexio now and join thousands of happy users.
          </p>
          <Button asChild size="lg" variant="secondary">
            <Link href="/download">Download Now</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
