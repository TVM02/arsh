"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex h-10 items-center justify-center rounded-xl bg-teal-50 p-1 text-teal-700 bad-sm border border-teal-100",
      className,
    )}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

// ───────────────────────────────────────────
// Tabs Trigger
// ───────────────────────────────────────────
const TabsTrigger = React.forwardRef(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      `inline-flex items-center justify-center whitespace-nowrap 
      rounded-lg px-4 py-1.5 md:text-sm text-[10px] font-medium transition-all duration-200
      ring-offset-background focus-visible:outline-none
      focus-visible:ring-2 focus-visible:ring-teal-600
      disabled:pointer-events-none disabled:opacity-50

      data-[state=active]:bg-teal-600 
      data-[state=active]:text-white
      data-[state=active]:bad-md
      data-[state=inactive]:hover:bg-teal-100
      `,
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

// ───────────────────────────────────────────
// Tabs Content
// ───────────────────────────────────────────
const TabsContent = React.forwardRef(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-3 rounded-lg p-2 outline-none focus-visible:ring-2 focus-visible:ring-teal-600",
      className,
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
