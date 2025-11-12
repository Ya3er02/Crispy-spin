-- Users table
CREATE TABLE users (
    wallet VARCHAR(42) PRIMARY KEY,
    fid BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_fid ON users(fid);

-- Points table
CREATE TABLE points (
    wallet VARCHAR(42) PRIMARY KEY,
    total INTEGER DEFAULT 0,
    last_spin_at TIMESTAMP,
    FOREIGN KEY (wallet) REFERENCES users(wallet)
);

-- Spins table
CREATE TABLE spins (
    id SERIAL PRIMARY KEY,
    wallet VARCHAR(42) NOT NULL,
    ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reward_type VARCHAR(20) NOT NULL, -- 'nft', 'points', 'partner'
    reward_value TEXT NOT NULL,
    tx_hash VARCHAR(66),
    FOREIGN KEY (wallet) REFERENCES users(wallet)
);

CREATE INDEX idx_spins_wallet ON spins(wallet);
CREATE INDEX idx_spins_ts ON spins(ts);

-- Claims table
CREATE TABLE claims (
    id SERIAL PRIMARY KEY,
    wallet VARCHAR(42) NOT NULL,
    asset VARCHAR(42) NOT NULL,
    amount VARCHAR(100) NOT NULL,
    signature TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'claimed', 'expired'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    claimed_at TIMESTAMP,
    FOREIGN KEY (wallet) REFERENCES users(wallet)
);

CREATE INDEX idx_claims_wallet ON claims(wallet);
CREATE INDEX idx_claims_status ON claims(status);

-- Orders table (for Base Pay purchases)
CREATE TABLE orders (
    id VARCHAR(66) PRIMARY KEY, -- Transaction hash from Base Pay
    wallet VARCHAR(42) NOT NULL,
    sku VARCHAR(50) NOT NULL,
    amount_usdc DECIMAL(10, 2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'completed', 'failed'
    tx_hash VARCHAR(66),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    FOREIGN KEY (wallet) REFERENCES users(wallet)
);

CREATE INDEX idx_orders_wallet ON orders(wallet);
CREATE INDEX idx_orders_status ON orders(status);

-- Spin credits table (for paid spins)
CREATE TABLE spin_credits (
    wallet VARCHAR(42) PRIMARY KEY,
    credits INTEGER DEFAULT 0,
    FOREIGN KEY (wallet) REFERENCES users(wallet)
);

-- Farcaster quests table
CREATE TABLE farcaster_quests (
    id SERIAL PRIMARY KEY,
    wallet VARCHAR(42) NOT NULL,
    quest_type VARCHAR(50) NOT NULL, -- 'cast', 'recast', 'follow'
    quest_id VARCHAR(100) NOT NULL,
    completed BOOLEAN DEFAULT FALSE,
    verified_at TIMESTAMP,
    points_awarded INTEGER DEFAULT 0,
    FOREIGN KEY (wallet) REFERENCES users(wallet),
    UNIQUE(wallet, quest_type, quest_id)
);

CREATE INDEX idx_quests_wallet ON farcaster_quests(wallet);
