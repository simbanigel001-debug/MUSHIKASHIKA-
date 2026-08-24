-- Rank Marshal Dispatch Clearances Table
CREATE TABLE IF NOT EXISTS rank_clearances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_id UUID NOT NULL,
    marshal_id UUID NOT NULL,
    rank_id UUID NOT NULL REFERENCES bus_ranks(id),
    vehicle_reg VARCHAR(20) NOT NULL,
    declared_headcount INTEGER NOT NULL,
    verified_headcount INTEGER NOT NULL,
    discrepancy INTEGER NOT NULL, -- (verified - declared)
    cleared_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for searching clearance logs by rank and time
CREATE INDEX IF NOT EXISTS idx_rank_clearances_rank_time ON rank_clearances(rank_id, cleared_at);
CREATE INDEX IF NOT EXISTS idx_rank_clearances_shift ON rank_clearances(shift_id);
