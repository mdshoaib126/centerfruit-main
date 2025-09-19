# Centerfruit Durga Puja Contest

A full-stack IVR contest application for managing Durga Puja tongue twister submissions with automated speech-to-text processing, scoring, and SMS notifications.

## Features

### Backend (Node.js + Express)
- **Exotel IVR Integration**: Webhook endpoints to receive audio recordings from IVR calls
- **Google Cloud Speech-to-Text**: Automated transcription of audio recordings
- **Smart Scoring System**: Levenshtein distance-based comparison with expected tongue twister
- **SMS Notifications**: Automated result notifications via MSG91 API
- **Admin Authentication**: JWT-based authentication system
- **RESTful APIs**: Complete CRUD operations for submission management

### Frontend (React + TypeScript)
- **Admin Dashboard**: Clean, responsive interface for managing submissions
- **Real-time Data**: Live statistics and submission tracking
- **Audio Playback**: In-browser audio player for reviewing recordings
- **Advanced Filtering**: Filter by status, date range, and phone number
- **Manual Override**: Admin can manually approve/reject submissions
- **Authentication**: Secure login with session management

## Tech Stack

### Backend
- Node.js with Express.js
- TypeScript for type safety
- Google Cloud Speech-to-Text API
- MSG91 SMS API
- JWT for authentication
- In-memory storage (easily replaceable with MySQL)
- CORS enabled for frontend communication

### Frontend
- React 18 with TypeScript
- Tailwind CSS for styling
- shadcn/ui component library
- React Query for data fetching
- Wouter for routing
- React Hook Form for form handling

## Setup Instructions

### Prerequisites
- Node.js 18+ installed
- Google Cloud account with Speech-to-Text API enabled
- MSG91 account for SMS services
- Exotel account for IVR integration

### Installation

1. **Clone and install dependencies:**
```bash
git clone <repository-url>
cd centerfruit-contest
npm install
