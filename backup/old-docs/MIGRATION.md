# X.com Bookmarks Migration Guide

This guide explains how to migrate your existing X.com bookmarks to the new consolidated schema.

## Prerequisites

1. Node.js 16+ installed
2. PostgreSQL client tools (psql) installed (for troubleshooting)
3. Access to your Supabase database

## Environment Setup

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Update the `.env` file with your Supabase database connection details:
   ```env
   # Option 1: Use connection string (recommended)
   DATABASE_URL=postgresql://postgres:your_password@db.your-project-ref.supabase.co:5432/postgres

   # Option 2: Use individual parameters
   # SUPABASE_DB_USER=postgres
   # SUPABASE_DB_PASSWORD=your_password
   # SUPABASE_DB_HOST=db.your-project-ref.supabase.co
   # SUPABASE_DB_PORT=5432
   # SUPABASE_DB_NAME=postgres
   
   # Required for SSL
   PGSSLMODE=require
   ```

## Running the Migration

1. Install dependencies:
   ```bash
   npm install pg
   ```

2. Run the migration script:
   ```bash
   node migrate-to-consolidated-schema.js
   ```

3. The script will:
   - Run all database migrations
   - Migrate existing bookmarks from `bookmarks.json`
   - Show progress and any errors

## Troubleshooting

### Common Issues

1. **Connection Refused**
   - Verify your database host and port
   - Check if your IP is allowed in Supabase's database settings

2. **Authentication Failed**
   - Double-check your database username and password
   - Ensure you're using the correct database name

3. **SSL Errors**
   - Make sure `PGSSLMODE=require` is set in your `.env` file
   - For local development, you might need to set `PGSSLMODE=prefer`

4. **Missing Dependencies**
   - Run `npm install pg` to install the PostgreSQL client

### Manual Migration

If the automated migration fails, you can run the SQL migrations manually:

1. Connect to your Supabase database using psql or a database client
2. Run the SQL files in the `migrations` directory in order

## Rollback

To rollback the migration:

1. Connect to your database
2. Drop the affected tables
3. Remove entries from the `_migrations` table

## Support

For issues not covered in this guide, please open an issue in the repository.
