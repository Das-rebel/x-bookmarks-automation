#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ProjectCleanup {
    constructor() {
        this.backupDir = path.join(__dirname, 'backup');
        this.deprecatedDir = path.join(this.backupDir, 'deprecated-files');
        this.oldDataDir = path.join(this.backupDir, 'old-data');
        this.oldDocsDir = path.join(this.backupDir, 'old-docs');
        this.oldConfigsDir = path.join(this.backupDir, 'old-configs');
        
        this.filesToMove = {
            deprecated: [
                'github-actions-scraper.cjs',
                'direct-scraper.cjs',
                'openai_wrapper.py',
                'cli_ai',
                'debug_openai_client.py',
                'debug_openai.py',
                'verify_openai_key.py',
                'direct_kimi_k2.py',
                'kimi_k2_client.py',
                'direct_moonshot.py',
                'moonshot_client.py',
                'run_model.py',
                'haiku_openrouter.py',
                'requirements-db.txt',
                'cline_wrapper.sh'
            ],
            oldDocs: [
                'MANUAL_EXTRACTION_GUIDE.md',
                'FUTURE_AUTOMATION_FIX_PLAN.md',
                'url-configuration-fix-summary.md',
                'TEST-SUITE-SUMMARY.md',
                'MIGRATION.md'
            ],
            oldConfigs: [
                'chatgpt-action-config.json',
                'claude_desktop_config.json',
                'chatgpt-agent-openapi.json',
                'chatgpt-agent-setup-guide.md',
                'chatgpt-thread-enhanced-config.json'
            ]
        };
        
        this.dirsToMove = [
            'test',
            'testsprite_tests',
            'python'
        ];
    }
    
    async createBackupDirectories() {
        console.log('📁 Creating backup directory structure...');
        
        const dirs = [this.backupDir, this.deprecatedDir, this.oldDataDir, this.oldDocsDir, this.oldConfigsDir];
        
        for (const dir of dirs) {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
                console.log(`✅ Created: ${dir}`);
            }
        }
    }
    
    async moveFiles() {
        console.log('\n📦 Moving deprecated files to backup...');
        
        for (const [category, files] of Object.entries(this.filesToMove)) {
            const targetDir = this[`${category}Dir`];
            
            for (const file of files) {
                const sourcePath = path.join(__dirname, file);
                const targetPath = path.join(targetDir, file);
                
                if (fs.existsSync(sourcePath)) {
                    try {
                        fs.renameSync(sourcePath, targetPath);
                        console.log(`✅ Moved: ${file} → ${category}/`);
                    } catch (error) {
                        console.log(`❌ Failed to move ${file}: ${error.message}`);
                    }
                } else {
                    console.log(`⚠️  File not found: ${file}`);
                }
            }
        }
    }
    
    async moveDirectories() {
        console.log('\n📁 Moving deprecated directories...');
        
        for (const dir of this.dirsToMove) {
            const sourcePath = path.join(__dirname, dir);
            const targetPath = path.join(this.deprecatedDir, dir);
            
            if (fs.existsSync(sourcePath)) {
                try {
                    fs.renameSync(sourcePath, targetPath);
                    console.log(`✅ Moved directory: ${dir} → deprecated-files/`);
                } catch (error) {
                    console.log(`❌ Failed to move directory ${dir}: ${error.message}`);
                }
            }
        }
    }
    
    async moveOldData() {
        console.log('\n📊 Moving old data files...');
        
        const dataPatterns = [
            'bookmarks-backup-*',
            'processed-bookmarks-*',
            'bookmarks-data-*.json',
            'processing-final-summary-*.json',
            'local-database-save-summary-*.json',
            'supabase-sync-summary-*.json'
        ];
        
        const files = fs.readdirSync(__dirname);
        
        for (const file of files) {
            for (const pattern of dataPatterns) {
                if (this.matchesPattern(file, pattern)) {
                    const sourcePath = path.join(__dirname, file);
                    const targetPath = path.join(this.oldDataDir, file);
                    
                    try {
                        fs.renameSync(sourcePath, targetPath);
                        console.log(`✅ Moved data: ${file} → old-data/`);
                        break;
                    } catch (error) {
                        console.log(`❌ Failed to move ${file}: ${error.message}`);
                    }
                }
            }
        }
    }
    
    matchesPattern(filename, pattern) {
        const regex = pattern.replace(/\*/g, '.*');
        return new RegExp(regex).test(filename);
    }
    
    async createOptimizedStructure() {
        console.log('\n🏗️  Creating optimized project structure...');
        
        const optimizedDirs = [
            'src',
            'src/scrapers',
            'src/processors',
            'src/database',
            'src/api',
            'src/utils',
            'config',
            'scripts',
            'logs'
        ];
        
        for (const dir of optimizedDirs) {
            const fullPath = path.join(__dirname, dir);
            if (!fs.existsSync(fullPath)) {
                fs.mkdirSync(fullPath, { recursive: true });
                console.log(`✅ Created: ${dir}`);
            }
        }
    }
    
    async generateCleanupReport() {
        console.log('\n📊 Generating cleanup report...');
        
        const report = {
            timestamp: new Date().toISOString(),
            backupDirectories: {
                deprecated: this.deprecatedDir,
                oldData: this.oldDataDir,
                oldDocs: this.oldDocsDir,
                oldConfigs: this.oldConfigsDir
            },
            filesMoved: this.filesToMove,
            directoriesMoved: this.dirsToMove,
            optimization: {
                newStructure: [
                    'src/scrapers - Core scraping logic',
                    'src/processors - Bookmark processing',
                    'src/database - Database operations',
                    'src/api - API endpoints',
                    'src/utils - Utility functions',
                    'config - Configuration files',
                    'scripts - Automation scripts',
                    'logs - System logs'
                ]
            }
        };
        
        const reportPath = path.join(__dirname, 'cleanup-report.json');
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        console.log(`✅ Cleanup report saved: cleanup-report.json`);
        
        return report;
    }
    
    async run() {
        try {
            console.log('🧹 Starting Project Cleanup and Optimization...\n');
            
            await this.createBackupDirectories();
            await this.moveFiles();
            await this.moveDirectories();
            await this.moveOldData();
            await this.createOptimizedStructure();
            const report = await this.generateCleanupReport();
            
            console.log('\n🎉 Cleanup and optimization completed successfully!');
            console.log('\n📊 Summary:');
            console.log(`- Backup directories created: ${Object.keys(report.backupDirectories).length}`);
            console.log(`- Files moved: ${Object.keys(report.filesMoved).reduce((sum, key) => sum + report.filesMoved[key].length, 0)}`);
            console.log(`- Directories moved: ${report.directoriesMoved.length}`);
            console.log(`- New structure created: ${report.optimization.newStructure.length} directories`);
            
        } catch (error) {
            console.error('❌ Cleanup failed:', error.message);
            process.exit(1);
        }
    }
}

// Run cleanup if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const cleanup = new ProjectCleanup();
    cleanup.run();
}

export default ProjectCleanup;
