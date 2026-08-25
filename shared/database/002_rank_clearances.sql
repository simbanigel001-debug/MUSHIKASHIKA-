CREATE TABLE rank_clearances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shift_id UUID REFERENCES shifts(id),
    marshal_id VARCHAR(50) NOT NULL,
    token_signature TEXT NOT NULL,
    cleared_at TIMESTAMP DEFAULT NOW()
);
