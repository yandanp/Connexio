"use client";

import * as React from "react";
import { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  index: number;
}

export function FeatureCard({ icon: Icon, title, description, index }: FeatureCardProps) {
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
