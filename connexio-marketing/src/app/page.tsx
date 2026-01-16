import { Metadata } from "next";
import { HeroSection } from "@/components/landing/HeroSection";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import {
  Terminal,
  Zap,
  Shield,
  Palette,
  Layers,
  Settings,
  ArrowRight,
  Download,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Modern Terminal for Everyone",
  description:
    "Connexio is a modern terminal application built with Tauri and React. Download now and experience the next generation of developer tools.",
};

const features = [
  {
    icon: Terminal,
    title: "Modern Interface",
    description:
      "Beautiful, intuitive interface that makes terminal usage a joy. Features syntax highlighting, tabs, and more.",
  },
  {
    icon: Zap,
    title: "Lightning Fast",
    description:
      "Built on Tauri for blazing fast performance. Startup in milliseconds, not seconds.",
  },
  {
    icon: Shield,
    title: "Secure by Design",
    description: "Enterprise-grade security with sandboxed processes and encrypted sessions.",
  },
  {
    icon: Palette,
    title: "Themes & Customization",
    description:
      "Choose from 5 beautiful themes or create your own. Nord, Dracula, Tokyo Night, and more.",
  },
  {
    icon: Layers,
    title: "Multi-Tab Support",
    description: "Manage multiple terminals in one window with our intuitive tab system.",
  },
  {
    icon: Settings,
    title: "Fully Configurable",
    description:
      "Every aspect is customizable. Shortcuts, appearance, behavior - all under your control.",
  },
];

const testimonials = [
  {
    quote:
      "Connexio has completely transformed my workflow. The interface is beautiful and the performance is incredible.",
    author: "Sarah Chen",
    role: "Senior Developer at TechCorp",
  },
  {
    quote: "Finally, a terminal that doesn't feel like it's from the 90s. Beautiful and powerful.",
    author: "Marcus Johnson",
    role: "DevOps Engineer",
  },
  {
    quote:
      "The theme support is amazing. I can finally have a consistent look across all my tools.",
    author: "Emily Rodriguez",
    role: "Full Stack Developer",
  },
];

function FeatureCard({
  icon: Icon,
  title,
  description,
  index,
}: {
  icon: any;
  title: string;
  description: string;
  index: number;
}) {
  return (
    <Card
      className="h-full hover:border-primary/50 transition-colors group animate-fade-in"
      style={{ animationDelay: `${index * 100}ms` }}
    >
      <CardHeader>
        <div className="p-3 rounded-lg bg-primary/10 w-fit group-hover:bg-primary/20 transition-colors">
          <Icon className="h-6 w-6 text-primary" />
        </div>
      </CardHeader>
      <CardContent>
        <CardTitle className="text-xl mb-2">{title}</CardTitle>
        <p className="text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

export default function HomePage() {
  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <HeroSection />

      {/* Features Section */}
      <section className="py-24 bg-muted/30">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Everything You Need</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Packed with features that make your terminal experience better. From beautiful themes
              to powerful integrations.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <FeatureCard
                key={index}
                icon={feature.icon}
                title={feature.title}
                description={feature.description}
                index={index}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Loved by Developers</h2>
            <p className="text-lg text-muted-foreground">
              Join thousands of developers who have switched to Connexio.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((testimonial, index) => (
              <Card key={index} className="bg-muted/30">
                <CardHeader>
                  <p className="text-lg italic text-muted-foreground">
                    &quot;{testimonial.quote}&quot;
                  </p>
                </CardHeader>
                <CardContent>
                  <p className="font-semibold">{testimonial.author}</p>
                  <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Ready to Upgrade Your Terminal?</h2>
          <p className="text-lg opacity-90 mb-8 max-w-2xl mx-auto">
            Download Connexio today and experience the future of terminal applications. Free
            forever.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" variant="secondary">
              <Link href="/download">
                <Download className="h-5 w-5 mr-2" />
                Download Now
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="bg-transparent border-primary-foreground/20 hover:bg-primary-foreground/10"
            >
              <Link href="/demo">
                See It In Action
                <ArrowRight className="h-5 w-5 ml-2" />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
