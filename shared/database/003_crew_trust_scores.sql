CREATE TABLE trust_scores (
    crew_id VARCHAR(50) PRIMARY KEY,
    score INT CHECK (score BETWEEN 0 AND 100),
    updated_at TIMESTAMP DEFAULT NOW()
);
