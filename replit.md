# Η Κρυφή Λέξη - Multiplayer Word Game

## Overview
This is a full-stack multiplayer word game called "Η Κρυφή Λέξη" (The Secret Word) built with React, Express, and real-time WebSocket communication. Players join rooms, receive secret words, and try to identify the secret agent among them through discussion and voting.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter for client-side routing
- **UI Components**: Shadcn/ui with Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming
- **State Management**: React hooks and context for local state
- **Data Fetching**: TanStack React Query for server state management
- **Real-time Communication**: WebSocket hooks for game events

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ES modules
- **Real-time**: WebSocket Server (ws library) for game communication
- **Storage**: In-memory storage with interface for future database integration
- **API**: RESTful endpoints for room/player management
- **Build**: ESBuild for server bundling, Vite for client

### Data Storage Solutions  
- **Current**: PostgreSQL database with Drizzle ORM (migrated from in-memory)
- **Schema**: Complete Drizzle schema with rooms, players, votes tables
- **Tables**: 
  - `rooms`: Game rooms with codes, hosts, game state, secret words
  - `players`: Player information with room associations  
  - `votes`: Voting records with room and player references
- **Migration**: Successfully deployed with `npm run db:push`
- **Connection**: Neon PostgreSQL with WebSocket support

## Key Components

### Game Logic
- **Room Management**: 6-character codes, host-based rooms, max 8 players
- **Game States**: lobby → playing → voting → finished
- **Secret Agent**: One random player per game receives no secret word
- **Voting System**: Players vote to identify the secret agent
- **Word Pool**: Greek words categorized by theme (animals, food, objects, etc.)

### Real-time Features
- **WebSocket Events**: Player join/leave, game start, voting, results
- **Live Updates**: Real-time player list, game state changes
- **Connection Management**: Socket ID tracking, reconnection handling

### UI/UX Design
- **Responsive**: Mobile-first design with Tailwind breakpoints
- **Accessibility**: Proper ARIA labels, keyboard navigation
- **Theme Support**: Light/dark mode with CSS variables
- **Loading States**: Spinners and skeleton loaders
- **Toast Notifications**: User feedback for actions and errors

## Data Flow

### Game Creation Flow
1. Player creates room via POST /api/rooms
2. Server generates unique 6-character code
3. Room stored in memory with host ID
4. WebSocket connection established
5. Real-time updates for room state

### Player Join Flow
1. Player submits room code and name
2. Server validates room exists and has space
3. Player created via POST /api/players
4. WebSocket message broadcasts player joined
5. UI updates with current player list

### Game Play Flow
1. Host starts game (minimum 3 players)
2. Server selects random secret word and agent
3. All players except agent receive the word
4. Discussion phase (no server state)
5. Voting phase begins automatically
6. Players submit votes via WebSocket
7. Results calculated and game ends

## External Dependencies

### Core Dependencies
- **@neondatabase/serverless**: Database driver for Neon PostgreSQL
- **drizzle-orm**: Type-safe ORM with schema validation
- **ws**: WebSocket server implementation
- **express**: Web server framework
- **zod**: Schema validation via drizzle-zod

### Frontend Dependencies
- **@tanstack/react-query**: Server state management
- **@radix-ui/***: Accessible UI primitives
- **tailwindcss**: Utility-first CSS framework
- **wouter**: Minimal React router
- **lucide-react**: Icon library

### Development Dependencies
- **vite**: Frontend build tool and dev server
- **tsx**: TypeScript execution for development
- **esbuild**: Server bundling for production

## Deployment Strategy

### Development
- **Dev Server**: Vite dev server with HMR proxy
- **Backend**: tsx watch mode for hot reloading
- **WebSocket**: Same port as HTTP server
- **Database**: In-memory storage for rapid development

### Production Build
- **Frontend**: Vite build to dist/public
- **Backend**: ESBuild bundle to dist/index.js
- **Static Assets**: Served by Express in production
- **Database**: Ready for PostgreSQL via Drizzle migrations

### Environment Configuration
- **DATABASE_URL**: PostgreSQL connection string
- **NODE_ENV**: Environment detection
- **Port**: Process.env.PORT or default 3000
- **WebSocket**: Automatic protocol detection (ws/wss)

### Scaling Considerations
- **Session Storage**: Can migrate to Redis for multi-instance
- **Database**: Schema ready for PostgreSQL deployment
- **WebSocket**: Single server currently, can cluster with Redis adapter
- **CDN**: Static assets can be served from CDN in production