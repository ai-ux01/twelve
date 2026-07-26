# ProfitTerminal

**Local-first AI Trading Operating System for Indian Markets**

ProfitTerminal is an intelligent trading workstation for NSE equity and options (NIFTY/BANKNIFTY). It enforces strict separation between AI reasoning and market execution — AI cannot fabricate data, bypass risk controls, or trade without human confirmation.

---

## Architecture

ProfitTerminal runs as 3 co-located services:

| Service | Technology | Port | Role |
|---------|-----------|------|------|
| Frontend | Next.js 14 (App Router) | :3000 | Dashboard, charts, trade confirmation UI |
| Backend API | NestJS 10 | :4000 | Data orchestration, risk engine, WebSocket |
| Quant Engine | FastAPI (Python) | :8000 | Deterministic analysis, indicators, scoring |

```
Market Data (Kite Connect)
    ↓
Backend API (NestJS :4000) — Data Orchestration
    ↓
Quant Engine (Python FastAPI :8000) — Deterministic Analysis
    ↓
AI Service (OpenAI / Ollama) — Reasoning Layer
    ↓
Risk Engine (NestJS Module) — Validation Layer
    ↓
User Confirmation (Frontend :3000) — Human-in-the-Loop
    ↓
Broker API (Kotak Neo) — Execution Layer
```

---

## Installation

### Prerequisites

- **Node.js** 18+ (LTS recommended)
- **pnpm** 8+ (package manager)
- **Python** 3.9+
- **PostgreSQL** 15+ (via Docker or local install)
- **Docker & Docker Compose** (for PostgreSQL)

### Clone and Install

```bash
git clone <repository-url>
cd profitterminal

# Install Node.js dependencies (frontend + backend + shared packages)
pnpm install

# Install Python dependencies (quant engine)
cd apps/quant
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
cd ../..
```

---

## Environment Setup

Copy the example and fill in your keys:

```bash
cp .env.example .env
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:postgres@localhost:5432/profitterminal?schema=public` |
| `KITE_API_KEY` | Kite Connect API key (market data) | — |
| `KITE_API_SECRET` | Kite Connect API secret | — |
| `KOTAK_API_KEY` | Kotak broker API key | — |
| `KOTAK_API_SECRET` | Kotak broker API secret | — |
| `KOTAK_NEO_CONSUMER_KEY` | Kotak Neo consumer key (live trading) | — |
| `KOTAK_NEO_CONSUMER_SECRET` | Kotak Neo consumer secret | — |
| `KOTAK_NEO_ACCESS_TOKEN` | Kotak Neo access token | — |
| `KOTAK_NEO_SESSION_TOKEN` | Kotak Neo session token | — |
| `AI_PROVIDER` | AI backend: `openai` or `ollama` | `ollama` |
| `OPENAI_API_KEY` | OpenAI API key (when provider is openai) | — |
| `OLLAMA_BASE_URL` | Ollama server URL (when provider is ollama) | `http://localhost:11434` |
| `AI_MODEL` | Model name (e.g. `gpt-4`, `llama2`, `mistral`) | Auto per provider |
| `BACKEND_API_URL` | Backend service URL | `http://localhost:4000` |
| `QUANT_ENGINE_URL` | Quant engine service URL | `http://localhost:8000` |
| `JWT_SECRET` | Secret for JWT token signing | Change in production |
| `DEFAULT_MAX_POSITION_SIZE` | Max position size in INR | `100000` |
| `DEFAULT_MAX_DRAWDOWN` | Max allowed drawdown (fraction) | `0.05` |
| `DEFAULT_MAX_PORTFOLIO_EXPOSURE` | Max portfolio exposure (fraction) | `0.30` |
| `DEFAULT_STOP_LOSS` | Default stop-loss percentage | `0.02` |

---

## Database Setup

### Start PostgreSQL

```bash
# Start PostgreSQL via Docker Compose
docker-compose up -d

# Verify it's running
docker ps  # should show profitterminal-db
```

Or create manually:

```bash
createdb profitterminal
```

### Run Migrations

```bash
# Generate Prisma client
pnpm db:generate

# Run database migrations
pnpm db:migrate

# (Optional) Open Prisma Studio to inspect data
pnpm db:studio
```

---

## Development Commands

### Start All Services (Recommended)

```bash
pnpm dev
```

This starts all 3 services concurrently using `concurrently`.

### Start Services Individually

```bash
# Terminal 1 — Frontend (http://localhost:3000)
pnpm dev:web

# Terminal 2 — Backend API (http://localhost:4000)
pnpm dev:api

# Terminal 3 — Quant Engine (http://localhost:8000)
pnpm dev:quant
```

### Build for Production

```bash
pnpm build        # Builds web + api
pnpm build:web    # Frontend only
pnpm build:api    # Backend only
```

### Code Quality

```bash
pnpm lint         # ESLint (web + api)
pnpm format       # Prettier formatting
```

---

## Kite Connect Setup (Market Data)

Kite Connect by Zerodha provides real-time and historical market data for NSE.

1. Sign up at [https://kite.trade](https://kite.trade)
2. Create an app in the developer console
3. Note your **API Key** and **API Secret**
4. Add to `.env`:

```bash
KITE_API_KEY="your-kite-api-key"
KITE_API_SECRET="your-kite-api-secret"
```

The system uses Kite Connect for:
- Real-time tick data (WebSocket)
- Historical OHLCV candles
- Instrument master list (NSE equity + F&O)

---

## Kotak Neo Setup (Broker Integration)

Kotak Neo is the execution broker for live order placement.

1. Sign up at [https://www.kotaksecurities.com](https://www.kotaksecurities.com)
2. Apply for API access via Kotak Neo Trade API portal
3. Obtain your credentials:
   - **Consumer Key** — identifies your app
   - **Consumer Secret** — app secret for OAuth
   - **Access Token** — user-level access token
   - **Session Token** — refreshed per trading session
4. Add to `.env`:

```bash
KOTAK_NEO_CONSUMER_KEY="your-consumer-key"
KOTAK_NEO_CONSUMER_SECRET="your-consumer-secret"
KOTAK_NEO_ACCESS_TOKEN="your-access-token"
KOTAK_NEO_SESSION_TOKEN="your-session-token"
```

> **Note**: Session tokens expire daily. You'll need to regenerate before each trading session.

---

## AI Setup

ProfitTerminal supports two AI backends:

### Option A: OpenAI (Cloud)

```bash
AI_PROVIDER="openai"
OPENAI_API_KEY="sk-..."
AI_MODEL="gpt-4"           # or gpt-3.5-turbo for lower cost
```

### Option B: Ollama (Local — Free, Private)

1. Install Ollama: [https://ollama.ai](https://ollama.ai)
2. Pull a model:

```bash
ollama pull llama2          # or mistral, codellama, mixtral
```

3. Configure `.env`:

```bash
AI_PROVIDER="ollama"
OLLAMA_BASE_URL="http://localhost:11434"
AI_MODEL="llama2"
```

The AI layer is used for:
- Natural language trade analysis
- Strategy generation and reasoning
- Trade coaching and journal insights
- Agent observations and decisions

---

## Paper Trading

Paper trading simulates real trades without risking capital. All signals flow through the same pipeline as live trades (AI → Risk → User) but execute against a virtual portfolio.

### How It Works

1. AI generates a trade signal with entry, stop-loss, and target
2. Risk engine validates position sizing and exposure limits
3. User confirms (or system auto-confirms in paper mode)
4. Trade is recorded with full metadata

### Data Stored Per Paper Trade

| Field | Description |
|-------|-------------|
| `symbol` | Instrument (e.g. RELIANCE, NIFTY24JANFUT) |
| `direction` | BUY or SELL |
| `entryPrice` | Signal entry price |
| `stopLoss` | Stop-loss level |
| `target` | Target price |
| `quantity` | Number of shares/lots |
| `status` | OPEN, CLOSED, CANCELLED |
| `exitPrice` | Actual exit price (when closed) |
| `pnl` | Realized profit/loss |
| `signalId` | Link to originating AI signal |
| `entryTime` | Timestamp of entry |
| `exitTime` | Timestamp of exit |
| `reasoning` | AI's reasoning for the trade |

Paper trades are stored in PostgreSQL and are fully queryable for performance analysis.

---

## Live Trading Safety

### Kill Switch

The kill switch **defaults to ON** (trading disabled). You must explicitly enable live trading from the dashboard.

When the kill switch is active:
- All broker API calls are blocked
- Signals still generate and display
- Paper trades continue normally
- Risk engine still validates (for monitoring)

### Execution Flow (CRITICAL)

```
AI Signal → Risk Engine → User Confirmation → Broker Execution
```

**NEVER**: `AI → Broker` (direct execution without human approval)

Every live trade requires:
1. **AI generates signal** with reasoning and market context
2. **Risk engine validates** position size, exposure, drawdown limits
3. **User explicitly confirms** via the frontend UI
4. **Broker executes** the validated, confirmed order

### Safety Constraints

- AI cannot access broker APIs directly
- Risk engine can reject signals that exceed limits
- All decisions are logged with full audit trail
- Position sizes are capped per user risk profile
- Maximum portfolio exposure is enforced (default 30%)

---

## Testing

### Quant Engine (Python — pytest)

```bash
cd apps/quant
source venv/bin/activate
pytest                          # Run all tests
pytest tests/ -v                # Verbose output
pytest tests/ -k "test_rsi"    # Run specific tests
```

### Backend API (NestJS — Jest)

```bash
pnpm --filter api test          # Run all API tests
pnpm --filter api test:watch    # Watch mode
pnpm --filter api test:cov      # Coverage report
```

### Frontend (Next.js — Vitest)

```bash
pnpm --filter web test          # Run all frontend tests
pnpm --filter web test:watch    # Watch mode
```

---

## Troubleshooting

### Database Connection Failed

```
Error: Can't reach database server at localhost:5432
```

**Fix**: Ensure PostgreSQL is running:
```bash
docker-compose up -d
docker ps   # verify profitterminal-db is healthy
```

### Prisma Client Not Generated

```
Error: @prisma/client did not initialize yet
```

**Fix**: Generate the client:
```bash
pnpm db:generate
```

### Quant Engine Won't Start

```
ModuleNotFoundError: No module named 'fastapi'
```

**Fix**: Activate the virtual environment and install dependencies:
```bash
cd apps/quant
source venv/bin/activate
pip install -r requirements.txt
```

### Port Already in Use

```
Error: listen EADDRINUSE :::4000
```

**Fix**: Kill the process using the port:
```bash
lsof -i :4000 | grep LISTEN
kill -9 <PID>
```

### Kite API Authentication Failed

**Fix**: Kite access tokens expire daily. Re-authenticate via the Kite login flow and update your `.env`.

### Ollama Not Responding

**Fix**: Ensure Ollama is installed and running:
```bash
ollama serve                    # Start Ollama server
ollama list                     # Verify models are available
```

### WebSocket Connection Drops

**Fix**: Check that the backend API is running on port 4000 and the frontend's `BACKEND_API_URL` matches.

---

## Architecture Overview — All 19 Phases

| Phase | Name | Description |
|-------|------|-------------|
| 1 | Project Foundation | Monorepo setup, pnpm workspaces, base configurations |
| 2 | Database Schema | PostgreSQL schema with Prisma — 40 models, full AI traceability |
| 3 | Quant Engine Core | Technical indicators (RSI, MACD, Bollinger, ATR, ADX, VWAP) |
| 4 | Market Data Integration | Kite Connect WebSocket + REST, real-time tick processing |
| 5 | Backend API Foundation | NestJS modules, controllers, services, WebSocket gateway |
| 6 | Frontend Dashboard | Next.js app shell, TradingView charts, real-time data display |
| 7 | Swing Scanner | Multi-timeframe swing trade candidate scoring and filtering |
| 8 | Options Scalper | Options Greeks, IV analysis, scalping signal generation |
| 9 | Trendline Engine | Automatic trendline detection, support/resistance levels |
| 10 | AI Integration | OpenAI/Ollama service, prompt management, conversation memory |
| 11 | Risk Engine | Position sizing, exposure limits, drawdown protection, kill switch |
| 12 | Paper Trading System | Virtual portfolio, trade simulation, P&L tracking |
| 13 | Trade Analysis | Performance metrics, win rate, Sharpe ratio, trade journal |
| 14 | Backtesting Framework | Historical strategy testing, walk-forward analysis |
| 15 | Trade Coach | AI-powered trade review, pattern recognition, improvement suggestions |
| 16 | Agent Architecture | Multi-agent system (Market Analyst, Risk Manager, Strategy Dev) |
| 17 | Agent Readiness | Autonomy stages, capability scoring, progression framework |
| 18 | Prompt Library | Versioned prompts, A/B testing, effectiveness tracking |
| 19 | Final Integration | README, navigation verification, system documentation |

---

## Project Structure

```
profitterminal/
├── apps/
│   ├── web/              # Next.js frontend (port 3000)
│   ├── api/              # NestJS backend API (port 4000)
│   └── quant/            # Python FastAPI quant engine (port 8000)
├── packages/
│   ├── types/            # Shared TypeScript type definitions
│   ├── indicators/       # Technical indicator library
│   ├── trading-engine/   # Trading logic and order management
│   ├── trendline-engine/ # Trendline detection algorithms
│   ├── risk-engine/      # Risk validation and position sizing
│   └── ai-engine/        # AI service abstraction layer
├── prisma/               # Database schema and migrations
├── docker-compose.yml    # PostgreSQL container
├── package.json          # Root workspace configuration
├── .env.example          # Environment variable template
└── README.md             # This file
```

### Frontend Pages

| Route | Page |
|-------|------|
| `/` | Dashboard — overview, market status, active signals |
| `/analysis` | Technical analysis with charting |
| `/swing` | Swing scanner — multi-factor candidate scoring |
| `/options-scalper` | Options scalping signals and Greeks |
| `/portfolio` | Portfolio positions and P&L |
| `/ai-trading` | AI trade assistant — natural language interface |
| `/paper-trading` | Paper trading dashboard |
| `/trade-analysis` | Trade performance analytics and journal |
| `/backtesting` | Strategy backtesting interface |
| `/trade-coach` | AI trade coaching and improvement |
| `/agents` | Multi-agent system dashboard |
| `/agent-readiness` | Agent autonomy progression tracker |
| `/prompts` | Prompt library management |

---

## Known Limitations

| Limitation | Detail |
|------------|--------|
| Market data requires Kite API keys | Without valid Kite Connect credentials, real-time data and historical candles won't load. Demo/mock data is used as fallback. |
| AI requires OpenAI key or Ollama | The AI reasoning layer needs either a paid OpenAI key or a locally running Ollama instance with a pulled model. |
| Session tokens expire daily | Kite and Kotak Neo tokens must be refreshed before each trading session. |
| AUTONOMOUS stage disabled in V1 | The agent readiness framework includes an AUTONOMOUS stage but it is deliberately disabled — all trades require human confirmation. |
| PostgreSQL required | The system relies on PostgreSQL; SQLite or other databases are not supported. |

---

## License

MIT

---

## Support

For issues and questions, please open a GitHub issue.
