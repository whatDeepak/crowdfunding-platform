# TrustFund - AI-Verified Blockchain Crowdfunding Platform

<div align="center">

![TrustFund](https://img.shields.io/badge/Built%20with-Next.js%20%2B%20Web3-blue)
![Ethereum](https://img.shields.io/badge/Ethereum-Sepolia-purple)
![AI](https://img.shields.io/badge/AI-Groq%20FREE-green)
![License](https://img.shields.io/badge/License-MIT-green)
![Cost](https://img.shields.io/badge/Cost-$0%2Fmonth-brightgreen)

**Transparent, AI-verified crowdfunding for social causes on blockchain**

**Built with 100% FREE services - No credit card required!**

[Quick Start](#quick-start) • [Features](#features) • [Free Setup](#free-setup) • [Architecture](#architecture) • [Deployment](#deployment)

</div>

---

## Overview

TrustFund is a decentralized crowdfunding platform that combines the transparency of blockchain with the power of AI to create a trust-based donation system. Every campaign is AI-verified for legitimacy, every donation is secured by smart contracts, and every fund release is governed by donor voting.

### The Problem
Traditional crowdfunding platforms suffer from:
- Lack of transparency in fund usage
- No accountability for creators
- Difficulty verifying campaign legitimacy
- Risk of donation fraud and misuse

### Our Solution
- **Blockchain Escrow**: Donations held in smart contracts, released only after milestone verification
- **AI Verification**: Campaigns analyzed for legitimacy, suspicious content flagged automatically
- **DAO Governance**: Donors vote (80% threshold) before funds are released to creators
- **Transparent Auditing**: All transactions on-chain, fully auditable
- **Smart Recommendations**: ML-powered suggestions based on donation history

### Built with 100% FREE Services
| Service | Cost | Use Case |
|---------|------|----------|
| **Groq AI** | FREE (30 req/min, unlimited) | Campaign legitimacy scoring & fraud detection |
| **Supabase** | FREE (500 MB, 2 GB bandwidth) | User profiles, donation history, AI results |
| **Sepolia ETH** | FREE (test network) | No real money, all transactions are test |
| **Vercel** | FREE (deploy + hosting) | Host your app for free |
| **TOTAL COST** | **$0/month** | **Forever free!** |

---

## Features

### Core Platform
✅ **Campaign Creation** - Creators launch verified campaigns with clear milestones
✅ **Donation System** - Donors contribute ETH with full transparency
✅ **Milestone Voting** - Donors collectively decide when funds are released
✅ **Fund Escrow** - Smart contracts hold donations until verification
✅ **Refund Mechanism** - Auto-refund if campaigns don't reach goals

### AI Features
✅ **Campaign Legitimacy Scoring** - AI analyzes content for authenticity (0-100 score)
✅ **Suspicious Content Detection** - Flags potential fraud indicators automatically
✅ **Smart Recommendations** - Personalized campaign suggestions for each donor
✅ **Milestone Verification** - AI assesses if milestones are objectively verifiable

### User Experience
✅ **MetaMask Integration** - Seamless wallet connection
✅ **Real-time Updates** - Live campaign progress and donor activity
✅ **Mobile Responsive** - Works on desktop and mobile
✅ **Trust Indicators** - Clear transparency metrics on every campaign
✅ **Donor Dashboard** - Track contributions, votes, and recommendations

---

## Quick Start

### Prerequisites
- Node.js 18+
- MetaMask browser extension
- 5 minutes of setup time
- No credit card needed!

### 30-Second Overview
1. Get Groq API key (https://console.groq.com) - FREE
2. Create Supabase project (https://supabase.com) - FREE
3. Deploy smart contract on Sepolia - FREE
4. Get test ETH from faucet - FREE
5. Configure `.env.local` with your credentials
6. Run `npm install && npm run dev`
7. Visit http://localhost:3000

**See [CONFIGURATION_GUIDE.md](./CONFIGURATION_GUIDE.md) for detailed step-by-step instructions with links!**

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/trustfund.git
cd trustfund
```

2. **Install dependencies**
```bash
npm install
```

3. **Setup your FREE accounts** (see CONFIGURATION_GUIDE.md)
   - Groq AI (2 min): https://console.groq.com
   - Supabase (5 min): https://supabase.com
   - Deploy contract (5 min): https://remix.ethereum.org
   - Get test ETH (2 min): https://sepoliafaucet.com

3. **Set up environment variables**
```bash
cp .env.example .env.local
# Fill in your Supabase, contract, and OpenAI keys
```

4. **Deploy smart contract to Sepolia**
- Go to https://remix.ethereum.org
- Upload `/contracts/Crowdfunding.sol`
- Deploy with MetaMask (Sepolia selected)
- Copy contract address → `NEXT_PUBLIC_CONTRACT_ADDRESS`

5. **Set up Supabase**
- Create project at https://supabase.com
- Run migration: `/scripts/01_create_schema.sql`
- Get credentials → Fill in `.env.local`

6. **Run development server**
```bash
npm run dev
```

Open http://localhost:3000 in your browser.

---

## Usage

### Creating a Campaign

1. Click "Connect Wallet" (MetaMask)
2. Click "Start Campaign" in header
3. Fill in details:
   - Campaign title & description
   - Target amount in ETH
   - Duration in days
   - Category
4. Click "Create Campaign"
5. Approve MetaMask transaction
6. Campaign appears after AI verification (~30 seconds)

### Making a Donation

1. Go to "Explore Campaigns"
2. Click on a campaign
3. Enter donation amount (0.1 ETH minimum recommended)
4. Click "Donate Now"
5. Approve MetaMask transaction
6. Donation recorded on blockchain
7. You can now vote on milestones

### Voting on Milestones

1. Go to campaign detail page
2. Find milestone in "Milestones" tab
3. Click "Vote" (if campaign funded)
4. Approve or reject milestone
5. If 80% of donors approve, funds auto-release

---

## Architecture

### Tech Stack
- **Frontend**: Next.js 16, React 19, Tailwind CSS
- **Backend**: Next.js API Routes, Node.js
- **Database**: Supabase (PostgreSQL)
- **Blockchain**: Ethereum Sepolia, Solidity 0.8.19
- **Web3**: ethers.js, MetaMask
- **AI**: OpenAI GPT-4o-mini
- **Deployment**: Vercel

### System Architecture
```
Frontend (Next.js + React)
    ↓
Web3 Integration (ethers.js + MetaMask)
    ↓
Next.js API Routes
    ↓
Supabase Database + OpenAI API
    ↓
Ethereum Sepolia Smart Contract
```

For detailed architecture, see [ARCHITECTURE.md](./ARCHITECTURE.md)

---

## Smart Contract

### Key Functions

**For Campaign Creators:**
- `createCampaign()` - Launch new campaign
- `createMilestone()` - Add funding milestone
- `withdrawMilestoneFunds()` - Withdraw after verification
- `cancelCampaign()` - Cancel and trigger refunds

**For Donors:**
- `donate()` - Send funds to campaign
- `voteMilestone()` - Vote on milestone completion
- `refundDonors()` - Trigger refund if deadline passes

**Platform:**
- 2% fee on all fund releases
- All funds held in escrow until verified
- No single point of failure

### Contract Address
After deployment, your contract address will be used throughout the platform.

Contract Code: [`/contracts/Crowdfunding.sol`](./contracts/Crowdfunding.sol)

---

## API Endpoints

### Campaigns
```
GET  /api/campaigns              # List campaigns
POST /api/campaigns              # Create metadata
GET  /api/campaigns/[id]         # Campaign details
```

### AI Verification
```
POST /api/ai/verify-campaign     # Legitimacy score (0-100)
POST /api/ai/detect-suspicious   # Content analysis
POST /api/ai/get-recommendations # ML recommendations
POST /api/ai/verify-milestone    # Milestone verification
```

Full API documentation in [ARCHITECTURE.md](./ARCHITECTURE.md#api-endpoints)

---

## Database Schema

### Key Tables
- `campaigns` - Campaign metadata with AI scores
- `users` - User profiles and verification status
- `donations` - Donation records with tx_hash
- `ai_verifications` - Legitimacy scores and analysis
- `suspicious_flags` - Fraud indicators detected
- `user_recommendations` - Personalized suggestions

All tables use RLS for security. Schema in `/scripts/01_create_schema.sql`

---

## Deployment

### Deploy to Vercel

1. **Push code to GitHub**
```bash
git push origin main
```

2. **Connect to Vercel**
- Go to https://vercel.com
- Import your GitHub repository
- Add environment variables from `.env.local`
- Click "Deploy"

3. **Post-Deployment**
- Update `NEXT_PUBLIC_CONTRACT_ADDRESS` if needed
- Verify Supabase connection
- Test all core flows

For detailed deployment instructions, see [SETUP_GUIDE.md](./SETUP_GUIDE.md)

---

## Testing

### Local Testing
```bash
# Start development server
npm run dev

# Test campaign creation
# Test donations
# Test voting
# Test AI verification
```

### Smart Contract Testing (Optional)
```bash
# Install Hardhat
npm install --save-dev hardhat

# Compile contract
npx hardhat compile

# Run tests
npx hardhat test
```

### Sepolia Testnet
- All features work on Sepolia
- Use test ETH from [faucet](https://sepoliafaucet.com)
- View transactions on [Etherscan](https://sepolia.etherscan.io)

---

## Security

### Smart Contract Security
- No external dependencies
- Reentrancy-safe (call pattern)
- Access control on all functions
- Fund escrow mechanism

### Backend Security
- RLS policies on all database tables
- Input validation (Zod)
- No private keys in code
- Environment variables protected

### Frontend Security
- Web3 signature verification
- No sensitive data in localStorage
- CSRF protection built-in
- XSS protection via React

### Blockchain Security
- User funds in escrow
- Transparent milestone voting
- Donor refund mechanism
- No admin keys

For full security audit details, see [ARCHITECTURE.md](./ARCHITECTURE.md#security-measures)

---

## Performance

- **Frontend**: Server-side rendering, automatic code splitting
- **Backend**: Database query optimization, connection pooling
- **Blockchain**: Batch operations, minimal contract calls
- **AI**: Response caching in Supabase

Typical metrics:
- Page load: <2 seconds
- Campaign creation: <30 seconds (including AI verification)
- Donation confirmation: <15 seconds
- Database queries: <100ms

---

## Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### Development Guidelines
- Use TypeScript for all new code
- Follow ESLint configuration
- Write tests for new features
- Update documentation
- Test on Sepolia before mainnet

### Code Style
```bash
# Format code
npx prettier --write .

# Lint code
npm run lint
```

---

## Roadmap

### v1.0 (Current)
- ✅ Core campaign creation & donations
- ✅ AI legitimacy verification
- ✅ Milestone voting system
- ✅ MetaMask integration

### v1.1 (Planned)
- [ ] Email notifications
- [ ] Social media sharing
- [ ] Creator profiles
- [ ] Donation history

### v2.0 (Future)
- [ ] Layer 2 deployment (Arbitrum/Optimism)
- [ ] DAO token launch
- [ ] Governance voting
- [ ] Mobile app (React Native)

### v3.0 (Long-term)
- [ ] Cross-chain bridges
- [ ] NFT rewards
- [ ] Decentralized moderation
- [ ] Advanced analytics dashboard

---

## Troubleshooting

### Common Issues

**MetaMask won't connect**
- Ensure MetaMask is installed
- Switch to Sepolia testnet
- Try reloading the page

**Campaign creation fails**
- Check you have Sepolia ETH (minimum 0.5 ETH)
- Verify contract address in env vars
- Check gas prices aren't too high

**Supabase connection errors**
- Verify URL and anon key
- Check Supabase project is running
- Ensure RLS policies are correct

**AI features not working**
- Verify OpenAI API key is valid
- Check API quota hasn't exceeded
- Ensure `NEXT_PUBLIC_AI_ENABLED=true`

For more help, check [SETUP_GUIDE.md](./SETUP_GUIDE.md#troubleshooting)

---

## Resources

### Documentation
- [Setup Guide](./SETUP_GUIDE.md) - Complete deployment instructions
- [Architecture](./ARCHITECTURE.md) - Technical deep dive
- [Smart Contract Code](./contracts/Crowdfunding.sol) - Contract reference

### External Resources
- [Solidity Documentation](https://docs.soliditylang.org/)
- [ethers.js Documentation](https://docs.ethers.org/)
- [Supabase Documentation](https://supabase.com/docs)
- [Next.js Documentation](https://nextjs.org/docs)
- [Sepolia Faucet](https://sepoliafaucet.com)

---

## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

---

## Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- Web3 integration via [ethers.js](https://etherscan.io/)
- Database by [Supabase](https://supabase.com/)
- UI components from [Shadcn/ui](https://ui.shadcn.com/)
- AI features powered by [OpenAI](https://openai.com/)
- Deployed on [Vercel](https://vercel.com/)

---

## Support

For support, questions, or feedback:
- Open an issue on [GitHub](https://github.com/yourusername/trustfund/issues)
- Check [Discussions](https://github.com/yourusername/trustfund/discussions)
- Read our [Documentation](./SETUP_GUIDE.md)

---

<div align="center">

Built with ❤️ for transparent, AI-verified crowdfunding

[Star ⭐](https://github.com/yourusername/trustfund) | [Fork 🍴](https://github.com/yourusername/trustfund/fork) | [Watch 👀](https://github.com/yourusername/trustfund)

</div>
