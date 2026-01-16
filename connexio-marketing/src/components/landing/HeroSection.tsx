"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Terminal, Zap, Shield, Users } from "lucide-react";

export function HeroSection() {
  const stats = [
    { icon: Zap, value: "10x", label: "Faster" },
    { icon: Shield, value: "100%", label: "Secure" },
    { icon: Users, value: "50K+", label: "Users" },
  ];

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
      {/* Background Gradient */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent" />
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-8 animate-fade-in">
            <Zap className="h-4 w-4" />
            <span>Modern Terminal for Everyone</span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold tracking-tight mb-6 animate-slide-up">
            The Terminal{" "}
            <span className="text-primary bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent">
              Reimagined
            </span>
          </h1>

          {/* Subheadline */}
          <p className="text-lg sm:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto animate-fade-in delay-100">
            Experience the next generation of terminal applications. Built with modern technologies
            for speed, security, and developer experience.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12 animate-fade-in delay-200">
            <Button asChild size="lg" className="gap-2">
              <Link href="/download">
                <Terminal className="h-5 w-5" />
                Download Free
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/demo">Watch Demo</Link>
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-8 max-w-2xl mx-auto animate-fade-in delay-300">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <stat.icon className="h-5 w-5 text-primary" />
                  <span className="text-2xl font-bold">{stat.value}</span>
                </div>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Terminal Preview */}
        <div className="mt-16 relative animate-fade-in delay-500">
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent z-10 pointer-events-none" />
          <div className="rounded-xl border bg-card shadow-2xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/50">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="ml-2 text-sm text-muted-foreground">Connexio — Terminal</span>
            </div>
            <div className="p-6 bg-[#0d1117] min-h-[300px] flex items-center justify-center">
              <div className="text-center">
                <Terminal className="h-16 w-16 text-primary/50 mx-auto mb-4" />
                <p className="text-muted-foreground">Screenshot will appear here</p>
                <p className="text-sm text-muted-foreground/70 mt-2">
                  Take a screenshot of your Connexio app and replace the placeholder
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
