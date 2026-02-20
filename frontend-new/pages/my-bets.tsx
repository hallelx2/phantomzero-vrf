import React from "react"
import { useWallet } from "@solana/wallet-adapter-react"
import ConnectWalletButton from "@/components/connect-wallet-button"
import { BetCard } from "@/components/bet-card"
import { Typography } from "@/components/ui/typography"
import { Spinner } from "@/components/ui/spinner"
import { useMyBets } from "@/hooks/useMyBets"
import type { BetStatus } from "@/types/sportsbook"

const STATUS_ORDER: BetStatus[] = ["won", "pending", "lost", "claimed"]

export default function MyBetsPage() {
  const { publicKey } = useWallet()
  const { data: bets, isLoading } = useMyBets()

  if (!publicKey) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Typography level="body2" className="text-gray-600">
          Connect your wallet to see your bets
        </Typography>
        <ConnectWalletButton />
      </div>
    )
  }

  // Group by status for display ordering
  const sorted = bets
    ? [...bets].sort(
        (a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status)
      )
    : []

  const wonCount = sorted.filter((b) => b.status === "won").length
  const pendingCount = sorted.filter((b) => b.status === "pending").length

  return (
    <div className="mx-auto max-w-3xl">
      {/* Header */}
      <div className="mb-8 flex items-end justify-between">
        <div>
          <Typography as="h1" level="h5" className="font-bold text-gray-900">
            My Bets
          </Typography>
          {!isLoading && sorted.length > 0 && (
            <Typography level="body4" className="mt-1 text-gray-500">
              {sorted.length} total · {wonCount} won · {pendingCount} pending
            </Typography>
          )}
        </div>
      </div>

      {isLoading && (
        <div className="flex justify-center py-16">
          <Spinner className="h-8 w-8" />
        </div>
      )}

      {!isLoading && sorted.length === 0 && (
        <div className="rounded-2xl bg-gray-50 p-10 text-center">
          <Typography level="body3" className="text-gray-500">
            No bets found. Head to Matches to place your first bet!
          </Typography>
        </div>
      )}

      {!isLoading && sorted.length > 0 && (
        <div className="space-y-4">
          {sorted.map((bet) => (
            <BetCard key={bet.betId.toNumber()} bet={bet} />
          ))}
        </div>
      )}
    </div>
  )
}
