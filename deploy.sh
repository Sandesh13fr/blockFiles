#!/bin/bash

# Deploy script for blockFiles with a local Hardhat dev chain

echo "🚀 Starting blockFiles deployment..."

# Check if Hardhat is available
if ! command -v npx &> /dev/null; then
    echo "❌ npx not found. Please install Node.js and npm."
    exit 1
fi

# Helper to update or append env vars
update_env_var() {
    local key="$1"
    local value="$2"
    if grep -q "^${key}=" .env 2>/dev/null; then
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i '' "s|^${key}=.*|${key}=${value}|" .env
        else
            sed -i "s|^${key}=.*|${key}=${value}|" .env
        fi
    else
        echo "${key}=${value}" >> .env
    fi
}

# Start Hardhat node in background
echo "📍 Starting Hardhat local node..."
npx hardhat node &
HARDHAT_PID=$!

# Wait for Hardhat node to start
sleep 5

# Deploy the contract
echo "📝 Deploying FileOwnershipRegistry contract..."
DEPLOY_OUTPUT=$(npx hardhat run scripts/deploy.js --network localhost)

if [ $? -eq 0 ]; then
    # Extract contract address from deployment output
    CONTRACT_ADDRESS=$(echo "$DEPLOY_OUTPUT" | grep "FileOwnershipRegistry deployed to:" | awk '{print $NF}')

    if [ -n "$CONTRACT_ADDRESS" ]; then
        echo "✅ Contract deployed at: $CONTRACT_ADDRESS"

        # Update .env file with contract addresses consumed by backend/frontend
        update_env_var "CONTRACT_ADDRESS" "$CONTRACT_ADDRESS"
        update_env_var "VITE_CONTRACT_ADDRESS" "$CONTRACT_ADDRESS"

        echo "📝 Updated .env with backend and frontend contract addresses"
    else
        echo "⚠️  Could not extract contract address from deployment output"
    fi
else
    echo "❌ Contract deployment failed"
    kill $HARDHAT_PID
    exit 1
fi

# Install backend deps (if not already installed)
cd server
npm install
cd ..

echo "🎉 Deployment complete!"
echo "📍 Hardhat Node: http://127.0.0.1:8545"
echo "📄 Contract Address: $CONTRACT_ADDRESS"
echo ""
echo "💡 Next steps:"
echo "1. Start the backend: cd server && npm start"
echo "2. Start the frontend: npm run dev"
echo "3. Import Hardhat accounts into MetaMask"
echo "4. Upload files and register ownership using your local free ETH"
echo ""
echo "Press Ctrl+C to stop all services"

# Wait for user interrupt
trap "echo '🛑 Stopping Hardhat node...'; kill $HARDHAT_PID; exit" INT
wait $HARDHAT_PID
