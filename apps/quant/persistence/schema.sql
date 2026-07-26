-- Quant Engine Key-Value Store Schema
-- Single table for all module data stored as JSONB
-- Partitioned by module name for logical separation

CREATE TABLE IF NOT EXISTS quant_kv_store (
    module TEXT NOT NULL,
    key TEXT NOT NULL,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    PRIMARY KEY (module, key)
);

-- Index for fast module-level queries
CREATE INDEX IF NOT EXISTS idx_quant_kv_store_module
    ON quant_kv_store (module);

-- Index for JSONB content queries (GIN index)
CREATE INDEX IF NOT EXISTS idx_quant_kv_store_data
    ON quant_kv_store USING GIN (data);

-- Trigger to auto-update updated_at on row changes
CREATE OR REPLACE FUNCTION update_quant_kv_store_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_quant_kv_store_updated_at ON quant_kv_store;
CREATE TRIGGER trg_quant_kv_store_updated_at
    BEFORE UPDATE ON quant_kv_store
    FOR EACH ROW
    EXECUTE FUNCTION update_quant_kv_store_updated_at();

-- Comments for documentation
COMMENT ON TABLE quant_kv_store IS 'Key-value store for all quant engine modules. Each module stores its state as JSONB.';
COMMENT ON COLUMN quant_kv_store.module IS 'Module identifier (e.g., trading_lab_sessions, trade_analysis_trades)';
COMMENT ON COLUMN quant_kv_store.key IS 'Storage key within the module (e.g., user_id, entity_id)';
COMMENT ON COLUMN quant_kv_store.data IS 'JSONB payload containing the module data';
