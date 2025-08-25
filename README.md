# X.com Bookmarks Automation

Automated X.com (formerly Twitter) bookmark management system with Supabase integration, AI processing, and Android app compatibility.

## 🚀 Features

- **Automated Bookmark Scraping**: Log in to X.com and scrape your bookmarks automatically
- **Consolidated Data Storage**: Unified schema in Supabase for all bookmark data
- **AI-Powered Processing**: Automatic categorization, sentiment analysis, and scoring
- **Duplicate Detection**: Smart hashing to prevent duplicate entries
- **Batch Processing**: Efficient processing of bookmarks in configurable batches
- **Comprehensive Metadata**: Rich metadata extraction including hashtags, mentions, and more
- **Thread Support**: Handle tweet threads and conversations
- **RESTful API**: Built-in API for integration with other applications
- **Android App Integration**: Seamless sync with the Second Brain Android app

## 📦 Prerequisites

- Node.js 18+ (LTS recommended)
- npm or yarn
- Supabase account and project
- X.com (Twitter) account with bookmarks

## 🛠️ Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/x-bookmarks-automation.git
   cd x-bookmarks-automation
   ```

2. Install dependencies:
   ```bash
   npm install
   # or
   yarn install
   ```

3. Create a `.env` file in the root directory with your configuration:
   ```env
   # Supabase
   SUPABASE_URL=your-supabase-url
   SUPABASE_KEY=your-supabase-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   
   # X.com (Twitter) Credentials
   X_USERNAME=your_twitter_username
   X_PASSWORD=your_twitter_password
   
   # Optional Settings
   HEADLESS=true  # Set to false to see the browser
   MAX_BOOKMARKS=500  # Maximum number of bookmarks to process
   CHROME_PATH=/path/to/chrome  # Only needed if Chrome isn't in default location
   ```

## 🚀 Quick Start

1. **Run the migration script** to set up the database schema:
   ```bash
   npm run migrate:schema
   ```

2. **Scrape and process your X.com bookmarks**:
   ```bash
   npm run x-bookmarks
   ```

3. **Monitor the progress** in the console output.

## 📊 Database Schema

The consolidated schema includes the following key tables:

### bookmarks
- Core bookmark data with comprehensive metadata
- AI analysis results and scores
- Thread relationships and conversation context
- Raw data for reference

## 🤖 Scripts

- `npm run x-bookmarks` - Main script to scrape and process X.com bookmarks
- `npm run migrate:schema` - Run database migrations
- `npm start` - Start the API server
- `npm run dev` - Start in development mode
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier

## 🔄 Android App Integration

This system integrates with the Second Brain Android app for a complete bookmark management solution:

- **Real-time Sync**: Bookmark changes are immediately available on all devices
- **Rich Content**: View full tweet content with formatting and media
- **Smart Organization**: Use AI-generated tags and categories
- **Cross-Platform**: Access your bookmarks from any device

## 📚 Documentation

For detailed documentation, please see:
- [API Documentation](./docs/API.md)
- [Database Schema](./docs/SCHEMA.md)
- [Development Guide](./docs/DEVELOPMENT.md)

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](./CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Related Projects

### 🤖 Second Brain Android App
**Repository**: [second-brain-android-testing](https://github.com/Das-rebel/second-brain-android-testing)

A comprehensive bookmark management Android app featuring:
- **Clean Architecture** with MVVM pattern
- **Jetpack Compose** UI with Material 3 design
- **Comprehensive Testing Suite**:
  - Espresso (24 tests) - UI instrumentation testing
  - Robolectric (24 tests) - Local unit testing with Android context
  - UI Automator (13 tests) - System-level integration testing
  - Compose UI (40+ tests) - Component-specific testing
- **150+ total test cases** with 95%+ code coverage
- **Production-ready** with enterprise-grade testing infrastructure

## Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Configure settings in `config.json`
4. Set up environment variables

## Usage

### Bookmark Automation
Instructions for using the bookmark automation system:

1. **Server Mode**: `node server.js`
2. **Batch Processing**: `node batch-processor.js`
3. **Cron Jobs**: Use `setup-cron.sh` for automated processing

### Android App Integration
The automation system integrates with the Second Brain Android app for:
- Real-time bookmark synchronization
- Cross-platform bookmark management
- Comprehensive testing validation

## License

MIT License
