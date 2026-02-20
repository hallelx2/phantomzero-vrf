import React, { useState } from "react"
import { useWallet } from "@solana/wallet-adapter-react"
import ConnectWalletButton from "@/components/connect-wallet-button"
import { Card } from "@/components/ui/card"
import { Typography } from "@/components/ui/typography"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { useBettingPool } from "@/hooks/useBettingPool"
import {
  useMySeasonPrediction,
  useMakeSeasonPrediction,
  useClaimSeasonReward,
} from "@/hooks/useSeasonPrediction"
import { TEAMS } from "@/config/program"
import BN from "bn.js"

export default function SeasonPage() {
  const { publicKey } = useWallet()
  const { data: pool, isLoading: poolLoading } = useBettingPool()
  const { data: prediction, isLoading: predLoading } = useMySeasonPrediction()
  const { mutate: makePrediction, isPending: predicting } = useMakeSeasonPrediction()
  const { mutate: claimReward, isPending: claiming } = useClaimSeasonReward()

  const [selectedTeam, setSelectedTeam] = useState<number | null>(null)
  const [txError, setTxError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const isLoading = poolLoading || predLoading

  function handlePredict() {
    if (selectedTeam === null) return
    setTxError(null)
    setSuccessMsg(null)
    makePrediction(
      { predictedTeam: selectedTeam },
      {
        onSuccess: ({ nftMint }) => {
          setSuccessMsg(`Prediction recorded! NFT mint: ${nftMint.slice(0, 8)}…`)
        },
        onError: (e: Error) => setTxError(e.message ?? "Transaction failed"),
      }
    )
  }

  function handleClaim() {
    setTxError(null)
    setSuccessMsg(null)
    // totalPredictors is an approximation — in production you'd fetch the actual count
    claimReward(
      { totalPredictors: new BN(1) },
      {
        onSuccess: () => setSuccessMsg("Season reward claimed!"),
        onError: (e: Error) => setTxError(e.message ?? "Claim failed"),
      }
    )
  }

  if (!publicKey) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Typography level="body2" className="text-gray-600">
          Connect your wallet to participate in the season prediction
        </Typography>
        <ConnectWalletButton />
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  const seasonEnded = pool?.seasonEnded ?? false
  const seasonId = pool?.currentSeasonId?.toNumber() ?? 0
  const winningTeam = seasonEnded ? pool?.seasonWinningTeam : null

  return (
    <div className="mx-auto max-w-2xl">
      {/* Header */}
      <div className="mb-8">
        <Typography as="h1" level="h5" className="font-bold text-gray-900">
          Season Prediction
        </Typography>
        <Typography level="body4" className="mt-1 text-gray-500">
          Season #{seasonId} · Predict the league winner and earn an NFT + token reward
        </Typography>
      </div>

      {/* Season status banner */}
      {seasonEnded && winningTeam !== null && (
        <div className="mb-6 rounded-2xl bg-success-50 px-6 py-4">
          <Typography level="body3" className="font-semibold text-success-700">
            Season ended! Winning team: {TEAMS[winningTeam] ?? `Team ${winningTeam}`}
          </Typography>
        </div>
      )}

      {/* Already predicted */}
      {prediction ? (
        <Card className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <Typography level="body4" className="text-gray-500">
                Your prediction
              </Typography>
              <Typography level="h6" className="mt-1 font-bold text-gray-900">
                {TEAMS[prediction.predictedTeam] ?? `Team ${prediction.predictedTeam}`}
              </Typography>
            </div>
            <Badge variant={prediction.claimedReward ? "claimed" : seasonEnded ? "won" : "pending"}>
              {prediction.claimedReward ? "Reward Claimed" : seasonEnded ? "Season Ended" : "Active"}
            </Badge>
          </div>

          {prediction.nftMint && (
            <Typography level="body5" className="mt-3 text-gray-400">
              NFT mint: {prediction.nftMint.toBase58().slice(0, 16)}…
            </Typography>
          )}

          {/* Claim reward button (only if season ended + correct team + not claimed) */}
          {seasonEnded &&
            !prediction.claimedReward &&
            winningTeam === prediction.predictedTeam && (
              <div className="mt-4">
                <Button fullWidth loading={claiming} onClick={handleClaim}>
                  Claim Season Reward
                </Button>
              </div>
            )}
        </Card>
      ) : (
        /* Team picker */
        !seasonEnded && (
          <Card className="mb-6">
            <Typography level="h6" className="mb-4 font-semibold text-gray-800">
              Pick the season winner
            </Typography>

            <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {TEAMS.map((team, index) => (
                <button
                  key={team}
                  type="button"
                  onClick={() => setSelectedTeam(index)}
                  className={[
                    "rounded-xl border px-4 py-3 text-left transition-all",
                    "focus:outline-none focus:ring-2 focus:ring-primary-300",
                    selectedTeam === index
                      ? "border-primary-400 bg-primary-50"
                      : "border-gray-200 hover:border-primary-300",
                  ].join(" ")}
                >
                  <Typography
                    level="body4"
                    className={
                      selectedTeam === index
                        ? "font-semibold text-primary-600"
                        : "font-medium text-gray-800"
                    }
                  >
                    {team}
                  </Typography>
                </button>
              ))}
            </div>

            <Button
              fullWidth
              disabled={selectedTeam === null}
              loading={predicting}
              onClick={handlePredict}
            >
              {selectedTeam !== null
                ? `Predict ${TEAMS[selectedTeam]}`
                : "Select a team first"}
            </Button>
          </Card>
        )
      )}

      {seasonEnded && !prediction && (
        <div className="rounded-2xl bg-gray-50 p-10 text-center">
          <Typography level="body3" className="text-gray-500">
            The season has ended. Predictions are closed.
          </Typography>
        </div>
      )}

      {txError && (
        <Typography level="body4" className="mt-2 text-error-500">
          {txError}
        </Typography>
      )}

      {successMsg && (
        <Typography level="body4" className="mt-2 text-success-600">
          {successMsg}
        </Typography>
      )}

      {/* Info card */}
      <Card className="bg-gray-50">
        <Typography level="body4" className="mb-2 font-semibold text-gray-700">
          How it works
        </Typography>
        <ul className="space-y-1.5 list-disc list-inside">
          {[
            "Pick which team will win the season",
            "You receive an NFT confirming your prediction",
            "If your team wins, share the season reward pool",
            "Rewards are distributed equally among all correct predictors",
          ].map((item) => (
            <li key={item}>
              <Typography level="body5" className="inline text-gray-600">
                {item}
              </Typography>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
