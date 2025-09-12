#!/bin/bash

# Deploy script for blockFiles with ownership and gasless features

echo "🚀 Starting blockFiles deployment..."

# Check if Hardhat is available
if ! command -v npx &> /dev/null; then
    echo "❌ npx not found. Please install Node.js and npm."
    exit 1
fi

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

        # Update .env file with contract address
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS
            sed -i '' "s|CONTRACT_ADDRESS=.*|CONTRACT_ADDRESS=$CONTRACT_ADDRESS|" .env
        else
            # Linux/Windows
            sed -i "s|CONTRACT_ADDRESS=.*|CONTRACT_ADDRESS=$CONTRACT_ADDRESS|" .env
        fi

        echo "📝 Updated .env with contract address"
    else
        echo "⚠️  Could not extract contract address from deployment output"
    fi
else
    echo "❌ Contract deployment failed"
    kill $HARDHAT_PID
    exit 1
fi

# Start the relayer service
echo "🔄 Starting gasless transaction relayer..."
cd server
npm install
npm run relayer &
RELAYER_PID=$!

cd ..

echo "🎉 Deployment complete!"
echo "📍 Hardhat Node: http://127.0.0.1:8545"
echo "🔄 Relayer Service: http://127.0.0.1:3001"
echo "📄 Contract Address: $CONTRACT_ADDRESS"
echo ""
echo "💡 Next steps:"
echo "1. Start the backend: cd server && npm start"
echo "2. Start the frontend: npm run dev"
echo "3. Import Hardhat accounts into MetaMask"
echo "4. Test file sharing and gasless transactions!"
echo ""
echo "Press Ctrl+C to stop all services"

# Wait for user interrupt
trap "echo '🛑 Stopping services...'; kill $HARDHAT_PID $RELAYER_PID; exit" INT
wait
