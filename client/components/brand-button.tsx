"use client"

import { Button, buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { type VariantProps } from "class-variance-authority"

export interface ButtonProps extends React.ComponentProps<'button'>, VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

export function BrandButton({ className, ...props }: ButtonProps) {
  return (
    <Button
      className={cn(
        "rounded-lg border-0 bg-primary text-primary-foreground shadow-signal",
        "transition-transform duration-200 ease-out",
        "hover:scale-[1.01] hover:bg-primary/90",
        className,
      )}
      {...props}
    />
  )
}
