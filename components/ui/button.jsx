import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils";
const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap text-sm font-semibold transition-all duration-150 ease-in-out border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "bg-teal-600 text-white border-teal-600 hover:bg-white hover:text-teal-600",
        destructive:
          "bg-white text-teal-600 border-teal-600 hover:bg-teal-600 hover:text-white",
        outline: "bg-white text-teal-600 border-teal-600 hover:bg-teal-50",
        secondary:
          "bg-white text-teal-600 border-teal-600 hover:bg-teal-600 hover:text-white",
        ghost:
          "bg-transparent text-teal-600 border-transparent hover:bg-teal-50",
        link: "bg-transparent text-teal-600 border-transparent underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-6 py-2.5",
        sm: "h-9 px-4 text-xs",
        lg: "h-12 px-10 text-base",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

const Button = React.forwardRef(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
