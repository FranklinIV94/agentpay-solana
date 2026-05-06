import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { ConnectionProvider } from "@solana/wallet-adapter-react";
import { clusterApiUrl } from "@solana/web3.js";
import { useEffect, useState } from "react";
import "@solana/wallet-adapter-react-ui/styles.css";

// Use multiple RPC endpoints for reliability
const RPC_ENDPOINTS = [
  "https://api.devnet.solana.com",
  "https://devnet.solana.com",
];
const RPC_ENDPOINT = RPC_ENDPOINTS[0];

export default function App({ Component, pageProps }: AppProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  if (!mounted) {
    return (
      <ConnectionProvider endpoint={RPC_ENDPOINT}>
        <Component {...pageProps} />
      </ConnectionProvider>
    );
  }

  return (
    <ConnectionProvider endpoint={RPC_ENDPOINT}>
      <Component {...pageProps} />
    </ConnectionProvider>
  );
}