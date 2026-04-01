# blockFiles - Decentralized File Storage

A modern, decentralized file storage application built with React, IPFS, Ethereum, and a local Hardhat dev chain. Store, share, and manage files securely with blockchain-verified ownership.

## ✨ Features

### Core Features
- **Decentralized Storage**: Files stored on IPFS for censorship-resistant, permanent storage
- **Blockchain Ownership**: File ownership registered on Ethereum with smart contracts
- **MetaMask Integration**: Seamless Web3 wallet connection
- **Secure File Management**: Upload, download, and delete files with ownership verification

### 🚀 Ownership Transfer & Sharing
- **Transfer Ownership**: Permanently transfer file ownership to another wallet
- **Grant Access**: Share read-only or read-write access to specific addresses
- **Time-Limited Access**: Set expiration times for shared access
- **Shared Access Links**: Create one-time use links for file access
- **Access Management**: View and revoke granted permissions

### ⚡ Local Dev Chain with Free ETH
- **Hardhat Node**: Local Ethereum network with pre-funded demo accounts
- **Direct MetaMask Transactions**: Users sign and send transactions themselves
- **Predictable Costs**: Gas fees are paid with the free ETH supplied by Hardhat
- **Lean Architecture**: No additional relayer services to run or secure

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React Frontend│    │  Express Backend │    │   IPFS Network  │
│                 │    │                 │    │                 │
│ - File Upload   │◄──►│ - API Endpoints │◄──►│ - Content Storage│
│ - MetaMask      │    │ - PostgreSQL DB │    │ - CID Generation│
│ - Sharing UI    │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 ▼
                    ┌─────────────────┐
                    │ Ethereum Network│
                    │                 │
                    │ - Smart Contract│
                    │ - Ownership Reg │
                    │ - Access Control│
                    └─────────────────┘
```

## 🚀 Quick Start

### Prerequisites
- Node.js 16+
- PostgreSQL
- IPFS Desktop or local IPFS node
- MetaMask browser extension

### 1. Clone and Install
```bash
git clone <repository-url>
cd blockFiles

# Install frontend dependencies
npm install

# Install backend dependencies
cd server
npm install
cd ..
```

### 2. Environment Setup
```bash
# Copy environment template
cp .env.example .env

# Update .env with your configuration
# Add your contract address, RPC URL, etc.
```

### 3. Database Setup
```sql
-- Create PostgreSQL database
createdb blockfiles

-- Update .env with your PostgreSQL credentials
PGUSER=your_username
PGPASSWORD=your_password
PGDATABASE=blockfiles
```

### 4. Deploy Smart Contract
```bash
# Start Hardhat node
npx hardhat node

# Deploy contract (in another terminal)
npx hardhat run scripts/deploy.js --network localhost

# Copy the deployed contract address to .env
CONTRACT_ADDRESS=0xYourDeployedContractAddress
```

### 5. Start Services
```bash
# Option 1: Use the deployment script (recommended)
chmod +x deploy.sh
./deploy.sh

# Option 2: Manual startup
# Terminal 1: Start Hardhat node
npx hardhat node

# Terminal 2: Start backend API
cd server && npm start

# Terminal 3: Start frontend
npm run dev
```

### 6. MetaMask Setup
1. Open MetaMask and switch to "Localhost 8545" network
2. Import an account from Hardhat node output using the private key
3. The account will have 10,000 test ETH for development

## 📖 Usage

### File Management
1. **Upload Files**: Click "Choose Files" and select files to upload
2. **View Files**: See all your uploaded files in the table
3. **Download Files**: Click "Download" to retrieve files from IPFS
4. **Delete Files**: Remove files from storage (requires ownership)

### Sharing & Access Control
1. **Share with Address**:
   - Click "Share" on any file
   - Enter recipient's Ethereum address
   - Choose read-only or read-write access
   - Set optional expiration time

2. **Create Share Link**:
   - Click "Share" → "Create Share Link"
   - Configure permissions and expiry
   - Copy the generated link
   - Recipients can claim access via the link

3. **Transfer Ownership**:
   - Click "Transfer" on any file
   - Enter new owner's address
   - Type "TRANSFER" to confirm
   - Ownership is permanently transferred

### Local Development Chain
- Transactions are submitted directly from MetaMask to the Hardhat node
- Hardhat provides 20 accounts preloaded with 10,000 test ETH each
- Import any of those private keys into MetaMask for free test funds
- Gas costs are predictable and free thanks to Hardhat's faucet

## 🔧 Configuration

### Environment Variables (.env)
```env
# IPFS Configuration
IPFS_API_URL=http://127.0.0.1:5001/api/v0

# Backend Configuration
PORT=4000
API_BASE_PATH=/api
OPENROUTER_API_KEY=your_openrouter_api_key
OPENROUTER_CHAT_MODEL=openai/gpt-4o-mini
OPENROUTER_EMBED_MODEL=openai/text-embedding-3-small

# Database Configuration
# Preferred for hosted Postgres (Supabase/Neon/Render):
DATABASE_URL=postgresql://<user>:<password>@<host>:6543/postgres?sslmode=require

# Optional explicit SSL flags (defaults are Supabase-safe when DATABASE_URL contains supabase):
DB_ENABLE_SSL=true
DB_SSL_REJECT_UNAUTHORIZED=false

# Local fallback (used only when DATABASE_URL is not set):
PGUSER=postgres
PGPASSWORD=root
PGHOST=localhost
PGPORT=5432
PGDATABASE=blockfiles

# Frontend Configuration
FRONTEND_ORIGIN=http://localhost:5173
VITE_API_BASE_PATH=/api
VITE_CONTRACT_ADDRESS=0xYourDeployedContractAddress

# Smart Contract / Chain
RPC_URL=http://127.0.0.1:8545
CONTRACT_ADDRESS=0xYourDeployedContractAddress
SERVER_PRIVATE_KEY=hardhat_account_private_key # optional, used for registry reads
```

## 🛠️ Development

### Project Structure
```
blockFiles/
├── contracts/              # Solidity smart contracts
├── scripts/               # Deployment scripts
├── server/                # Express.js backend
│   └── src/              # Backend source code
├── src/                  # React frontend
│   ├── components/       # Reusable UI components
│   ├── pages/           # Page components
│   ├── utils/           # Utility functions
│   └── hooks/           # Custom React hooks
├── test/                 # Test files
└── public/               # Static assets
```

### Available Scripts
```bash
# Frontend
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build

# Backend
cd server
npm start           # Start production server
npm run dev         # Start development server with nodemon

# Smart Contracts
npx hardhat compile    # Compile contracts
npx hardhat test       # Run tests
npx hardhat node       # Start local Ethereum node
npx hardhat run scripts/deploy.js --network localhost
```

## 🔒 Security Features

- **Access Control**: Granular permissions for file access
- **Time-Limited Access**: Automatic expiration of shared access
- **Signature Verification**: Typed data and contract checks secure shared access workflows
- **Nonce Management**: Prevents replay attacks for share links and authorization flows

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- [IPFS](https://ipfs.io/) for decentralized storage
- [Ethereum](https://ethereum.org/) for blockchain infrastructure
- [MetaMask](https://metamask.io/) for Web3 wallet integration
- [Hardhat](https://hardhat.org/) for Ethereum development environment
