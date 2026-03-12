-- init.sql for Kamel System
-- This script creates a simple "users" table for testing.

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username TEXT NOT NULL,
    password TEXT NOT NULL
);

