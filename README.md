# Shopier

Buys clothes on Solana. Purchases run through an on-chain spending policy.

## Programs

Deployed to Solana devnet:

| Program | ID |
|---|---|
| `spending_policy` | `2S7hJm57s4VBmBBpqe59XFFibKR9L2ykstMCm8xWreRt` |
| `digital_twin` | `Dt3SWQmsAT1vDJyPRCPgMPXi2Rg47niXDVUzo6boFBCU` |
| `stylist_marketplace` | `G5FE1NnanqQJGNCyqLnKqKonYFWVzyzoAeZ9rUtf8F5e` |

Verify on https://explorer.solana.com/?cluster=devnet.

## What's wired

| Component | Status |
|---|---|
| `spending_policy` | Deployed; init / update / record_spend / set_delegate / record_spend_as_delegate |
| `digital_twin` | Deployed; encrypts twin via wallet signMessage; WatchPolicy PDA |
| `stylist_marketplace` | Deployed; 90/10 SPL CPI split |
| User purchase | Phantom-signed: ATA create + USDC transfer + record_spend in one tx |
| Session-key auto-buy | `record_spend_as_delegate` under WatchPolicy filters |
| Product matching | SerpAPI google_shopping for prices and merchant URLs |
| SNS identity | Resolution, reverse-lookup, records (Twitter / GitHub / URL) |
| Jupiter quotes | USDC / USDT / EURC / PYUSD |
| Fiat conversion | Raenest + Crossmint adapters; API keys pending |
| Twin personalization | Section, style, climate, age, plus hard filters |
| PWA share-target | Android share sheet receives screenshots |

## Run locally

```bash
npm install
anchor build --no-idl
npm run dev
```

`.env.local`:

Required — `GEMINI_API_KEY`, `NEXT_PUBLIC_SOLANA_RPC`, `NEXT_PUBLIC_MERCHANT_ADDRESS`, `NEXT_PUBLIC_TREASURY_ADDRESS`, `TREASURY_SECRET_KEY`.

Optional — `SERPAPI_KEY`, `OPENAI_API_KEY`, `SKIMLINKS_PUBLISHER_ID`, `COVALENT_API_KEY`, `ZERION_API_KEY`, `TELEGRAM_BOT_TOKEN`.

Seed demo data:

```bash
SHOPIER_BASE_URL=http://localhost:3000 npx tsx scripts/seed-demo.ts
```

## Stack

Anchor 0.30.1, Next.js 16, TypeScript 5, Tailwind 4. `@solana/web3.js`, `@solana/spl-token`, Solana wallet-adapter. Better-sqlite3 for local state. React Three Fiber for the 3D twin.

## License

MIT
