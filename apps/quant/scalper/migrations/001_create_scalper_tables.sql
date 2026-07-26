-- Migration: 001_create_scalper_tables
-- Description: Create analysis_history and scalper_configuration tables for Options Scalping Agent
-- Phase: 9 - Options Scalping AI Agent
-- Requirements: 20.1, 20.2, 30.1, 30.2, 30.3, 30.4, 30.5, 30.6

-- Create analysis_history table for storing scalper analysis results
CREATE TABLE IF NOT EXISTS analysis_history (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    underlying VARCHAR(10) NOT NULL CHECK (underlying IN ('NIFTY', 'BANKNIFTY')),
    signal_type VARCHAR(10) NOT NULL CHECK (signal_type IN ('BUY CE', 'BUY PE', 'HOLD')),
    probability DECIMAL(5, 2) NOT NULL CHECK (probability >= 0 AND probability <= 100),
    risk_reward_ratio DECIMAL(6, 2) NOT NULL CHECK (risk_reward_ratio >= 0),

    -- Trade details (nullable for HOLD signals)
    strike_price DECIMAL(12, 2),
    expiry_date DATE,
    entry_price DECIMAL(12, 2),
    target_price DECIMAL(12, 2),
    stop_loss DECIMAL(12, 2),
    lot_size INTEGER,

    -- Market metrics
    spot_price DECIMAL(12, 2) NOT NULL,
    trend VARCHAR(10) NOT NULL CHECK (trend IN ('Bullish', 'Bearish', 'Neutral')),
    oi_interpretation VARCHAR(10) NOT NULL CHECK (oi_interpretation IN ('Bullish', 'Bearish', 'Neutral')),
    pcr DECIMAL(8, 4) NOT NULL,
    trendline_status VARCHAR(10) NOT NULL CHECK (trendline_status IN ('Bullish', 'Bearish', 'Neutral')),
    support_level DECIMAL(12, 2),
    resistance_level DECIMAL(12, 2),

    -- Technical indicators
    rsi DECIMAL(6, 2) NOT NULL,
    macd DECIMAL(12, 4) NOT NULL,
    macd_signal DECIMAL(12, 4) NOT NULL,
    vwap DECIMAL(12, 2) NOT NULL,
    ema_5 DECIMAL(12, 2) NOT NULL,
    ema_15 DECIMAL(12, 2) NOT NULL,
    atr DECIMAL(12, 4) NOT NULL,
    volume_ratio DECIMAL(8, 4) NOT NULL,

    -- Options metrics
    call_oi BIGINT NOT NULL,
    put_oi BIGINT NOT NULL,
    call_oi_change BIGINT NOT NULL,
    put_oi_change BIGINT NOT NULL,
    atm_iv DECIMAL(8, 4),

    -- AI rationale
    rationale TEXT NOT NULL,

    -- Metadata
    hold_reason VARCHAR(50)
);

-- Create indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_analysis_history_timestamp ON analysis_history (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_analysis_history_underlying ON analysis_history (underlying);
CREATE INDEX IF NOT EXISTS idx_analysis_history_signal_type ON analysis_history (signal_type);
CREATE INDEX IF NOT EXISTS idx_analysis_history_underlying_timestamp ON analysis_history (underlying, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_analysis_history_filter ON analysis_history (underlying, signal_type, timestamp DESC);

-- Create scalper_configuration table for user settings
CREATE TABLE IF NOT EXISTS scalper_configuration (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL UNIQUE,
    refresh_interval INTEGER NOT NULL DEFAULT 60 CHECK (refresh_interval >= 30 AND refresh_interval <= 300),
    probability_threshold DECIMAL(5, 2) NOT NULL DEFAULT 70.0 CHECK (probability_threshold >= 50 AND probability_threshold <= 90),
    risk_reward_threshold DECIMAL(4, 2) NOT NULL DEFAULT 2.0 CHECK (risk_reward_threshold >= 1.0 AND risk_reward_threshold <= 5.0),
    max_spread_percentage DECIMAL(5, 2) NOT NULL DEFAULT 5.0 CHECK (max_spread_percentage >= 1 AND max_spread_percentage <= 10),
    min_open_interest INTEGER NOT NULL DEFAULT 1000 CHECK (min_open_interest >= 100 AND min_open_interest <= 10000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index on user_id for fast lookup
CREATE INDEX IF NOT EXISTS idx_scalper_configuration_user_id ON scalper_configuration (user_id);

-- Add comment descriptions for documentation
COMMENT ON TABLE analysis_history IS 'Stores options scalping analysis results for history tracking and performance review';
COMMENT ON TABLE scalper_configuration IS 'Stores per-user configuration for the options scalping agent';

COMMENT ON COLUMN analysis_history.underlying IS 'Underlying index: NIFTY or BANKNIFTY';
COMMENT ON COLUMN analysis_history.signal_type IS 'Generated signal: BUY CE, BUY PE, or HOLD';
COMMENT ON COLUMN analysis_history.probability IS 'AI confidence percentage (0-100)';
COMMENT ON COLUMN analysis_history.risk_reward_ratio IS 'Risk/reward ratio (e.g., 2.5 for 1:2.5)';
COMMENT ON COLUMN analysis_history.pcr IS 'Put-Call Ratio at time of analysis';
COMMENT ON COLUMN analysis_history.atm_iv IS 'At-The-Money implied volatility';
COMMENT ON COLUMN analysis_history.rationale IS 'AI-generated explanation (100-300 words)';
COMMENT ON COLUMN analysis_history.hold_reason IS 'Reason for HOLD signal (e.g., Stale Data, Low Probability)';

COMMENT ON COLUMN scalper_configuration.refresh_interval IS 'Auto-refresh interval in seconds (30-300)';
COMMENT ON COLUMN scalper_configuration.probability_threshold IS 'Minimum probability % for BUY signal (50-90)';
COMMENT ON COLUMN scalper_configuration.risk_reward_threshold IS 'Minimum R:R ratio for BUY signal (1.0-5.0)';
COMMENT ON COLUMN scalper_configuration.max_spread_percentage IS 'Maximum allowed bid-ask spread % (1-10)';
COMMENT ON COLUMN scalper_configuration.min_open_interest IS 'Minimum OI for contract selection (100-10000)';
