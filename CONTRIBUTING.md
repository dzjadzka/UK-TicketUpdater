# Contributing to UK-TicketUpdater

Thank you for your interest in contributing to UK-TicketUpdater! This document provides guidelines and instructions for development.

## Development Setup

### Prerequisites

- Node.js >= 18
- npm >= 9
- Git

### Initial Setup

1. Clone the repository:

   ```bash
   git clone https://github.com/dzjadzka/UK-TicketUpdater.git
   cd UK-TicketUpdater
   ```

2. Install dependencies:

   ```bash
   PUPPETEER_SKIP_DOWNLOAD=1 npm install
   ```

3. Create your users configuration:
   ```bash
   cp config/users.sample.json config/users.json
   # Edit config/users.json with your test accounts
   ```

## Development Workflow

### Running Tests

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

### Code Quality

```bash
# Run linter
npm run lint

# Auto-fix linting issues
npm run lint:fix

# Format code with Prettier
npm run format

# Check formatting without changing files
npm run format:check
```

### Before Committing

The pretest script automatically runs linting before tests. Ensure both pass:

```bash
npm test
```

## Code Style

- **JavaScript Style**: Follow ESLint rules (see `eslint.config.js`)
- **Formatting**: Prettier with 2-space indentation, single quotes, 120 char line width
- **Documentation**: Add JSDoc comments for all exported functions
- **Testing**: Write tests for new functionality

## Project Structure

```
src/
├── index.js          # CLI entrypoint
├── downloader.js     # Puppeteer-based ticket download logic
├── server.js         # Express API server
├── db.js             # SQLite database operations
├── history.js        # History tracking (file and DB)
├── deviceProfiles.js # Device emulation profiles
└── setupDb.js        # Database initialization script

__tests__/            # Jest test files
config/               # User configuration
data/                 # Runtime data (gitignored)
legacy/               # Old single-user scripts (reference only)
```

## Adding Features

### Adding a New Device Profile

1. Edit `src/deviceProfiles.js`
2. Add your profile to `DEVICE_PROFILES` object
3. Include name, userAgent, viewport, and locale
4. Add tests in `__tests__/deviceProfiles.test.js`

### Adding API Endpoints

1. Edit `src/server.js`
2. Add your route handler after middleware setup
3. Include input validation
4. Add tests in `__tests__/server.test.js`

### Database Changes

1. Edit schema in `src/db.js` `initSchema()` function
2. Add new prepared statements
3. Export new methods
4. Add tests in `__tests__/db.test.js`

## Testing Guidelines

- **Unit Tests**: Test individual functions and modules
- **Integration Tests**: Test interactions between modules
- **Coverage**: Aim for >80% coverage on core modules
- **Mock External Services**: Use Jest mocks for Puppeteer, filesystem, etc.

## Pull Request Process

1. Create a feature branch from `main`
2. Make your changes with clear, focused commits
3. Ensure all tests pass and linting is clean
4. Update documentation if needed
5. Submit a PR with a clear description of changes
6. Wait for CI to pass and address any review comments

## Security Considerations

- **Never commit real credentials** to version control
- **Validate all user input** in API endpoints
- **Use parameterized queries** for database operations
- **Keep dependencies updated** for security patches
- **Report security issues privately** to maintainers

## Getting Help

- Check existing issues on GitHub
- Read the main [README.md](README.md) and [AGENTS.md](AGENTS.md)
- Open a new issue with details about your question

## License

By contributing, you agree that your contributions will be licensed under the same license as the project (ISC).
