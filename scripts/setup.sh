#!/bin/bash

# ProfitTerminal Setup Script

echo "🚀 Setting up ProfitTerminal..."

# Check prerequisites
echo "Checking prerequisites..."

if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+"
    exit 1
fi

if ! command -v pnpm &> /dev/null; then
    echo "❌ pnpm is not installed. Please install pnpm 8+"
    exit 1
fi

if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python 3.11+"
    exit 1
fi

if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker"
    exit 1
fi

echo "✅ All prerequisites are installed"

# Copy environment file
if [ ! -f .env ]; then
    echo "📝 Creating .env file from .env.example..."
    cp .env.example .env
    echo "⚠️  Please edit .env and add your API keys"
else
    echo "✅ .env file already exists"
fi

# Install Node.js dependencies
echo "📦 Installing Node.js dependencies..."
pnpm install

# Set up Python virtual environment
echo "🐍 Setting up Python environment..."
cd apps/quant
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi
source venv/bin/activate
pip install -r requirements.txt
cd ../..

# Start PostgreSQL
echo "🐘 Starting PostgreSQL..."
docker-compose up -d

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
sleep 5

# Run Prisma migrations
echo "🗄️  Running database migrations..."
pnpm db:generate
pnpm db:migrate

echo "✅ Setup complete!"
echo ""
echo "To start all services:"
echo "  pnpm dev"
echo ""
echo "Or start services individually:"
echo "  pnpm dev:web    # Frontend (localhost:3000)"
echo "  pnpm dev:api    # Backend (localhost:4000)"
echo "  pnpm dev:quant  # Quant Engine (localhost:8000)"
