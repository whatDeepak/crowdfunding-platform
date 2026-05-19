# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev        # Start Next.js dev server (localhost:3000)
pnpm build      # Production build (TypeScript errors are ignored — see next.config.mjs)
pnpm lint       # ESLint
pnpm start      # Serve production build
```

There is no test suite. TypeScript build errors are intentionally suppressed (`ignoreBuildErrors: true`) — use `tsc --noEmit` to check types without building.

To add a new shadcn/ui component:
```bash
pnpm dlx shadcn@latest add <component-name>
```

The AI service (Python/FastAPI) lives in `ai-service/` and is deployed separately to HuggingFace Spaces:
```bash
cd ai-service
pip install -r requirements.txt
python app.py    # runs on localhost:7860
```

## Architecture

This is a hybrid Web3 + traditional web app. The key insight: **blockchain handles fund custody, Supabase handles everything else**.

### Data flow

```
User (MetaMask) → Next.js frontend
                → Next.js API routes (server-side)
                    → Supabase (metadata, AI scores, off-chain state)
                    → HuggingFace Spaces AI service (custom ML pipeline)
                    → Pinata IPFS (proof documents — CIDs stored on-chain)
                → ethers.js → CrowdfundingEscrow.sol (Sepolia)
```

### Smart contract (`contracts/CrowdfundingEscrow.sol`)

Admin-controlled escrow. No donor voting. Fund release flow:
1. Creator calls `submitWithdrawalRequest(campaignId, amount, proofIpfsHash)` — proof hash stored on-chain permanently
2. Admin reviews → calls `approveWithdrawal(campaignId, requestId)` — ETH released to creator minus 2% fee
3. OR `rejectWithdrawal(campaignId, requestId, reason)`

Key modifiers: `onlyAdmin` gates all fund releases. `onlyCreator(campaignId)` gates withdrawal submissions. `claimRefund` is permissionless after deadline.

### Web3 context (`lib/web3-context.tsx`)

Single `Web3Provider` wraps the app in `app/layout.tsx`. Exposes via `useWeb3()`:
- `account`, `isConnected`, `isAdmin` — `isAdmin` is true when connected wallet matches `NEXT_PUBLIC_ADMIN_WALLET`
- `contract` — ethers `Contract` instance with `ESCROW_ABI`
- `connectWallet()`, `disconnectWallet()`

Admin detection is purely client-side (address comparison). The API routes do a second check server-side.

### Database (`lib/supabase.ts`)

The `supabase` client is a browser client (`@supabase/ssr`). Server-side API routes should use the service role key (not yet wired — add `createServerClient` from `@supabase/ssr` when building server-only routes that need to bypass RLS).

Key table relationships:
- `campaigns` → `milestones` (one-to-many, `sequence_order` for display)
- `campaigns` → `withdrawal_requests` → linked to `milestones`
- `campaigns.embedding` (jsonb) stores the 384-dim MiniLM vector for duplicate detection
- `image_hashes.phash` stores perceptual hash hex for image reuse detection

Campaign status lifecycle:
`pending_ai` → (AI scores) → `active` (score ≥ 70) | `pending_verification` (40–69) | `pending_review` (< 40) → verifier endorsement or admin approval → `active` → `funded` → `completed` | `cancelled`

### AI service (`ai-service/`)

Separate FastAPI service, not part of the Next.js app. Called from `/api/ai/verify-campaign` and `/api/ai/analyze-proof` via `AI_SERVICE_URL` env var.

Two endpoints:
- `POST /analyze-campaign` — 4-signal ML pipeline: text quality (sklearn/textstat) + semantic similarity (MiniLM-L6-v2) + image hash (imagehash pHash) + amount Z-score → combined 0–100 trust score + LLM explanation (Groq → Mistral fallback)
- `POST /analyze-proof` — heuristic + LLM consistency check for withdrawal proofs

The MiniLM model is loaded once at startup and cached. Hit `/health` before demo to warm it up (first load takes ~10–30s on HuggingFace Spaces free CPU tier).

### API routes (`app/api/`)

All business logic runs in Next.js API routes — no separate backend. Pattern:
- Routes validate input, call `lib/supabase.ts` helpers, return JSON
- AI calls go via fetch to `AI_SERVICE_URL`
- Admin routes re-validate `adminWallet` against `NEXT_PUBLIC_ADMIN_WALLET` server-side
- Blockchain interactions (signing, tx submission) happen client-side via MetaMask; API routes only record the outcome in Supabase after the tx is confirmed

### Campaign routing logic

After AI analysis, `/api/ai/verify-campaign` auto-routes based on `trustScore`:
- ≥ 70 → status `active` (goes live immediately)
- 40–69 → status `pending_verification` (needs 1 trusted verifier endorsement via `/api/verifications`)
- < 40 → status `pending_review` (admin must manually approve via `/api/admin/approve-campaign`)

A verifier endorsement auto-promotes `pending_verification` → `active` once the first endorsement is recorded.

### UI component library

shadcn/ui (New York style) with Tailwind v4. All primitives live in `components/ui/`. CSS design tokens are in `app/globals.css` using OKLch color space. Do not add inline color values — use the CSS variables (`--primary`, `--muted`, etc.).

Icons: `lucide-react` only. Do not import from other icon libraries.

### Key environment variables

```
NEXT_PUBLIC_CONTRACT_ADDRESS     # Deployed CrowdfundingEscrow address
NEXT_PUBLIC_ADMIN_WALLET         # Admin EOA address (lowercase) — used for isAdmin detection
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY        # Server-side only — never expose client-side
AI_SERVICE_URL                   # HuggingFace Spaces URL (e.g. https://user-space.hf.space)
GROQ_API_KEY                     # Used by the AI service, not Next.js directly
MISTRAL_API_KEY                  # AI service fallback
PINATA_API_KEY
PINATA_SECRET_KEY
NEXT_PUBLIC_PINATA_GATEWAY       # https://gateway.pinata.cloud/ipfs/
```

### Deployment

- **Next.js app**: Vercel (auto-deploy from GitHub)
- **AI service**: HuggingFace Spaces (push `ai-service/` as a separate Space repo)
- **Smart contract**: Hardhat → Sepolia. Use local Hardhat node (`npx hardhat node`) for development — creates 20 accounts with 10,000 ETH each, connect MetaMask to `localhost:8545` chain ID 31337.
- **Database**: Run `scripts/01_create_schema.sql` in Supabase SQL editor (it drops and recreates all tables — do not run on a live DB with real data)
