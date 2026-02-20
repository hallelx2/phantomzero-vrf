import React from "react"
import { cn } from "@/utils/cn"
import { Typography } from "@/components/ui/typography"

interface OddsButtonProps {
  label: string
  odds: string    // e.g. "1.75x"
  selected?: boolean
  disabled?: boolean
  onClick?: () => void
}

export function OddsButton({ label, odds, selected, disabled, onClick }: OddsButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex flex-1 flex-col items-center rounded-xl border px-3 py-2.5 transition-all",
        "focus:outline-none focus:ring-2 focus:ring-primary-300",
        "disabled:cursor-not-allowed disabled:opacity-50",
        selected
          ? "border-primary-400 bg-primary-50 text-primary-600"
          : "border-gray-200 bg-gray-50 text-gray-700 hover:border-primary-300 hover:bg-primary-50"
      )}
    >
      <Typography level="body5" className="font-medium text-gray-500">
        {label}
      </Typography>
      <Typography
        level="body4"
        className={cn("mt-0.5 font-bold", selected ? "text-primary-500" : "text-gray-900")}
      >
        {odds}
      </Typography>
    </button>
  )
}
