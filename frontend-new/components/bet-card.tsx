import React from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Typography } from "@/components/ui/typography"
import { useClaimWinnings } from "@/hooks/useClaimWinnings"
import { formatTimestamp, formatTokens, isPending } from "@/utils/format"
import { OUTCOME_LABELS } from "@/config/program"
import type { BetWithStatus } from "@/types/sportsbook"

interface BetCardProps {
  bet: BetWithStatus
}

const STATUS_VARIANT_MAP: Record<BetWithStatus["status"], "pending" | "won" | "lost" | "claimed"> = {
  pending: "pending",
  won:     "won",
  lost:    "lost",
  claimed: "claimed",
}

const MATCH_LABELS = [
  "Arsenal vs Chelsea",
  "Liverpool vs Man City",
  "Man United vs Tottenham",
  "Newcastle vs Aston Villa",
  "Brighton vs West Ham",
  "Arsenal vs Liverpool",
  "Chelsea vs Man United",
  "Man City vs Tottenham",
  "Aston Villa vs Brighton",
  "West Ham vs Newcastle",
]

export function BetCard({ bet }: BetCardProps) {
  const { mutate: claimWinnings, isPending: isClaiming } = useClaimWinnings()
  const [claimError, setClaimError] = React.useState<string | null>(null)
  const [claimedTx, setClaimedTx] = React.useState<string | null>(null)

  const predictions = bet.predictions.slice(0, bet.numPredictions)
  const isParlay = predictions.length > 1

  function handleClaim() {
    setClaimError(null)
    claimWinnings(
      { bet },
      {
        onSuccess: ({ signature }) => setClaimedTx(signature),
        onError: (e: Error) => setClaimError(e.message ?? "Claim failed"),
      }
    )
  }

  return (
    <Card>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <Typography level="body5" className="text-gray-400">
            Bet #{bet.betId.toNumber()} · Round #{bet.roundId.toNumber()}
          </Typography>
          <div className="mt-0.5 flex items-center gap-2">
            <Typography level="body3" className="font-semibold text-gray-900">
              {formatTokens(bet.amount)} tokens
            </Typography>
            {isParlay && (
              <span className="rounded-full bg-info-100 px-2 py-0.5 text-xs font-semibold text-info-700">
                Parlay ×{predictions.length}
              </span>
            )}
          </div>
        </div>
        <Badge variant={STATUS_VARIANT_MAP[bet.status]}>
          {bet.status.charAt(0).toUpperCase() + bet.status.slice(1)}
        </Badge>
      </div>

      {/* Predictions */}
      <ul className="mb-3 space-y-1.5">
        {predictions.map((pred, i) => {
          const matchLabel = MATCH_LABELS[pred.matchIndex] ?? `Match ${pred.matchIndex + 1}`
          const outcomeLabel = OUTCOME_LABELS[pred.predictedOutcome] ?? `Outcome ${pred.predictedOutcome}`
          const resultLabel = bet.round
            ? (() => {
                const r = bet.round.matchResults[pred.matchIndex]
                if (!r || isPending(r)) return "Pending"
                if ("homeWin" in r) return "Home Win"
                if ("awayWin" in r) return "Away Win"
                return "Draw"
              })()
            : null

          return (
            <li key={i} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-1.5">
              <div>
                <Typography level="body5" className="font-medium text-gray-800">
                  {matchLabel}
                </Typography>
                <Typography level="body5" className="text-gray-500">
                  Pick: {outcomeLabel}
                </Typography>
              </div>
              {resultLabel && (
                <Typography level="body5" className="font-semibold text-gray-600">
                  {resultLabel}
                </Typography>
              )}
            </li>
          )
        })}
      </ul>

      {/* Payout row */}
      {bet.status === "won" && bet.estimatedPayout > 0 && (
        <div className="mb-3 flex items-center justify-between rounded-lg bg-success-50 px-3 py-2">
          <Typography level="body5" className="text-success-700">
            Est. payout
          </Typography>
          <Typography level="body4" className="font-bold text-success-700">
            {bet.estimatedPayout.toFixed(2)} tokens
          </Typography>
        </div>
      )}

      {/* Claim deadline */}
      {bet.status === "won" && (
        <Typography level="body5" className="mb-3 text-gray-400">
          Claim by: {formatTimestamp(bet.claimDeadline)}
        </Typography>
      )}

      {/* Claim button */}
      {bet.status === "won" && !claimedTx && (
        <Button
          fullWidth
          loading={isClaiming}
          onClick={handleClaim}
        >
          Claim Winnings
        </Button>
      )}

      {claimError && (
        <Typography level="body5" className="mt-1 text-error-500">
          {claimError}
        </Typography>
      )}

      {claimedTx && (
        <Typography level="body5" className="mt-1 text-center text-success-600">
          Claimed successfully!
        </Typography>
      )}
    </Card>
  )
}
