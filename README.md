# ProfitTerminal

A local-first AI trading operating system for Indian equity and options markets (NSE stocks, NIFTY/BANKNIFTY options).

## Overview

ProfitTerminal enforces strict separation between AI reasoning and market execution through deterministic quant and risk engines. AI cannot fabricate data or bypass risk controls.

### Architecture

```
Market Data (Kite Connect)
    ↓
Backend API (NestJS:4000) - Data Orchestration
    ↓
Quant Engine (Python FastAPI:8000) - Deterministic Analysis
    ↓
AI Service (External API / Ollama) - Reasoning Layer
    ↓
Risk Engine (NestJS Module) - Validation Layer
    ↓
User Confirmation (Frontend) - Human-in-the-Loop
    ↓
Broker API (Kotak Neo) - Execution Layer
```

## Technology Stack

- **Frontend**: Next.js 14+ (App Router), TypeScript, Tailwind CSS, shadcn/ui, TradingView Lightweight Charts
- **Backend**: NestJS 10+, TypeScript, Prisma ORM, class-validator
- **Quant Engine**: Python 3.11+, FastAPI, Pandas, NumPy, TA-Lib, SciPy
- **Database**: PostgreSQL 15+
- **State Management**: Zustand (Frontend), TanStack Query (data fetching)

## Prerequisites

- Node.js 18+
- pnpm 8+
- Python 3.11+
- PostgreSQL 15+
- Docker & Docker Compose (for PostgreSQL)

## Getting Started

### 1. Clone and Setup

```bash
git clone <repository-url>
cd profitterminal

# Copy environment variables
cp .env.example .env

# Edit .env and add your API keys
```

### 2. Install Dependencies

```bash
# Install Node.js dependencies
pnpm install

# Install Python dependencies
cd apps/quant
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
cd ../..
```

### 3. Start Database

```bash
# Start PostgreSQL via Docker Compose
docker-compose up -d

# Run Prisma migrations
pnpm db:migrate

# Generate Prisma client
pnpm db:generate
```

### 4. Start All Services

```bash
# Start all services (Frontend, Backend, Quant Engine)
pnpm dev
```

Or start services individually:

```bash
# Terminal 1: Frontend (localhost:3000)
pnpm dev:web

# Terminal 2: Backend API (localhost:4000)
pnpm dev:api

# Terminal 3: Quant Engine (localhost:8000)
pnpm dev:quant
```

### 5. Access the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:4000
- **Quant Engine**: http://localhost:8000
- **Prisma Studio**: `pnpm db:studio` (http://localhost:5555)

## Project Structure

```
profitterminal/
├── apps/
│   ├── web/         # Next.js frontend
│   ├── api/         # NestJS backend
│   └── quant/       # Python FastAPI quant engine
├── packages/
│   ├── types/       # Shared TypeScript types
│   ├── indicators/  # Technical indicators (future)
│   ├── trading-engine/    # Trading logic (future)
│   ├── trendline-engine/  # Trendline detection (future)
│   ├── risk-engine/       # Risk validation (future)
│   └── ai-engine/         # AI service (future)
├── prisma/          # Database schema
├── scripts/         # Build/deployment scripts
├── docker-compose.yml
├── .env.example
├── .gitignore
└── README.md
```

## Development

### Code Quality

```bash
# Format code
pnpm format

# Lint code
pnpm lint

# Type check
pnpm type-check
```

### Database Management

```bash
# Create new migration
pnpm db:migrate

# Generate Prisma client
pnpm db:generate

# Open Prisma Studio
pnpm db:studio

# Reset database (⚠️ deletes all data)
pnpm db:reset
```

### Testing

```bash
# Run all tests
pnpm test

# Run frontend tests
pnpm --filter web test

# Run backend tests
pnpm --filter api test

# Run quant engine tests
cd apps/quant && pytest
```

## API Configuration

### Kite Connect (Market Data)

1. Sign up at https://kite.trade/
2. Create an app to get API key and secret
3. Add credentials to `.env`

### Kotak Neo (Broker)

1. Sign up at https://www.kotaksecurities.com/
2. Get API credentials
3. Add credentials to `.env`

### AI Provider

**OpenAI (Default):**

```bash
AI_PROVIDER=openai
OPENAI_API_KEY=your-api-key
```

**Ollama (Local):**

```bash
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
```

## Features

- ✅ Natural language trade analysis
- ✅ Technical indicator calculations (RSI, MACD, Bollinger Bands, etc.)
- ✅ Trendline and support/resistance detection
- ✅ AI-powered trade recommendations
- ✅ Risk validation engine
- ✅ Paper trading
- ✅ Live trading with user confirmation
- ✅ Real-time portfolio tracking
- ✅ Options Greeks calculation
- ✅ Strategy generation and backtesting

## Architecture Constraints

1. **AI Cannot Access Market Data Directly**: All data flows through deterministic Quant Engine
2. **AI Cannot Execute Trades**: All recommendations pass through Risk Engine validation
3. **User Confirmation Required**: Live trades require explicit confirmation via frontend
4. **Deterministic Processing First**: Market data → Quant → AI → Risk → User → Broker

## License

MIT

---

## Phase 2 Update: Comprehensive Database Schema

### ✅ Phase 2 Completed

The database schema has been completely redesigned with **full AI traceability** as the core principle.

### Schema Overview

**40 Models** organized into 9 logical groups:

1. **User & Configuration** (2 models): User, RiskProfile
2. **Market Data & Instruments** (6 models): Instrument, MarketData, Candle, IndicatorSnapshot, Trendline, SupportResistance, MarketRegime
3. **AI Traceability** (9 models): Prompt, PromptVersion, AIConversation, AIMessage, Agent, AgentObservation, AgentDecision, AgentMemory
4. **Signals** (1 model): Signal - the core traceability hub
5. **Trading** (6 models): PaperTrade, LiveTrade, TradeExecution
6. **Backtesting** (2 models): Backtest, BacktestTrade
7. **Portfolio & Positions** (4 models): Portfolio, Position, Order
8. **Trade Journal** (1 model): TradeJournal
9. **Audit Log** (1 model): AuditLog

### Key Features

#### Complete AI Traceability

Every AI recommendation is traceable through:

```
User Prompt
    ↓
Prompt Version (processed)
    ↓
AI Message (response with market context snapshot)
    ↓
Signal (recommendation with all market data links)
    ↓
Paper/Live Trade (execution with signal reference)
    ↓
Trade Journal (reflection)
```

#### Signal Model - The Traceability Hub

The `Signal` model connects everything:

- **Source**: promptId, aiMessageId, agentDecisionId
- **Market Context**: instrumentId, indicatorSnapshotId, trendlineId, supportResistanceId, marketRegimeId
- **Recommendation**: entry, stop, target, position size
- **Risk/Reward**: risk amount, reward amount, risk/reward ratio
- **Probability**: AI-estimated success probability
- **Reasoning**: full text reasoning + key factors

#### AI Agent System

- 6 agent types: Market Analyst, Risk Manager, Strategy Developer, etc.
- Agents have: Observations, Decisions, Memory
- Full tracking of agent reasoning and performance

#### Comprehensive Enums

27 enums for type-safe categorical data:

- AIProvider, AssetType, Timeframe, SignalType, TradeExecutionStatus, etc.

### Database Documentation

See `prisma/SCHEMA_DOCUMENTATION.md` for complete documentation including:

- Detailed model descriptions
- Relationship diagrams
- Index strategy
- Performance considerations
- Migration notes
- Compliance guidelines

### Schema Validation

```bash
# Validate schema
npx prisma validate

# Generate client
npx prisma generate

# Run migration (requires Docker)
docker-compose up -d
pnpm db:migrate
```

### ⚠️ Breaking Changes from Phase 1

Phase 2 is a complete schema rewrite:

- Old `Recommendation` model replaced by `Signal`
- User → split into `User` + `RiskProfile`
- Added `Instrument` master table
- Split `Trade` → `PaperTrade` + `LiveTrade`
- Added 30+ new models for AI traceability

If migrating from Phase 1, export data first, then re-import with mapping.

---

## Support

For issues and questions, please open a GitHub issue.
# twelve
