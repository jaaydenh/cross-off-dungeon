# Technology Stack

## Frontend (app/)
- **Framework**: Next.js 14.2.3 with React 18
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 3.4.1
- **Real-time Client**: Colyseus.js 0.15.20
- **Linting**: ESLint with Next.js config

## Backend (server/)
- **Framework**: Colyseus 0.15.0 game server
- **Runtime**: Node.js (>= 16.13.0)
- **Language**: TypeScript 5
- **Web Server**: Express 4.18.2
- **Development Tools**: tsx for TypeScript execution
- **Testing**: Mocha with @colyseus/testing

## Development Tools
- **Build System**: TypeScript compiler (tsc) for server, Next.js for frontend
- **Package Manager**: npm
- **Process Management**: PM2 (ecosystem.config.js)
- **Load Testing**: @colyseus/loadtest

## Common Commands

### Frontend Development (app/)
```bash
npm run dev          # Start Next.js development server (localhost:3000)
npm run build        # Build production bundle
npm run start        # Start production server
npm run lint         # Run ESLint
```

### Backend Development (server/)
```bash
npm start            # Start development server with tsx watch (localhost:2567)
npm run build        # Compile TypeScript to build/ directory
npm run clean        # Remove build directory
npm test             # Run Mocha test suite
npm run loadtest     # Run load testing with 2 clients
```

## Configuration Notes
- Server uses CommonJS modules, frontend uses ES modules
- Both projects use experimental decorators for Colyseus schema
- TypeScript strict mode disabled in frontend, enabled in backend
- Frontend uses path aliases (@/* maps to ./src/*)
- Server outputs to build/ directory