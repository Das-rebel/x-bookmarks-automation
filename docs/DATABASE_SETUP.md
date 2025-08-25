# Database Setup and Verification

This document outlines the steps to set up and verify the database for the Twitter Bookmarks Automation project.

## Prerequisites

1. Python 3.8+
2. Supabase project with database access
3. Environment variables set in `.env` file

## Setup

1. Install required Python packages:
   ```bash
   pip install -r requirements-db.txt
   ```

2. Create a `.env` file in the project root with your Supabase credentials:
   ```env
   SUPABASE_URL=your_supabase_url
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   ```

## Running Database Verification

To verify the database connection and schema, run:

```bash
python3 scripts/verify_database.py
```

This script will:
1. Verify database connection
2. Check required tables and columns
3. Verify all migrations have been applied

## Expected Output

```
🔍 Starting database verification...
🔌 Connecting to database...
✅ Connected to database (Server: PostgreSQL 14.x on x86_64-pc-linux-musl, compiled by gcc (Alpine 10.3.1_git20210424) 10.3.1 20210424, 64-bit)

🔍 Verifying database schema...
✅ Found 'bookmarks' table
✅ All required columns exist: id, content, source, created_at, metadata

🔍 Checking migrations...
Found 5 migration files
✅ All migrations have been applied

✨ Database verification completed successfully!
```

## Troubleshooting

1. **Connection Errors**:
   - Verify `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are correct
   - Check your internet connection and VPN settings
   - Ensure your IP is whitelisted in Supabase

2. **Missing Tables/Columns**:
   - Run database migrations: `npm run migrate`
   - Check the migrations directory for pending migrations

3. **Permission Issues**:
   - Ensure the service role key has sufficient permissions
   - Check RLS (Row Level Security) policies if applicable
