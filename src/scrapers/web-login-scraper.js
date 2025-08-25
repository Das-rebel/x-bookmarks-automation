#!/usr/bin/env node

import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Check if OpenAI is available
const OPENAI_ENABLED = process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== '';

class WebLoginScraper {
    constructor() {
        this.browser = null;
        this.page = null;
        this.startTime = Date.now();
        this.logs = [];
        this.screenshots = [];
        this.sessionId = Date.now().toString();
        
        // Configuration - ULTRA-FAST EXTENDED SCRAPING (10x faster)
        this.config = {
            headless: false,
            maxBookmarks: 100000, // Extract ALL bookmarks
            timeout: 3000000, // 50 minutes (30 min + 20 min buffer)
            retryAttempts: 5, // Increased retry attempts
            scrollDelay: 200, // Reduced from 2000ms to 200ms (10x faster)
            maxScrollAttempts: 2000, // Much higher for extended runs
            maxConsecutiveEmptyScrolls: 30, // More tolerance for empty scrolls
            progressUpdateInterval: 100, // Update progress every 100 bookmarks
            fastScrollMode: true, // Enable fast scrolling
            batchSize: 50 // Process bookmarks in larger batches
        };
        
        this.log('🚀 Web Login Scraper initialized');
        this.logEnvironmentStatus();
    }
    
    logEnvironmentStatus() {
        this.log('📋 Environment Status:');
        this.log(`   Supabase URL: ${supabaseUrl ? '✅ Set' : '❌ Missing'}`);
        this.log(`   Supabase Key: ${supabaseKey ? '✅ Set' : '❌ Missing'}`);
        this.log(`   OpenAI API: ${OPENAI_ENABLED ? '✅ Available' : '❌ Not available'}`);
        this.log(`   X Username: ${process.env.X_USERNAME ? '✅ Set' : '❌ Missing'}`);
        this.log(`   X Password: ${process.env.X_PASSWORD ? '✅ Set' : '❌ Missing'}`);
    }

    log(message, data = null) {
        const timestamp = new Date().toISOString();
        const logEntry = { timestamp, message, data };
        this.logs.push(logEntry);
        console.log(`[${timestamp}] ${message}`, data || '');
    }
    
    async takeScreenshot(name) {
        try {
            const filename = `web-scraper-${name}-${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
            const filepath = path.join(process.cwd(), 'src', 'scrapers', filename);
            await this.page.screenshot({ path: filepath, fullPage: true });
                this.screenshots.push(filepath);
            this.log(`📸 Screenshot saved: ${filename}`);
                return filepath;
        } catch (error) {
            this.log(`❌ Failed to take screenshot: ${error.message}`);
            return null;
        }
    }

    async initialize() {
        try {
            this.log('🌐 Initializing browser...');
            this.browser = await puppeteer.launch({
                headless: this.config.headless,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--disable-gpu',
                    '--disable-web-security',
                    '--disable-features=VizDisplayCompositor',
                    '--disable-background-timer-throttling',
                    '--disable-backgrounding-occluded-windows',
                    '--disable-renderer-backgrounding',
                    '--disable-ipc-flooding-protection'
                ]
            });
            
            this.page = await this.browser.newPage();
            await this.page.setViewport({ width: 1280, height: 800 });
            await this.page.setDefaultTimeout(this.config.timeout);
            
            // Performance optimizations for faster scraping
            await this.page.setRequestInterception(true);
            this.page.on('request', (req) => {
                // Block unnecessary resources for faster loading
                if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) {
                    req.abort();
                } else {
                    req.continue();
                }
            });
            
            // Enable fast navigation
            await this.page.setCacheEnabled(true);
            
            this.log('✅ Browser initialized successfully');
            return true;
        } catch (error) {
            this.log(`❌ Failed to initialize browser: ${error.message}`);
            return false;
        }
    }
    
    async handleManualLogin() {
        try {
            this.log('🔐 Starting manual login process...');
            
            // Navigate to Twitter login page
            await this.page.goto('https://twitter.com/login', { waitUntil: 'networkidle2' });
            await this.takeScreenshot('login-page');
            
            // Wait for username field and enter username
            this.log('👤 Entering username...');
            await this.page.waitForSelector('input[autocomplete="username"]', { timeout: 10000 });
            await this.page.type('input[autocomplete="username"]', 'Dasrebel');
            
            // Click Next button
            this.log('➡️ Clicking Next button...');
            
            // First, let's see what buttons are available
            const availableButtons = await this.page.evaluate(() => {
                const buttons = Array.from(document.querySelectorAll('div[role="button"], button'));
                return buttons.map(btn => ({
                    text: btn.textContent?.trim(),
                    tagName: btn.tagName,
                    role: btn.getAttribute('role'),
                    'data-testid': btn.getAttribute('data-testid'),
                    visible: btn.offsetParent !== null
                }));
            });
            
            this.log('🔍 Available buttons:', JSON.stringify(availableButtons, null, 2));
            
            // Try to find and click the Next button
            const nextButtonClicked = await this.page.evaluate(() => {
                const buttons = Array.from(document.querySelectorAll('div[role="button"], button'));
                const nextButton = buttons.find(btn => 
                    btn.textContent?.trim() === 'Next' || 
                    btn.textContent?.trim() === 'next' ||
                    btn.textContent?.trim().toLowerCase().includes('next')
                );
                
                if (nextButton) {
                    nextButton.click();
                    return true;
                }
                
                // Try alternative selectors
                const alternativeNext = document.querySelector('[data-testid="auth_next_button"]') || 
                                      document.querySelector('input[type="submit"]') ||
                                      document.querySelector('button[type="submit"]');
                
                if (alternativeNext) {
                    alternativeNext.click();
                    return true;
                }
                
                return false;
            });
            
            if (!nextButtonClicked) {
                throw new Error('Next button not found - no suitable button to proceed');
            }
            
            // Wait for page to update after clicking Next
            this.log('⏳ Waiting for page to update after clicking Next...');
            await new Promise(resolve => setTimeout(resolve, 8000)); // Increased wait time
            
            // Check if Twitter is asking for verification due to unusual activity
            const hasVerificationStep = await this.page.evaluate(() => {
                const divs = Array.from(document.querySelectorAll('div'));
                return divs.some(div => 
                    div.textContent && (
                        div.textContent.toLowerCase().includes('verification') ||
                        div.textContent.toLowerCase().includes('confirm') ||
                        div.textContent.toLowerCase().includes('check') ||
                        div.textContent.toLowerCase().includes('code') ||
                        div.textContent.toLowerCase().includes('unusual login activity') ||
                        div.textContent.toLowerCase().includes('help keep') ||
                        div.textContent.toLowerCase().includes('enter your phone number or username')
                    )
                );
            });
            
                        if (hasVerificationStep) {
                this.log('🔐 Verification step detected - Twitter is asking for additional verification');
                this.log('📱 This usually requires phone/email verification or CAPTCHA');
                this.log('⏳ Waiting for verification page to load...');
                
                // Wait for verification page to load
                await new Promise(resolve => setTimeout(resolve, 5000));
                
                // Check if we're now on a verification page
                const verificationElements = await this.page.evaluate(() => {
                    const inputs = Array.from(document.querySelectorAll('input'));
                    const buttons = Array.from(document.querySelectorAll('button, div[role="button"]'));
                    const divs = Array.from(document.querySelectorAll('div'));
                
                return {
                        inputs: inputs.map(input => ({
                            type: input.type,
                            placeholder: input.placeholder,
                            name: input.name,
                            id: input.id,
                            'data-testid': input.getAttribute('data-testid'),
                            visible: input.offsetParent !== null
                        })),
                        buttons: buttons.map(btn => ({
                            text: btn.textContent?.trim(),
                            'data-testid': btn.getAttribute('data-testid'),
                            visible: btn.offsetParent !== null
                        })).slice(0, 10),
                        divs: divs.filter(div => div.textContent && div.textContent.length > 10).map(div => ({
                            text: div.textContent?.trim().substring(0, 100),
                            'data-testid': div.getAttribute('data-testid'),
                            visible: div.offsetParent !== null
                        })).slice(0, 5)
                    };
                });
                
                this.log('📋 Verification page elements:', JSON.stringify(verificationElements, null, 2));
                
                // Look for verification input fields
                const verificationInput = verificationElements.inputs.find(input => 
                    input.visible && (
                        input.placeholder?.toLowerCase().includes('code') ||
                        input.placeholder?.toLowerCase().includes('verification') ||
                        input.placeholder?.toLowerCase().includes('phone') ||
                        input.placeholder?.toLowerCase().includes('email') ||
                        input['data-testid']?.includes('ocfEnterTextTextInput')
                    )
                );
                
                if (verificationInput) {
                    this.log(`🔑 Found verification input: ${JSON.stringify(verificationInput)}`);
                    
                                        // AUTOMATIC VERIFICATION: Enter email/phone automatically
                    if (verificationInput['data-testid'] === 'ocfEnterTextTextInput') {
                        this.log('📧 Automatically entering email for verification...');
                        
                        try {
                            // Wait for the input field to be ready
                            await this.page.waitForSelector('[data-testid="ocfEnterTextTextInput"]', { timeout: 10000, visible: true });
                            
                            // Clear the field first and enter email ONCE
                            await this.page.click('[data-testid="ocfEnterTextTextInput"]');
                            await this.page.keyboard.down('Control');
                            await this.page.keyboard.press('a');
                            await this.page.keyboard.up('Control');
                            await this.page.type('[data-testid="ocfEnterTextTextInput"]', process.env.X_USERNAME);
                            this.log(`✅ Entered email: ${process.env.X_USERNAME}`);
                            
                            // Wait a moment for the input to register
                            await new Promise(resolve => setTimeout(resolve, 2000));
                            
                            // Click the Next button ONCE
                            this.log('➡️ Clicking Next button on verification page...');
                            await this.page.click('[data-testid="ocfEnterTextNextButton"]');
                            
                            this.log('⏳ Waiting for next verification screen to load...');
                            await new Promise(resolve => setTimeout(resolve, 3000));
                            
                            // Check what's on the next screen
                            this.log('🔍 Checking next verification screen...');
                            const nextScreenState = await this.page.evaluate(() => {
                                const inputs = Array.from(document.querySelectorAll('input'));
                                const buttons = Array.from(document.querySelectorAll('button, div[role="button"]'));
                                const divs = Array.from(document.querySelectorAll('div'));
                                
                                return {
                                    inputs: inputs.map(input => ({
                                        type: input.type,
                                        placeholder: input.placeholder,
                                        name: input.name,
                                        id: input.id,
                                        'data-testid': input.getAttribute('data-testid'),
                                        visible: input.offsetParent !== null
                                    })),
                                    buttons: buttons.map(btn => ({
                                        text: btn.textContent?.trim(),
                                        'data-testid': btn.getAttribute('data-testid'),
                                        visible: btn.offsetParent !== null
                                    })).slice(0, 10),
                                    divs: divs.filter(div => div.textContent && div.textContent.length > 10).map(div => ({
                                        text: div.textContent?.trim().substring(0, 100),
                                        'data-testid': div.getAttribute('data-testid'),
                                        visible: div.offsetParent !== null
                                    })).slice(0, 5)
                                };
                            });
                            
                            this.log('📋 Next screen elements:', JSON.stringify(nextScreenState, null, 2));
                            
                            // Look for username input field on the next screen - more comprehensive detection
                            let usernameInput = nextScreenState.inputs.find(input => 
                                input.visible && (
                                    input.placeholder?.toLowerCase().includes('username') ||
                                    input.placeholder?.toLowerCase().includes('phone') ||
                                    input.placeholder?.toLowerCase().includes('email') ||
                                    input['data-testid']?.includes('text') ||
                                    input['data-testid']?.includes('input') ||
                                    input.type === 'text' ||
                                    input.name === 'text' ||
                                    input.id === 'text'
                                )
                            );
                            
                            // If no specific username input found, try to find any visible text input
                            if (!usernameInput) {
                                this.log('🔍 No specific username input found, looking for any visible text input...');
                                const anyTextInput = nextScreenState.inputs.find(input => 
                                    input.visible && input.type === 'text' && input.offsetParent !== null
                                );
                                
                                if (anyTextInput) {
                                    this.log(`🔑 Found general text input: ${JSON.stringify(anyTextInput)}`);
                                    // Use this input instead
                                    usernameInput = anyTextInput;
                                }
                            }
                            
                            if (usernameInput) {
                                this.log(`🔑 Found username input field: ${JSON.stringify(usernameInput)}`);
                                this.log('📝 Automatically entering username...');
                                
                                // Find and fill the username input - more robust selector logic
                                let inputSelector;
                                if (usernameInput['data-testid']) {
                                    inputSelector = `[data-testid="${usernameInput['data-testid']}"]`;
                                } else if (usernameInput.id) {
                                    inputSelector = `#${usernameInput.id}`;
                                } else if (usernameInput.name) {
                                    inputSelector = `input[name="${usernameInput.name}"]`;
                                } else {
                                    inputSelector = `input[type="${usernameInput.type}"]`;
                                }
                                
                                this.log(`🎯 Using selector: ${inputSelector}`);
                                
                                // Wait for the input field to be ready and fill it
                                await this.page.waitForSelector(inputSelector, { timeout: 10000, visible: true });
                                await this.page.click(inputSelector);
                                await this.page.keyboard.down('Control');
                                await this.page.keyboard.press('a');
                                await this.page.keyboard.up('Control');
                                // For the second screen, enter the Twitter username (not email)
                                // Hardcode the correct username to ensure it works
                                const twitterUsername = 'Dasrebel';
                                
                                this.log(`🎯 About to enter username: ${twitterUsername} in field: ${inputSelector}`);
                                
                                // Clear the field first
                                await this.page.click(inputSelector);
                                await this.page.keyboard.down('Control');
                                await this.page.keyboard.press('a');
                                await this.page.keyboard.up('Control');
                                
                                // Enter the username
                                await this.page.type(inputSelector, twitterUsername);
                                this.log(`✅ Successfully entered Twitter username: ${twitterUsername}`);
                                
                                // Verify what was actually entered
                                const actualValue = await this.page.evaluate((selector) => {
                                    const input = document.querySelector(selector);
                                    return input ? input.value : 'No input found';
                                }, inputSelector);
                                
                                this.log(`🔍 Verification: Input field now contains: "${actualValue}"`);
                                
                                // Look for and click the Next/Continue button
                                const nextButton = nextScreenState.buttons.find(btn => 
                                    btn.text?.toLowerCase().includes('next') ||
                                    btn.text?.toLowerCase().includes('continue') ||
                                    btn.text?.toLowerCase().includes('submit')
                                );
                                
                                if (nextButton) {
                                    this.log('➡️ Clicking Next/Continue button on username screen...');
                                    await this.page.click(`[data-testid="${nextButton['data-testid']}"]`);
                                    
                                                                this.log('⏳ Waiting for password field to appear...');
                            await new Promise(resolve => setTimeout(resolve, 5000));
                                } else {
                                    this.log('⚠️ No Next/Continue button found on username screen');
                                }
                            } else {
                                this.log('⚠️ No username input field found on next screen');
                            }
                            
                            this.log('🔄 Checking if verification is complete...');
                        } catch (error) {
                            this.log(`❌ Automatic verification failed: ${error.message}`);
                            this.log('🔄 Retrying automatic verification...');
                            
                            // Retry the verification instead of falling back to manual
                            try {
                                this.log('🔄 Retrying verification step...');
                                await this.page.waitForSelector('[data-testid="ocfEnterTextTextInput"]', { timeout: 15000, visible: true });
                                await this.page.type('[data-testid="ocfEnterTextTextInput"]', process.env.X_USERNAME);
                                await this.page.click('[data-testid="ocfEnterTextNextButton"]');
                                this.log('✅ Retry successful, continuing...');
                            } catch (retryError) {
                                this.log(`❌ Retry also failed: ${retryError.message}`);
                                throw new Error(`Verification failed after retry: ${retryError.message}`);
                            }
                        }
                    } else {
                        this.log('⚠️ No verification input found - this may be a different verification flow');
                        this.log('⏳ Waiting for page to update...');
                        await new Promise(resolve => setTimeout(resolve, 10000));
                        
                        this.log('🔄 Checking if verification is complete...');
                    }
                    
                    // Check if the verification page has changed
                    const currentPageState = await this.page.evaluate(() => {
                        const inputs = Array.from(document.querySelectorAll('input'));
                        const buttons = Array.from(document.querySelectorAll('button, div[role="button"]'));
                        return {
                            inputCount: inputs.length,
                            buttonCount: buttons.length,
                            hasPasswordField: !!document.querySelector('input[type="password"]'),
                            hasVerificationField: !!document.querySelector('[data-testid="ocfEnterTextTextInput"]'),
                            pageTitle: document.title,
                            currentUrl: window.location.href
                        };
                    });
                    
                    this.log('📊 Current page state after verification:', JSON.stringify(currentPageState, null, 2));
                    
                    // If we still have the verification field, wait a bit more and check again
                    if (currentPageState.hasVerificationField) {
                        this.log('⏳ Verification still in progress, waiting a bit more...');
                        await new Promise(resolve => setTimeout(resolve, 15000)); // Wait 15 more seconds
                        
                        // Check again
                        const updatedPageState = await this.page.evaluate(() => {
                            const inputs = Array.from(document.querySelectorAll('input'));
                            const buttons = Array.from(document.querySelectorAll('button, div[role="button"]'));
                            return {
                                inputCount: inputs.length,
                                buttonCount: buttons.length,
                                hasPasswordField: !!document.querySelector('input[type="password"]'),
                                hasVerificationField: !!document.querySelector('[data-testid="ocfEnterTextTextInput"]'),
                                pageTitle: document.title,
                                currentUrl: window.location.href
                            };
                        });
                        
                        this.log('📊 Updated page state:', JSON.stringify(updatedPageState, null, 2));
                        
                        if (updatedPageState.hasPasswordField) {
                            this.log('✅ Password field found! Verification appears complete.');
                        } else if (updatedPageState.hasVerificationField) {
                            this.log('⚠️ Still on verification page. Continuing to wait for automatic completion...');
                            this.log('⏳ Waiting for verification to complete automatically...');
                            await new Promise(resolve => setTimeout(resolve, 15000)); // Wait 15 more seconds
                        }
                    }
                    
                } else {
                    this.log('⚠️ No verification input found - this may require manual intervention');
                    this.log('⏳ Waiting for page to update...');
                    await new Promise(resolve => setTimeout(resolve, 15000));
                }
            }
            
            // After verification (if any), try to find password field with intelligent waiting
            this.log('🔑 Looking for password field after verification...');
            
            // Wait for password field to appear with intelligent retry
            let passwordField = null;
            let attempts = 0;
            const maxAttempts = 12; // Try for up to 2 minutes
            
            while (!passwordField && attempts < maxAttempts) {
                attempts++;
                this.log(`🔍 Attempt ${attempts}/${maxAttempts}: Looking for password field...`);
                
                // Try to find password field with multiple selectors
                const passwordSelectors = [
                    'input[type="password"]',
                    'input[name="password"]',
                    'input[autocomplete="current-password"]'
                ];
                
                for (const selector of passwordSelectors) {
                    try {
                        passwordField = await this.page.waitForSelector(selector, { timeout: 3000, visible: true });
                        if (passwordField) {
                            this.log(`✅ Found password field with selector: ${selector}`);
                            break;
                        }
        } catch (error) {
                        // Continue to next selector
                    }
                }
                
                if (!passwordField) {
                    this.log(`⏳ Password field not found yet, waiting 10 seconds... (${attempts}/${maxAttempts})`);
                    await new Promise(resolve => setTimeout(resolve, 10000));
                    
                    // Check if we're still on the verification page
                    const currentState = await this.page.evaluate(() => {
                        return {
                            hasPasswordField: !!document.querySelector('input[type="password"]'),
                            hasVerificationField: !!document.querySelector('[data-testid="ocfEnterTextTextInput"]'),
                            pageTitle: document.title
                        };
                    });
                    
                    this.log(`📊 Current page state: ${JSON.stringify(currentState)}`);
                    
                    if (currentState.hasVerificationField) {
                        this.log('⚠️ Still on verification page. Please complete verification in browser.');
                        this.log('🔄 Enter your phone/username and click Next, then wait for password field.');
                    }
                }
            }
            
            if (!passwordField) {
                // Take screenshot and inspect page elements for debugging
                await this.takeScreenshot('login-error');
                
                const pageElements = await this.page.evaluate(() => {
                    const inputs = Array.from(document.querySelectorAll('input'));
                    const buttons = Array.from(document.querySelectorAll('button, div[role="button"]'));
                    const divs = Array.from(document.querySelectorAll('div'));
                    
                    return {
                        inputs: inputs.map(input => ({
                            type: input.type,
                            placeholder: input.placeholder,
                            name: input.name,
                            id: input.id,
                            'data-testid': input.getAttribute('data-testid'),
                            visible: input.offsetParent !== null
                        })),
                        buttons: buttons.map(btn => ({
                            text: btn.textContent?.trim(),
                            'data-testid': btn.getAttribute('data-testid'),
                            visible: btn.offsetParent !== null
                        })).slice(0, 10),
                        divs: divs.filter(div => div.textContent && div.textContent.length > 10).map(div => ({
                            text: div.textContent?.trim().substring(0, 100),
                            'data-testid': div.getAttribute('data-testid'),
                            visible: div.offsetParent !== null
                        })).slice(0, 5)
                    };
                });
                
                this.log('📋 Page elements after Next button:', JSON.stringify(pageElements, null, 2));
                throw new Error('Password field not found after multiple attempts');
            }
            
            // Enter password
            this.log('🔒 Entering password...');
            await passwordField.type(process.env.X_PASSWORD);
            
            // Click Log in button
            this.log('🚀 Clicking Log in button...');
            
            const loginButtonClicked = await this.page.evaluate(() => {
                const buttons = Array.from(document.querySelectorAll('div[role="button"], button'));
                const loginButton = buttons.find(btn => 
                    btn.textContent?.trim() === 'Log in' || 
                    btn.textContent?.trim() === 'Log In' ||
                    btn.textContent?.trim().toLowerCase().includes('log in') ||
                    btn.textContent?.trim().toLowerCase().includes('login')
                );
                
                if (loginButton) {
                    loginButton.click();
                    return true;
                }
                
                // Try alternative selectors
                const alternativeLogin = document.querySelector('[data-testid="LoginButton"]') || 
                                       document.querySelector('input[type="submit"]') ||
                                       document.querySelector('button[type="submit"]');
                
                if (alternativeLogin) {
                    alternativeLogin.click();
                    return true;
                }
                
                return false;
            });
            
            if (!loginButtonClicked) {
                throw new Error('Log in button not found - no suitable button to proceed');
            }
            
            // Wait for login to complete
            this.log('⏳ Waiting for login to complete...');
            await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
            
            // Check if login was successful
            const isLoggedIn = await this.page.evaluate(() => {
                return !document.querySelector('input[autocomplete="username"]') && 
                       !document.querySelector('input[type="password"]');
            });
            
            if (isLoggedIn) {
                this.log('✅ Login successful!');
                await this.takeScreenshot('login-success');
                return true;
            } else {
                this.log('❌ Login may have failed - checking for error messages...');
                await this.takeScreenshot('login-failed');
                
                const errorMessage = await this.page.evaluate(() => {
                    const errorDivs = Array.from(document.querySelectorAll('div')).filter(div => 
                        div.textContent && (
                            div.textContent.toLowerCase().includes('incorrect') ||
                            div.textContent.toLowerCase().includes('error') ||
                            div.textContent.toLowerCase().includes('failed') ||
                            div.textContent.toLowerCase().includes('invalid')
                        )
                    );
                    return errorDivs.length > 0 ? errorDivs[0].textContent.trim() : 'Unknown error';
                });
                
                throw new Error(`Login failed: ${errorMessage}`);
                    }
                    
                } catch (error) {
            this.log(`❌ Login failed: ${error.message}`);
            await this.takeScreenshot('login-error');
            throw error;
        }
    }

    async navigateToBookmarks() {
        try {
            this.log('📚 Navigating to bookmarks page...');
            
            // Navigate to bookmarks
            await this.page.goto('https://twitter.com/i/bookmarks', { waitUntil: 'networkidle2' });
            await this.takeScreenshot('bookmarks-page');
            
            // Wait for bookmarks to load
            await this.page.waitForSelector('article[data-testid="tweet"]', { timeout: 30000 });
            
            this.log('✅ Successfully navigated to bookmarks page');
            return true;
        } catch (error) {
            this.log(`❌ Failed to navigate to bookmarks: ${error.message}`);
            await this.takeScreenshot('bookmarks-error');
            throw error;
        }
    }

    async extractBookmarks() {
        try {
            this.log('🔍 Starting bookmark extraction (ALL bookmarks - no limit)...');
            
            const bookmarks = [];
            let scrollAttempts = 0;
            let consecutiveEmptyScrolls = 0;
            let lastBookmarkCount = 0;
            
            // Continue scrolling for extended period to reach oldest tweets
            while (scrollAttempts < this.config.maxScrollAttempts) {
                // Extract current visible bookmarks
                const newBookmarks = await this.page.evaluate(() => {
                    const tweetElements = Array.from(document.querySelectorAll('article[data-testid="tweet"]'));
                    return tweetElements.map(tweet => {
                        try {
                            // Extract tweet text
                            const textElement = tweet.querySelector('[data-testid="tweetText"]');
                            const text = textElement ? textElement.textContent.trim() : '';
                            
                            // Extract username
                            const usernameElement = tweet.querySelector('a[role="link"]');
                            const username = usernameElement ? usernameElement.textContent.trim() : '';
            
            // Extract timestamp
                            const timeElement = tweet.querySelector('time');
                            const timestamp = timeElement ? timeElement.getAttribute('datetime') : '';
                            
                            // Extract tweet ID from URL
                            const tweetLink = tweet.querySelector('a[href*="/status/"]');
                            const tweetId = tweetLink ? tweetLink.href.split('/status/')[1]?.split('?')[0] : '';
            
            // Extract engagement metrics
                            const replyElement = tweet.querySelector('[data-testid="reply"]');
                            const retweetElement = tweet.querySelector('[data-testid="retweet"]');
                            const likeElement = tweet.querySelector('[data-testid="like"]');
                            
                            const replies = replyElement ? replyElement.textContent.trim() : '0';
                            const retweets = retweetElement ? retweetElement.textContent.trim() : '0';
                            const likes = likeElement ? likeElement.textContent.trim() : '0';
                            
                            return {
                id: tweetId,
                                text,
                                username,
                                timestamp,
                                replies,
                                retweets,
                                likes,
                                extractedAt: new Date().toISOString()
                            };
        } catch (error) {
            return null;
                        }
                    }).filter(Boolean);
                });
                
                // Add new bookmarks
                for (const bookmark of newBookmarks) {
                    if (!bookmarks.find(b => b.id === bookmark.id)) {
                        bookmarks.push(bookmark);
                    }
                }
                
                // Progress update with batch processing
                if (bookmarks.length % this.config.progressUpdateInterval === 0) {
                    this.log(`📊 Progress: ${bookmarks.length} bookmarks extracted so far...`);
                    
                    // Fast mode: Process bookmarks in batches for better performance
                    if (this.config.fastScrollMode && bookmarks.length % this.config.batchSize === 0) {
                        this.log(`⚡ Fast mode: Processing batch of ${this.config.batchSize} bookmarks...`);
                    }
                }
                
                // Check if we're still getting new bookmarks
                if (bookmarks.length === lastBookmarkCount) {
                    consecutiveEmptyScrolls++;
                    this.log(`⚠️ No new bookmarks found in scroll ${scrollAttempts + 1} (consecutive: ${consecutiveEmptyScrolls})`);
                } else {
                    consecutiveEmptyScrolls = 0;
                    this.log(`✅ Found ${bookmarks.length - lastBookmarkCount} new bookmarks in scroll ${scrollAttempts + 1}`);
                }
                
                lastBookmarkCount = bookmarks.length;
                
                // Stop if we've hit too many consecutive empty scrolls
                if (consecutiveEmptyScrolls >= this.config.maxConsecutiveEmptyScrolls) {
                    this.log(`🛑 Stopping extraction after ${consecutiveEmptyScrolls} consecutive empty scrolls`);
                    
                    // Try one more aggressive scroll before giving up
                    this.log('🔄 Attempting one final aggressive scroll...');
            await this.page.evaluate(() => {
                window.scrollTo(0, document.body.scrollHeight);
            });
                    await new Promise(resolve => setTimeout(resolve, 5000));
                    
                    // Check one more time
                    const finalCheck = await this.page.evaluate(() => {
                        const tweetElements = Array.from(document.querySelectorAll('article[data-testid="tweet"]'));
                        return tweetElements.length;
                    });
                    
                    if (finalCheck > bookmarks.length) {
                        this.log('✅ Final scroll found more bookmarks, continuing...');
                        consecutiveEmptyScrolls = 0;
                    } else {
                        this.log('🛑 Final scroll confirmed no more bookmarks available');
                        break;
                    }
                }
                
                // ULTRA-FAST scrolling with optimized loading
                if (this.config.fastScrollMode) {
                    // Fast scroll with minimal delay
                    await this.page.evaluate(() => {
                        // Use optimized scrolling for better performance
                        window.scrollTo({
                            top: document.body.scrollHeight,
                            behavior: 'auto' // Use 'auto' instead of 'smooth' for speed
                        });
                        
                        // Trigger any lazy loading events
                        const event = new Event('scroll');
                        window.dispatchEvent(event);
                    });
                    
                    // Minimal wait for content loading
                    await new Promise(resolve => setTimeout(resolve, this.config.scrollDelay));
                } else {
                    // Fallback to original scrolling
                    await this.page.evaluate(() => {
                        window.scrollBy(0, 1000);
                    });
                    await new Promise(resolve => setTimeout(resolve, this.config.scrollDelay));
                }
                scrollAttempts++;
            }
            
            this.log(`🎉 Bookmark extraction completed! Total extracted: ${bookmarks.length}`);
            return bookmarks;
            
        } catch (error) {
            this.log(`❌ Failed to extract bookmarks: ${error.message}`);
            await this.takeScreenshot('extraction-error');
            throw error;
        }
    }

    async refreshBookmarksPage() {
        try {
            this.log('🔄 Refreshing bookmarks page...');
            await this.page.reload({ waitUntil: 'networkidle2' });
            await this.page.waitForSelector('article[data-testid="tweet"]', { timeout: 30000 });
            this.log('✅ Bookmarks page refreshed successfully');
            return true;
        } catch (error) {
            this.log(`❌ Failed to refresh bookmarks page: ${error.message}`);
            return false;
        }
    }
    
    async saveBookmarks(bookmarks) {
        try {
            this.log('💾 Saving bookmarks...');
            
            // Create backup directory
            const backupDir = path.join(process.cwd(), 'backup', 'old-data');
            if (!fs.existsSync(backupDir)) {
                fs.mkdirSync(backupDir, { recursive: true });
            }
            
            // Save raw bookmarks
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `bookmarks-data-${Date.now()}.json`;
            const filepath = path.join(process.cwd(), filename);
            
            const bookmarksData = {
                timestamp: new Date().toISOString(),
                count: bookmarks.length,
                bookmarks: bookmarks,
                sessionId: this.sessionId,
                config: this.config
            };
            
            fs.writeFileSync(filepath, JSON.stringify(bookmarksData, null, 2));
            this.log(`✅ Raw bookmarks saved to: ${filename}`);
            
            // Save to backup directory
            const backupFilepath = path.join(backupDir, filename);
            fs.writeFileSync(backupFilepath, JSON.stringify(bookmarksData, null, 2));
            this.log(`✅ Backup saved to: ${backupFilepath}`);
            
            return filepath;
                    } catch (error) {
            this.log(`❌ Failed to save bookmarks: ${error.message}`);
            throw error;
        }
    }
    
    async run() {
        try {
            this.log('🚀 Starting Web Login Scraper...');
            
            if (!await this.initialize()) {
                throw new Error('Failed to initialize browser');
            }
            
            if (!await this.handleManualLogin()) {
                throw new Error('Login failed');
            }
            
            if (!await this.navigateToBookmarks()) {
                throw new Error('Failed to navigate to bookmarks');
            }
            
            const bookmarks = await this.extractBookmarks();
            
            if (bookmarks.length === 0) {
                throw new Error('No bookmarks were extracted');
            }
            
            const savedFile = await this.saveBookmarks(bookmarks);
            
            const result = {
                success: true,
                totalExtracted: bookmarks.length,
                savedFile: savedFile,
                sessionId: this.sessionId,
                duration: Date.now() - this.startTime
            };
            
            this.log(`🎉 Scraping completed successfully!`);
            this.log(`   Total bookmarks: ${bookmarks.length}`);
            this.log(`   Duration: ${Math.round(result.duration / 1000)}s`);
            this.log(`   Saved to: ${savedFile}`);
            
            return result;
            
        } catch (error) {
            this.log(`❌ Scraping failed: ${error.message}`);
            
            // Save error details
            const errorData = {
                timestamp: new Date().toISOString(),
                error: error.message,
                stack: error.stack,
                sessionId: this.sessionId,
                logs: this.logs,
                screenshots: this.screenshots
            };
            
            const errorFilename = `scraping-error-${Date.now()}.json`;
            fs.writeFileSync(errorFilename, JSON.stringify(errorData, null, 2));
            this.log(`📝 Error details saved to: ${errorFilename}`);
            
            throw error;
        } finally {
            if (this.browser) {
                await this.browser.close();
                this.log('🔒 Browser closed');
            }
        }
    }
}

// Main execution
async function main() {
    try {
        const scraper = new WebLoginScraper();
        const result = await scraper.run();
        console.log('✅ Scraping completed successfully:', result);
        process.exit(0);
    } catch (error) {
        console.error('❌ Scraping failed:', error.message);
        process.exit(1);
    }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}

export default WebLoginScraper;
