import { WalletAdapterNetwork } from "@solana/wallet-adapter-base"
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react"
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui"
import { PhantomWalletAdapter, SolflareWalletAdapter } from "@solana/wallet-adapter-wallets"
import { clusterApiUrl } from "@solana/web3.js"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { AppProps } from "next/app"
import { DefaultSeo } from "next-seo"
import type { FC } from "react"
import React, { useMemo, useState } from "react"
import RootLayout from "@/components/layout"
import { siteConfig } from "@/config/site"

// Use require instead of import since order matters
require("@solana/wallet-adapter-react-ui/styles.css")
require("../styles/globals.css")

const App: FC<AppProps> = ({ Component, pageProps }) => {
  const network = WalletAdapterNetwork.Devnet
  const endpoint = useMemo(() => clusterApiUrl(network), [network])

  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [network]
  )

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 10_000, retry: 2 },
        },
      })
  )

  return (
    <>
      <DefaultSeo
        title={siteConfig.name}
        openGraph={{
          type: "website",
          locale: "en_EN",
          description: siteConfig.description,
          site_name: siteConfig.name,
          title: siteConfig.name,
        }}
        description={siteConfig.description}
      />

      <QueryClientProvider client={queryClient}>
        <ConnectionProvider endpoint={endpoint}>
          <WalletProvider wallets={wallets} autoConnect>
            <WalletModalProvider>
              <RootLayout>
                <Component {...pageProps} />
              </RootLayout>
            </WalletModalProvider>
          </WalletProvider>
        </ConnectionProvider>
      </QueryClientProvider>
    </>
  )
}

export default App
