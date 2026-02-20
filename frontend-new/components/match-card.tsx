import React from "react"
import { Card } from "@/components/ui/card"
import { Typography } from "@/components/ui/typography"
import { OddsButton } from "@/components/odds-button"
import { formatOdds, isPending } from "@/utils/format"
import { OUTCOME_LABELS } from "@/config/program"
import type { BetSlipEntry, LockedOdds, MatchOutcome, OutcomeId } from "@/types/sportsbook"

interface MatchCardProps {
  matchIndex: number
  lockedOdds: LockedOdds
  result: MatchOutcome
  /** Currently selected outcome for this match in the bet slip (null = not selected) */
  selectedOutcome: OutcomeId | null
  onSelect: (entry: BetSlipEntry) => void
  onDeselect: (matchIndex: number) => void
}

const MATCH_FIXTURES: [string, string][] = [
  ["Arsenal",      "Chelsea"],
  ["Liverpool",    "Man City"],
  ["Man United",   "Tottenham"],
  ["Newcastle",    "Aston Villa"],
  ["Brighton",     "West Ham"],
  ["Arsenal",      "Liverpool"],
  ["Chelsea",      "Man United"],
  ["Man City",     "Tottenham"],
  ["Aston Villa",  "Brighton"],
  ["West Ham",     "Newcastle"],
]

export function MatchCard({
  matchIndex,
  lockedOdds,
  result,
  selectedOutcome,
  onSelect,
  onDeselect,
}: MatchCardProps) {
  const [homeTeam, awayTeam] = MATCH_FIXTURES[matchIndex] ?? [`Team ${matchIndex * 2 + 1}`, `Team ${matchIndex * 2 + 2}`]
  const settled = !isPending(result)

  function handleClick(outcome: OutcomeId) {
    if (selectedOutcome === outcome) {
      onDeselect(matchIndex)
      return
    }
    const oddsFloat: Record<OutcomeId, number> = {
      1: lockedOdds.homeOdds.toNumber() / 1e9,
      2: lockedOdds.awayOdds.toNumber() / 1e9,
      3: lockedOdds.drawOdds.toNumber() / 1e9,
    }
    onSelect({
      matchIndex,
      outcome,
      odds: oddsFloat[outcome],
      label: `${homeTeam} vs ${awayTeam} – ${OUTCOME_LABELS[outcome]}`,
    })
  }

  return (
    <Card>
      {/* Match header */}
      <div className="mb-3 flex items-center justify-between">
        <Typography level="body5" className="font-semibold uppercase tracking-wide text-gray-400">
          Match {matchIndex + 1}
        </Typography>
        {settled && (
          <Typography level="body5" className="rounded-full bg-success-100 px-2 py-0.5 text-success-700">
            Settled
          </Typography>
        )}
      </div>

      {/* Team names */}
      <div className="mb-4 flex items-center justify-between">
        <Typography level="body3" className="font-semibold text-gray-900">
          {homeTeam}
        </Typography>
        <Typography level="body5" className="font-medium text-gray-400">
          vs
        </Typography>
        <Typography level="body3" className="font-semibold text-gray-900">
          {awayTeam}
        </Typography>
      </div>

      {/* Odds buttons */}
      {lockedOdds.locked ? (
        <div className="flex gap-2">
          <OddsButton
            label="Home"
            odds={formatOdds(lockedOdds.homeOdds)}
            selected={selectedOutcome === 1}
            disabled={settled}
            onClick={() => handleClick(1)}
          />
          <OddsButton
            label="Draw"
            odds={formatOdds(lockedOdds.drawOdds)}
            selected={selectedOutcome === 3}
            disabled={settled}
            onClick={() => handleClick(3)}
          />
          <OddsButton
            label="Away"
            odds={formatOdds(lockedOdds.awayOdds)}
            selected={selectedOutcome === 2}
            disabled={settled}
            onClick={() => handleClick(2)}
          />
        </div>
      ) : (
        <div className="flex h-12 items-center justify-center rounded-xl bg-gray-50">
          <Typography level="body4" className="text-gray-400">
            Odds not available yet
          </Typography>
        </div>
      )}
    </Card>
  )
}
