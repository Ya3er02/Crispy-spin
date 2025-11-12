# CrispySpin - Complete Deployment Guide

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Smart Contract Deployment](#smart-contract-deployment)
4. [Database Setup](#database-setup)
5. [Backend Deployment](#backend-deployment)
6. [Frontend Deployment](#frontend-deployment)
7. [Farcaster Frames](#farcaster-frames)
8. [Testing](#testing)
9. [Production Checklist](#production-checklist)

---

## Prerequisites

### Required Tools
- Node.js 18+ and npm/yarn
- PostgreSQL 14+
- Git
- MetaMask or compatible Web3 wallet
- Base Sepolia testnet ETH (from faucet)

### Required Accounts
- WalletConnect Project ID: https://cloud.walletconnect.com/
- Alchemy or similar RPC provider account
- BaseScan API key (for contract verification)
- Farcaster account (for Frames testing)

---

## Environment Setup

### 1. Clone and Install

```bash
# Clone repository
git clone https://github.com/your-org/crispyspin.git
cd crispyspin

# Install root dependencies
npm install

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../webapp
npm install
```

### 2. Get Base Sepolia Testnet ETH

```bash
# Visit Base Sepolia faucet
https://www.alchemy.com/faucets/base-sepolia

# Or use ETHGlobal faucet
https://ethglobal.com/faucet

# Request 0.05-0.5 ETH for deployment
```

### 3. Create Environment Files

#### Root `.env`
```env
# Network Configuration
BASE_SEPOLIA_RPC=https://base-sepolia.g.alchemy.com/v2/YOUR_API_KEY
BASE_MAINNET_RPC=https://base-mainnet.g.alchemy.com/v2/YOUR_API_KEY
CHAIN_ID=84532

# Deployment
PRIVATE_KEY=your_deployer_private_key_here
BASESCAN_API_KEY=your_basescan_api_key
```

#### Backend `.env`
```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=crispyspin
DB_USER=postgres
DB_PASSWORD=your_secure_password

# Blockchain
BASE_SEPOLIA_RPC=https://base-sepolia.g.alchemy.com/v2/YOUR_API_KEY
FRIES1155_ADDRESS=0x... # (deployed contract address)
REWARD_VAULT_ADDRESS=0x... # (deployed contract address)
PARTNER_TOKEN_ADDRESS=0x... # (partner ERC20 address)

# Signing Keys
SIGNER_PRIVATE_KEY=your_backend_signer_private_key
MINTER_ADDRESS=0x... # (backend signer address)

# Server
PORT=3001
NODE_ENV=development
JWT_SECRET=your_jwt_secret_key_here

# Rate Limiting
RATE_LIMIT_MAX=30
RATE_LIMIT_WINDOW_MS=60000

# Farcaster
FARCASTER_API_KEY=your_farcaster_api_key
```

#### Frontend `.env.local`
```env
# WalletConnect
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=your_walletconnect_project_id

# Contract Addresses
NEXT_PUBLIC_FRIES1155_ADDRESS=0x...
NEXT_PUBLIC_REWARD_VAULT_ADDRESS=0x...

# API URLs
NEXT_PUBLIC_API_URL=http://localhost:3001
BACKEND_URL=http://localhost:3001

# Treasury
NEXT_PUBLIC_TREASURY_ADDRESS=0x... # (for Base Pay payments)

# Chain
NEXT_PUBLIC_CHAIN_ID=84532
```

---

## Smart Contract Deployment

### 1. Prepare Contracts

```bash
cd contracts

# Install Hardhat and dependencies
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox
npm install @openzeppelin/contracts
```

### 2. Configure Hardhat

Create `hardhat.config.js`:
```javascript
require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    "base-sepolia": {
      url: process.env.BASE_SEPOLIA_RPC,
      accounts: [process.env.PRIVATE_KEY],
      chainId: 84532
    }
  },
  etherscan: {
    apiKey: {
      "base-sepolia": process.env.BASESCAN_API_KEY
    },
    customChains: [
      {
        network: "base-sepolia",
        chainId: 84532,
        urls: {
          apiURL: "https://api-sepolia.basescan.org/api",
          browserURL: "https://sepolia.basescan.org"
        }
      }
    ]
  }
};
```

### 3. Deploy Contracts

```bash
# Compile contracts
npx hardhat compile

# Deploy to Base Sepolia
npx hardhat run scripts/deploy.js --network base-sepolia

# Output will show deployed addresses:
# ✅ Fries1155 deployed to: 0x...
# ✅ RewardVault deployed to: 0x...
```

### 4. Verify Contracts

```bash
# Verify Fries1155
npx hardhat verify --network base-sepolia FRIES1155_ADDRESS "https://api.crispyspin.xyz/metadata/" ADMIN_ADDRESS MINTER_ADDRESS

# Verify RewardVault
npx hardhat verify --network base-sepolia REWARD_VAULT_ADDRESS ADMIN_ADDRESS SIGNER_ADDRESS
```

### 5. Configure Contract Roles

```bash
# Grant MINTER_ROLE to backend server
npx hardhat run scripts/grant-roles.js --network base-sepolia
```

Create `scripts/grant-roles.js`:
```javascript
const hre = require("hardhat");

async function main() {
    const fries1155Address = process.env.FRIES1155_ADDRESS;
    const backendSigner = process.env.MINTER_ADDRESS;

    const Fries1155 = await hre.ethers.getContractAt("Fries1155", fries1155Address);

    const MINTER_ROLE = await Fries1155.MINTER_ROLE();
    await Fries1155.grantRole(MINTER_ROLE, backendSigner);

    console.log("✅ MINTER_ROLE granted to:", backendSigner);
}

main().then(() => process.exit(0)).catch(error => {
    console.error(error);
    process.exit(1);
});
```

---

## Database Setup

### 1. Install PostgreSQL

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install postgresql postgresql-contrib

# macOS
brew install postgresql
brew services start postgresql

# Windows
# Download from https://www.postgresql.org/download/windows/
```

### 2. Create Database

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE crispyspin;

# Create user
CREATE USER crispyspin_user WITH ENCRYPTED PASSWORD 'your_secure_password';

# Grant privileges
GRANT ALL PRIVILEGES ON DATABASE crispyspin TO crispyspin_user;

# Exit
\q
```

### 3. Run Migrations

```bash
cd backend

# Run schema
psql -U crispyspin_user -d crispyspin -f src/db/schema.sql

# Or use migration script
node scripts/setup-database.js
```

Create `scripts/setup-database.js`:
```javascript
const { pool } = require('../src/config/database');
const fs = require('fs');
const path = require('path');

async function setupDatabase() {
    try {
        const schema = fs.readFileSync(
            path.join(__dirname, '../src/db/schema.sql'),
            'utf8'
        );

        await pool.query(schema);
        console.log('✅ Database schema created successfully');

        process.exit(0);
    } catch (error) {
        console.error('❌ Database setup failed:', error);
        process.exit(1);
    }
}

setupDatabase();
```

### 4. Verify Database

```bash
# List tables
psql -U crispyspin_user -d crispyspin -c "\dt"

# Should show:
# users, points, spins, claims, orders, spin_credits, farcaster_quests
```

---

## Backend Deployment

### 1. Project Structure

```bash
backend/
├── src/
│   ├── config/
│   ├── routes/
│   ├── services/
│   ├── middleware/
│   ├── utils/
│   └── server.js
├── package.json
└── .env
```

### 2. Install Dependencies

```bash
cd backend
npm install express cors dotenv pg ethers express-rate-limit helmet
```

### 3. Create Server (server.js)

```javascript
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const spinRoutes = require('./routes/spin');
const questRoutes = require('./routes/quests');
const pointsRoutes = require('./routes/points');
const marketRoutes = require('./routes/market');

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000,
    max: parseInt(process.env.RATE_LIMIT_MAX) || 30
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/spin', spinRoutes);
app.use('/api/quests', questRoutes);
app.use('/api/points', pointsRoutes);
app.use('/api/market', marketRoutes);

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`🚀 Backend server running on port ${PORT}`);
});
```

### 4. Start Backend

```bash
# Development
npm run dev

# Production
npm start
```

---

## Frontend Deployment

### 1. Install Dependencies

```bash
cd webapp
npm install next@latest react@latest react-dom@latest
npm install @rainbow-me/rainbowkit wagmi viem @tanstack/react-query
npm install @base-org/account @base-org/account-ui
npm install ethers
```

### 2. Configure Next.js

Create `next.config.js`:
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['ipfs.io'],
  },
  webpack: (config) => {
    config.resolve.fallback = { fs: false, net: false, tls: false };
    return config;
  },
}

module.exports = nextConfig;
```

### 3. Build and Run

```bash
# Development
npm run dev

# Production build
npm run build

# Start production server
npm start
```

### 4. Deploy to Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel

# Configure environment variables in Vercel dashboard
# Add all NEXT_PUBLIC_* variables
```

---

## Farcaster Frames

### 1. Create Frame Metadata

Create `app/frame/spin/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

  const html = `
<!DOCTYPE html>
<html>
  <head>
    <meta property="fc:frame" content="vNext" />
    <meta property="fc:frame:image" content="${baseUrl}/frame-spin.png" />
    <meta property="fc:frame:button:1" content="Spin Daily" />
    <meta property="fc:frame:button:1:action" content="tx" />
    <meta property="fc:frame:button:1:target" content="${baseUrl}/api/frame/spin" />
    <meta property="fc:frame:button:2" content="View Inventory" />
    <meta property="fc:frame:button:2:action" content="link" />
    <meta property="fc:frame:button:2:target" content="${baseUrl}/inventory" />
  </head>
</html>
  `;

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html' }
  });
}
```

### 2. Test Frame

```bash
# Visit Warpcast Frame Validator
https://warpcast.com/~/developers/frames

# Enter your frame URL
https://your-app.vercel.app/frame/spin
```

---

## Testing

### 1. Contract Testing

```bash
cd contracts

# Create test file
npx hardhat test

# Run specific test
npx hardhat test test/Fries1155.test.js
```

### 2. Backend API Testing

```bash
cd backend

# Install testing dependencies
npm install --save-dev jest supertest

# Run tests
npm test
```

### 3. Frontend E2E Testing

```bash
cd webapp

# Install Playwright
npm install --save-dev @playwright/test

# Run tests
npm run test:e2e
```

---

## Production Checklist

### Security
- [ ] All private keys stored securely (use AWS Secrets Manager / HashiCorp Vault)
- [ ] Environment variables not committed to Git
- [ ] Rate limiting enabled on all API endpoints
- [ ] CORS properly configured
- [ ] Database connection pooling configured
- [ ] SQL injection prevention (parameterized queries)
- [ ] SIWE nonce validation implemented
- [ ] Signature replay protection active

### Smart Contracts
- [ ] Contracts deployed and verified on BaseScan
- [ ] MINTER_ROLE granted to backend server
- [ ] RewardVault funded with reward tokens
- [ ] Contract ownership transferred to multisig
- [ ] Emergency pause functions tested

### Backend
- [ ] PostgreSQL properly configured and backed up
- [ ] Connection pool limits set
- [ ] Error logging configured (Sentry / DataDog)
- [ ] Health check endpoint active
- [ ] Cooldown timer working correctly
- [ ] RNG using crypto.randomBytes
- [ ] Payment verification tested

### Frontend
- [ ] WalletConnect Project ID configured
- [ ] RainbowKit wallet connectors tested
- [ ] Base Pay integration working
- [ ] All contract addresses updated
- [ ] Image assets optimized
- [ ] Error boundaries implemented
- [ ] Loading states handled

### Farcaster
- [ ] Frame metadata validated
- [ ] Transaction frames tested in Warpcast
- [ ] Button actions working
- [ ] Images properly sized (1.91:1 ratio)

### Monitoring
- [ ] Database monitoring enabled
- [ ] API response times tracked
- [ ] Contract events indexed
- [ ] Error alerting configured
- [ ] User analytics implemented

---

## Support & Resources

### Documentation
- Base Docs: https://docs.base.org
- RainbowKit: https://www.rainbowkit.com/docs
- Farcaster Frames: https://docs.farcaster.xyz/reference/frames/spec
- OpenZeppelin: https://docs.openzeppelin.com/contracts

### Faucets
- Base Sepolia: https://www.alchemy.com/faucets/base-sepolia
- Circle USDC Testnet: https://faucet.circle.com

### Support
- Discord: [Your Discord]
- GitHub Issues: [Your GitHub]
- Email: support@crispyspin.xyz

---

**Deployment complete! 🎉 Your CrispySpin app is now live on Base Sepolia.**
