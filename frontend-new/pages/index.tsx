import React, { useCallback, useState } from "react"
import { Typography } from "@/components/ui/typography"
import { Spinner } from "@/components/ui/spinner"
import { MatchCard } from "@/components/match-card"
import { BetSlip } from "@/components/bet-slip"
import { useCurrentRound } from "@/hooks/useCurrentRound"
import { MATCHES_PER_ROUND } from "@/config/program"
import type { BetSlipEntry, OutcomeId } from "@/types/sportsbook"

export default function MatchesPage() {
  const { data: round, isLoading, error } = useCurrentRound()
  const [selections, setSelections] = useState<BetSlipEntry[]>([])

  const handleSelect = useCallback((entry: BetSlipEntry) => {
    setSelections((prev) => {
      // Replace any existing selection for same match
      const filtered = prev.filter((s) => s.matchIndex !== entry.matchIndex)
      return [...filtered, entry]
    })
  }, [])

  const handleDeselect = useCallback((matchIndex: number) => {
    setSelections((prev) => prev.filter((s) => s.matchIndex !== matchIndex))
  }, [])

  const handleRemove = useCallback((matchIndex: number) => {
    setSelections((prev) => prev.filter((s) => s.matchIndex !== matchIndex))
  }, [])

  const handleClear = useCallback(() => setSelections([]), [])

  const selectionMap = new Map(selections.map((s) => [s.matchIndex, s.outcome as OutcomeId]))

  return (
    <div className="mx-auto max-w-7xl">
      {/* Page header */}
      <div className="mb-8">
        <Typography as="h1" level="h5" className="font-bold text-gray-900">
          Matches
        </Typography>
        {round && (
          <Typography level="body4" className="mt-1 text-gray-500">
            Round #{round.roundId.toNumber()}
            {round.settled ? " · Settled" : " · Live"}
          </Typography>
        )}
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Spinner className="h-8 w-8" />
        </div>
      )}

      {error && (
        <div className="rounded-2xl bg-error-50 p-6 text-center">
          <Typography level="body3" className="text-error-600">
            Failed to load round data. Check your connection.
          </Typography>
        </div>
      )}

      {!isLoading && !error && !round && (
        <div className="rounded-2xl bg-gray-50 p-10 text-center">
          <Typography level="body3" className="text-gray-500">
            No active round found. Check back soon.
          </Typography>
        </div>
      )}

      {round && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
          {/* Match grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {Array.from({ length: MATCHES_PER_ROUND }).map((_, i) => (
              <MatchCard
                key={i}
                matchIndex={i}
                lockedOdds={round.lockedOdds[i]}
                result={round.matchResults[i]}
                selectedOutcome={selectionMap.get(i) ?? null}
                onSelect={handleSelect}
                onDeselect={handleDeselect}
              />
            ))}
          </div>

          {/* Bet slip sidebar */}
          <div>
            <BetSlip
              selections={selections}
              onRemove={handleRemove}
              onClear={handleClear}
            />
          </div>
        </div>
      )}
    </div>
  )
}
