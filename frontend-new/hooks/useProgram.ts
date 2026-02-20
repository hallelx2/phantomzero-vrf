import { AnchorProvider, Program } from "@coral-xyz/anchor"
import { useConnection, useWallet } from "@solana/wallet-adapter-react"
import { useMemo } from "react"
import { IDL } from "@/idl/sportsbook"
import { PROGRAM_ID } from "@/config/program"

/**
 * Returns an initialised Anchor Program instance.
 * When wallet is not connected, uses a read-only provider.
 */
export function useProgram() {
  const { connection } = useConnection()
  const wallet = useWallet()

  const provider = useMemo(() => {
    // @ts-ignore – wallet shape is compatible
    return new AnchorProvider(connection, wallet as any, {
      commitment: "confirmed",
      preflightCommitment: "confirmed",
    })
  }, [connection, wallet])

  const program = useMemo(() => {
    return new Program(IDL as any, PROGRAM_ID, provider)
  }, [provider])

  return { program, provider }
}
