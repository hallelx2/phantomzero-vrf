import React from "react"
import { tv, VariantProps } from "tailwind-variants"
import { cn } from "@/utils/cn"

const badgeVariants = tv({
  base: "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
  variants: {
    variant: {
      pending:  "bg-warning-100 text-warning-700",
      won:      "bg-success-100 text-success-700",
      lost:     "bg-error-100 text-error-700",
      claimed:  "bg-gray-100 text-gray-600",
      active:   "bg-info-100 text-info-700",
      default:  "bg-gray-100 text-gray-700",
    },
  },
  defaultVariants: {
    variant: "default",
  },
})

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {children}
    </span>
  )
}
