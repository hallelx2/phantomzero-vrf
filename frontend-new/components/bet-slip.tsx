import React, { useState } from "react"
import { useWallet } from "@solana/wallet-adapter-react"
import { XIcon } from "lucide-react"
import { Card, CardHeader } from "@/components/ui/card"
import { Typography } from "@/components/ui/typography"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { usePlaceBet } from "@/hooks/usePlaceBet"
import { estimatePayout, getParlayMultiplier, parseTokens } from "@/utils/format"
import { DEFAULT_PROTOCOL_FEE_BPS } from "@/config/program"
import type { BetSlipEntry } from "@/types/sportsbook"

interface BetSlipProps {
  selections: BetSlipEntry[]
  onRemove: (matchIndex: number) => void
  onClear: () => void
}

export function BetSlip({ selections, onRemove, onClear }: BetSlipProps) {
  const { publicKey } = useWallet()
  const [amount, setAmount] = useState("")
  const [successTx, setSuccessTx] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const { mutate: placeBet, isPending } = usePlaceBet()

  const amountNum = parseFloat(amount) || 0
  const estimatedPayout = estimatePayout(amountNum, selections, DEFAULT_PROTOCOL_FEE_BPS)
  const parlayMultiplier = getParlayMultiplier(selections.length)

  function handlePlaceBet() {
    if (!publicKey) return
    if (!amount || amountNum <= 0) {
      setErrorMsg("Enter a valid amount")
      return
    }
    setErrorMsg(null)
    setSuccessTx(null)

    const amountRaw = parseTokens(amount)

    placeBet(
      { selections, amountRaw },
      {
        onSuccess: ({ signature }) => {
          setSuccessTx(signature)
          setAmount("")
          onClear()
        },
        onError: (e: Error) => {
          setErrorMsg(e.message ?? "Transaction failed")
        },
      }
    )
  }

  if (selections.length === 0) {
    return (
      <Card className="sticky top-24">
        <Typography level="h6" className="mb-2 font-semibold text-gray-800">
          Bet Slip
        </Typography>
        <div className="flex min-h-[120px] flex-col items-center justify-center text-center">
          <Typography level="body4" className="text-gray-400">
            Click odds to add selections
          </Typography>
        </div>
      </Card>
    )
  }

  return (
    <Card className="sticky top-24">
      <CardHeader>
        <Typography level="h6" className="font-semibold text-gray-800">
          Bet Slip ({selections.length})
        </Typography>
        <button
          onClick={onClear}
          className="text-sm text-gray-400 hover:text-gray-700"
        >
          Clear all
        </button>
      </CardHeader>

      {/* Selections */}
      <ul className="mb-4 space-y-2">
        {selections.map((sel) => (
          <li
            key={sel.matchIndex}
            className="flex items-start justify-between gap-2 rounded-xl bg-gray-50 px-3 py-2"
          >
            <div className="flex-1">
              <Typography level="body5" className="font-medium text-gray-800 leading-snug">
                {sel.label}
              </Typography>
              <Typography level="body5" className="text-primary-500 font-semibold">
                {sel.odds.toFixed(2)}x
              </Typography>
            </div>
            <button
              onClick={() => onRemove(sel.matchIndex)}
              className="mt-0.5 text-gray-400 hover:text-gray-700"
            >
              <XIcon size={14} />
            </button>
          </li>
        ))}
      </ul>

      {/* Parlay bonus */}
      {selections.length > 1 && (
        <div className="mb-3 flex items-center justify-between rounded-lg bg-primary-50 px-3 py-2">
          <Typography level="body5" className="text-primary-600">
            Parlay bonus
          </Typography>
          <Typography level="body5" className="font-bold text-primary-600">
            {parlayMultiplier.toFixed(2)}x
          </Typography>
        </div>
      )}

      {/* Amount input */}
      <div className="mb-3">
        <Typography level="body5" className="mb-1.5 font-medium text-gray-600">
          Stake (tokens)
        </Typography>
        <Input
          type="number"
          min="0"
          step="0.01"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          error={!!errorMsg}
        />
        {errorMsg && (
          <Typography level="body5" className="mt-1 text-error-500">
            {errorMsg}
          </Typography>
        )}
      </div>

      {/* Estimated payout */}
      {amountNum > 0 && (
        <div className="mb-4 flex items-center justify-between">
          <Typography level="body5" className="text-gray-500">
            Est. payout
          </Typography>
          <Typography level="body4" className="font-bold text-success-600">
            {estimatedPayout.toFixed(2)} tokens
          </Typography>
        </div>
      )}

      {/* Place bet button */}
      {publicKey ? (
        <Button
          fullWidth
          loading={isPending}
          disabled={selections.length === 0 || !amount}
          onClick={handlePlaceBet}
        >
          Place Bet
        </Button>
      ) : (
        <Button fullWidth variant="outline" disabled>
          Connect wallet to bet
        </Button>
      )}

      {successTx && (
        <Typography level="body5" className="mt-2 text-center text-success-600">
          Bet placed!
        </Typography>
      )}
    </Card>
  )
}
