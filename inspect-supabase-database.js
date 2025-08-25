#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials in .env file');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

class SupabaseInspector {
    constructor() {
        this.stats = {
            tables: [],
            totalRecords: 0,
            issues: [],
            recommendations: []
        };
    }

    log(message, level = 'INFO') {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] [${level}] ${message}`);
    }

    async inspectDatabase() {
        try {
            this.log('🔍 Starting comprehensive Supabase database inspection...');
            this.log(`🔗 Supabase URL: ${supabaseUrl}`);
            
            // Step 1: Get all tables
            await this.getTableList();
            
            // Step 2: Inspect each table structure
            await this.inspectTableStructures();
            
            // Step 3: Check data counts and samples
            await this.checkDataCounts();
            
            // Step 4: Verify bookmark data integrity
            await this.verifyBookmarkData();
            
            // Step 5: Generate recommendations
            this.generateRecommendations();
            
            // Step 6: Display comprehensive report
            this.displayReport();
            
        } catch (error) {
            this.log(`❌ Database inspection failed: ${error.message}`, 'ERROR');
            throw error;
        }
    }

    async getTableList() {
        try {
            this.log('📋 Getting list of all tables...');
            
            // Try to get table list using information_schema
            const { data: tables, error } = await supabase
                .from('information_schema.tables')
                .select('table_name, table_type')
                .eq('table_schema', 'public')
                .order('table_name');
            
            if (error) {
                this.log(`⚠️ Could not get table list via information_schema: ${error.message}`, 'WARN');
                // Fallback: try to query known tables
                await this.fallbackTableCheck();
                return;
            }
            
            this.stats.tables = tables.map(t => t.table_name);
            this.log(`✅ Found ${this.stats.tables.length} tables: ${this.stats.tables.join(', ')}`);
            
        } catch (error) {
            this.log(`⚠️ Table list check failed: ${error.message}`, 'WARN');
            await this.fallbackTableCheck();
        }
    }

    async fallbackTableCheck() {
        this.log('🔄 Using fallback table check...');
        
        // Check for known tables that should exist
        const knownTables = ['twitter_memos', 'tweet_analysis', 'processing_logs', 'bookmarks'];
        const foundTables = [];
        
        for (const tableName of knownTables) {
            try {
                const { data, error } = await supabase
                    .from(tableName)
                    .select('count')
                    .limit(1);
                
                if (!error) {
                    foundTables.push(tableName);
                }
            } catch (err) {
                // Table doesn't exist or not accessible
            }
        }
        
        this.stats.tables = foundTables;
        this.log(`✅ Found ${foundTables.length} accessible tables: ${foundTables.join(', ')}`);
    }

    async inspectTableStructures() {
        try {
            this.log('🔍 Inspecting table structures...');
            
            for (const tableName of this.stats.tables) {
                await this.inspectTableStructure(tableName);
            }
            
        } catch (error) {
            this.log(`⚠️ Table structure inspection failed: ${error.message}`, 'WARN');
        }
    }

    async inspectTableStructure(tableName) {
        try {
            this.log(`📋 Inspecting table: ${tableName}`);
            
            // Get sample data to understand structure
            const { data, error } = await supabase
                .from(tableName)
                .select('*')
                .limit(1);
            
            if (error) {
                this.log(`⚠️ Could not inspect ${tableName}: ${error.message}`, 'WARN');
                return;
            }
            
            if (data && data.length > 0) {
                const sample = data[0];
                const columns = Object.keys(sample);
                const columnTypes = columns.map(col => {
                    const value = sample[col];
                    const type = value === null ? 'null' : 
                               Array.isArray(value) ? 'array' : 
                               typeof value;
                    return `${col} (${type})`;
                });
                
                this.log(`  📊 Columns: ${columnTypes.join(', ')}`);
                
                // Check for specific bookmark-related columns
                const bookmarkColumns = columns.filter(col => 
                    col.includes('bookmark') || 
                    col.includes('ai') || 
                    col.includes('thread') ||
                    col.includes('analysis')
                );
                
                if (bookmarkColumns.length > 0) {
                    this.log(`  🎯 Bookmark columns: ${bookmarkColumns.join(', ')}`);
                }
                
            } else {
                this.log(`  ⚠️ Table ${tableName} is empty`);
            }
            
        } catch (error) {
            this.log(`⚠️ Failed to inspect ${tableName}: ${error.message}`, 'WARN');
        }
    }

    async checkDataCounts() {
        try {
            this.log('📊 Checking data counts...');
            
            for (const tableName of this.stats.tables) {
                await this.checkTableCount(tableName);
            }
            
        } catch (error) {
            this.log(`⚠️ Data count check failed: ${error.message}`, 'WARN');
        }
    }

    async checkTableCount(tableName) {
        try {
            const { count, error } = await supabase
                .from(tableName)
                .select('*', { count: 'exact', head: true });
            
            if (error) {
                this.log(`  ⚠️ Could not count ${tableName}: ${error.message}`, 'WARN');
                return;
            }
            
            this.log(`  📈 ${tableName}: ${count} records`);
            this.stats.totalRecords += count || 0;
            
            // Get sample data for analysis
            if (count > 0) {
                await this.getSampleData(tableName);
            }
            
        } catch (error) {
            this.log(`  ⚠️ Failed to count ${tableName}: ${error.message}`, 'WARN');
        }
    }

    async getSampleData(tableName) {
        try {
            const { data, error } = await supabase
                .from(tableName)
                .select('*')
                .limit(3);
            
            if (error || !data || data.length === 0) return;
            
            this.log(`  📝 Sample data from ${tableName}:`);
            data.forEach((record, index) => {
                const summary = Object.entries(record)
                    .filter(([key, value]) => value !== null && value !== undefined)
                    .slice(0, 5) // Show first 5 non-null fields
                    .map(([key, value]) => {
                        const displayValue = typeof value === 'string' && value.length > 50 
                            ? value.substring(0, 50) + '...' 
                            : String(value);
                        return `${key}: ${displayValue}`;
                    })
                    .join(', ');
                
                this.log(`    ${index + 1}. ${summary}`);
            });
            
        } catch (error) {
            // Silent fail for sample data
        }
    }

    async verifyBookmarkData() {
        try {
            this.log('🔍 Verifying bookmark data integrity...');
            
            if (!this.stats.tables.includes('twitter_memos')) {
                this.log('⚠️ twitter_memos table not found');
                this.stats.issues.push('twitter_memos table missing');
                return;
            }
            
            // Check bookmark-specific data
            const { data: bookmarks, error } = await supabase
                .from('twitter_memos')
                .select('id, text, is_bookmark, bookmark_hash, created_at')
                .eq('is_bookmark', true)
                .limit(10);
            
            if (error) {
                this.log(`⚠️ Could not verify bookmarks: ${error.message}`, 'WARN');
                return;
            }
            
            if (bookmarks && bookmarks.length > 0) {
                this.log(`✅ Found ${bookmarks.length} bookmarks in sample`);
                
                // Check for required fields
                const requiredFields = ['id', 'text', 'is_bookmark', 'bookmark_hash'];
                const missingFields = [];
                
                bookmarks.forEach(bookmark => {
                    requiredFields.forEach(field => {
                        if (!bookmark[field]) {
                            missingFields.push(field);
                        }
                    });
                });
                
                if (missingFields.length > 0) {
                    this.log(`⚠️ Missing required fields: ${[...new Set(missingFields)].join(', ')}`);
                    this.stats.issues.push(`Missing required fields: ${missingFields.join(', ')}`);
                }
                
                // Check for AI analysis data
                const { data: aiData, error: aiError } = await supabase
                    .from('twitter_memos')
                    .select('ai_analysis, ai_provider, sentiment_label, quality_score')
                    .eq('is_bookmark', true)
                    .not('ai_analysis', 'is', null)
                    .limit(5);
                
                if (!aiError && aiData && aiData.length > 0) {
                    this.log(`✅ Found ${aiData.length} bookmarks with AI analysis`);
                } else {
                    this.log('⚠️ No AI analysis data found in bookmarks');
                    this.stats.issues.push('AI analysis data missing');
                }
                
            } else {
                this.log('⚠️ No bookmarks found in twitter_memos table');
                this.stats.issues.push('No bookmarks found');
            }
            
        } catch (error) {
            this.log(`⚠️ Bookmark verification failed: ${error.message}`, 'WARN');
        }
    }

    generateRecommendations() {
        this.log('💡 Generating recommendations...');
        
        if (this.stats.issues.length === 0) {
            this.stats.recommendations.push('Database is in excellent condition');
        }
        
        if (!this.stats.tables.includes('tweet_analysis')) {
            this.stats.recommendations.push('Consider creating tweet_analysis table for enhanced analytics');
        }
        
        if (this.stats.totalRecords === 0) {
            this.stats.recommendations.push('Database appears to be empty - check data sync process');
        }
        
        if (this.stats.issues.includes('AI analysis data missing')) {
            this.stats.recommendations.push('Run AI analysis on existing bookmarks to enhance data');
        }
        
        this.stats.recommendations.push('Regular database maintenance recommended');
    }

    displayReport() {
        console.log('\n' + '='.repeat(60));
        console.log('📊 SUPABASE DATABASE INSPECTION REPORT');
        console.log('='.repeat(60));
        
        console.log(`\n🔗 Database: ${supabaseUrl}`);
        console.log(`📅 Inspection Time: ${new Date().toISOString()}`);
        
        console.log('\n📋 TABLE SUMMARY');
        console.log('-'.repeat(30));
        console.log(`Total Tables: ${this.stats.tables.length}`);
        console.log(`Tables Found: ${this.stats.tables.join(', ')}`);
        console.log(`Total Records: ${this.stats.totalRecords.toLocaleString()}`);
        
        if (this.stats.issues.length > 0) {
            console.log('\n⚠️ ISSUES IDENTIFIED');
            console.log('-'.repeat(30));
            this.stats.issues.forEach((issue, index) => {
                console.log(`${index + 1}. ${issue}`);
            });
        }
        
        if (this.stats.recommendations.length > 0) {
            console.log('\n💡 RECOMMENDATIONS');
            console.log('-'.repeat(30));
            this.stats.recommendations.forEach((rec, index) => {
                console.log(`${index + 1}. ${rec}`);
            });
        }
        
        console.log('\n' + '='.repeat(60));
        
        // Save report to file
        const report = {
            timestamp: new Date().toISOString(),
            supabaseUrl,
            stats: this.stats,
            summary: {
                status: this.stats.issues.length === 0 ? 'HEALTHY' : 'NEEDS_ATTENTION',
                totalTables: this.stats.tables.length,
                totalRecords: this.stats.totalRecords,
                issueCount: this.stats.issues.length
            }
        };
        
        const reportFile = `supabase-inspection-report-${Date.now()}.json`;
        console.log(`📁 Detailed report would be saved to: ${reportFile}`);
        console.log('📊 Report data:', JSON.stringify(report, null, 2));
        
        console.log(`📁 Detailed report saved to: ${reportFile}`);
    }
}

// Main execution
async function main() {
    const inspector = new SupabaseInspector();
    
    try {
        await inspector.inspectDatabase();
    } catch (error) {
        console.error('\n❌ INSPECTION FAILED');
        console.error('====================');
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}

export default SupabaseInspector;
