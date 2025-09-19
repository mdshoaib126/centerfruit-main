# Overview

The Centerfruit Durga Puja Contest is a full-stack IVR contest application that manages tongue twister submissions through automated speech-to-text processing. Participants call into an IVR system and leave recordings which are then transcribed, scored, and automatically evaluated with SMS notifications sent for results.

The application features a complete admin dashboard for managing submissions and includes intelligent scoring based on Levenshtein distance comparison with expected tongue twisters.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Full-Stack TypeScript Architecture
The application uses a monorepo structure with shared TypeScript schemas between frontend and backend. The Vite build system compiles both client and server code, with the server running as an ESM module using tsx for TypeScript execution.

## Backend Architecture
- **Express.js Server**: RESTful API server with middleware for CORS, authentication, and logging
- **Session-based Authentication**: Uses express-session with Passport.js local strategy for admin login
- **In-Memory Storage**: Currently implements MemStorage class for data persistence with easy migration path to PostgreSQL via Drizzle ORM
- **Microservices Pattern**: Separate service classes for speech-to-text (SpeechToTextService), SMS notifications (SMSService), and scoring (ScoringService)
- **Webhook Integration**: Dedicated endpoint `/ivr/recording` for receiving Exotel IVR callbacks
- **Async Processing**: Background processing of audio recordings to avoid blocking webhook responses

## Frontend Architecture
- **React 18 with TypeScript**: Modern React with functional components and hooks
- **Client-side Routing**: Uses Wouter for lightweight routing with protected routes
- **State Management**: React Query (@tanstack/react-query) for server state management and caching
- **UI Components**: shadcn/ui component library with Radix UI primitives and Tailwind CSS
- **Form Handling**: React Hook Form with Zod validation for type-safe forms

## Database Design
Uses Drizzle ORM with PostgreSQL schema definitions:
- **admins table**: User authentication (id, username, password hash)
- **submissions table**: Contest entries (id, caller_number, recording_url, transcript, score, status, created_at)

The current implementation uses in-memory storage but is architected for easy migration to PostgreSQL.

## Authentication & Authorization
- **JWT-based sessions**: Secure session management with HTTP-only cookies
- **Protected routes**: Frontend route protection with authentication checks
- **Admin-only access**: All management functions require authentication

## Audio Processing Pipeline
1. **Webhook Reception**: Exotel sends recording URL and caller info
2. **Audio Download**: Fetch audio file from provided URL
3. **Speech-to-Text**: Google Cloud Speech API transcription with Hindi language support
4. **Scoring Algorithm**: Levenshtein distance comparison for accuracy scoring
5. **Status Determination**: Automatic pass/fail based on 70% threshold
6. **SMS Notification**: Automated result delivery via MSG91 API

# External Dependencies

## Third-party APIs
- **Exotel IVR**: Receives webhook notifications with recording URLs and caller information
- **Google Cloud Speech-to-Text**: Converts audio recordings to text transcriptions with Hindi language support
- **MSG91 SMS Service**: Sends automated SMS notifications for contest results using template-based messaging

## Database & Storage
- **Drizzle ORM**: Type-safe database queries with PostgreSQL support (configured but currently using in-memory storage)
- **Neon Database**: PostgreSQL hosting service integration via @neondatabase/serverless

## UI & Styling
- **shadcn/ui Components**: Pre-built accessible UI components using Radix UI primitives
- **Tailwind CSS**: Utility-first CSS framework for styling
- **Lucide Icons**: Icon library for consistent UI elements

## Development Tools
- **Vite**: Build tool and development server with HMR support
- **TypeScript**: Static typing across the entire application
- **React Query**: Server state management with automatic caching and refetching
- **React Hook Form**: Form state management with validation