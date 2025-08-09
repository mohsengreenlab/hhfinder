# Overview

This is an AI-powered job search application that helps users find vacancies on HH.ru (HeadHunter). The system provides a multi-step wizard interface where users enter job keywords, get AI-generated suggestions verified through HH.ru's API, apply filters, and browse results one-by-one with AI-generated cover letters. The application uses Google's Gemini AI for intelligent keyword suggestions and cover letter generation.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React with TypeScript using Vite as the build tool
- **UI Library**: Shadcn/ui components built on Radix UI primitives with Tailwind CSS for styling
- **State Management**: Zustand for wizard state management with persistence
- **Data Fetching**: TanStack React Query for server state management and caching
- **Routing**: Wouter for lightweight client-side routing
- **Design System**: Uses CSS custom properties for theming with Inter font family

## Backend Architecture
- **Runtime**: Node.js with Express.js server
- **Language**: TypeScript with ES modules
- **API Structure**: RESTful endpoints under `/api` namespace
- **Middleware**: Compression, request logging, and Server-Timing headers for performance monitoring
- **Error Handling**: Centralized error handling with status code mapping
- **Development**: Hot module replacement via Vite in development mode

## Data Storage Solutions
- **Database**: PostgreSQL configured via Drizzle ORM with Neon Database serverless driver
- **Schema Management**: Drizzle Kit for migrations and schema management
- **In-Memory Storage**: Fallback MemStorage class for user data during development
- **Caching**: Multi-tier LRU cache system with different TTLs:
  - AI keyword suggestions: 60 seconds
  - HH.ru dictionaries/areas: 24 hours
  - Vacancy details: 10 minutes

## Authentication and Authorization
- **Session Management**: Express sessions with PostgreSQL session store (connect-pg-simple)
- **User Schema**: Basic user model with id, username fields
- **Storage Interface**: Abstracted IStorage interface for flexible user data persistence

## External Service Integrations

### HH.ru API Integration
- **HTTP Client**: Custom HHClient with keep-alive agents for connection pooling
- **Rate Limiting**: Exponential backoff with jitter for 429 responses
- **Endpoints**: 
  - Keyword suggestions (`/suggests/vacancy_search_keyword`)
  - Area/location data (`/areas`)
  - Dictionary data (`/dictionaries`)
  - Vacancy search and details
- **Headers**: Russian locale (`Accept-Language: ru`) and custom User-Agent handling

### Google Gemini AI Integration
- **Models**: Uses both Gemini 2.5 Flash and Pro models
- **Use Cases**:
  - Job title generation from user input
  - Filter mapping from natural language to HH.ru parameters
  - Cover letter generation with customizable prompts
- **Error Handling**: Graceful fallbacks when AI services are unavailable

### Additional Services
- **HTML Sanitization**: DOMPurify with JSDOM for safe job description rendering
- **Content Security**: Configurable allowed tags and attributes for job postings
- **Network Optimization**: Gzip compression and HTTP keep-alive for performance

## Key Architectural Decisions

### Multi-Step Wizard Flow
- **Problem**: Complex job search with many parameters can overwhelm users
- **Solution**: Progressive disclosure through a 4-step wizard (keywords → confirmation → filters → results)
- **Benefits**: Better user experience, reduced cognitive load, ability to refine searches iteratively

### Intelligent Keyword Verification
- **Problem**: AI-generated job titles may not match actual market terms
- **Solution**: Char-by-char verification against HH.ru's suggestion API to validate and rank keywords
- **Benefits**: Higher search relevance, real market-aligned suggestions

### Aggressive Caching Strategy
- **Problem**: External API calls can be slow and rate-limited
- **Solution**: Multi-tier LRU caching with request coalescing to prevent duplicate calls
- **Benefits**: Improved performance, reduced API costs, better user experience

### One-at-a-Time Vacancy Display
- **Problem**: Job seekers can feel overwhelmed by long lists of vacancies
- **Solution**: Netflix-style single vacancy viewer with previous/next navigation
- **Benefits**: Better focus, reduced decision fatigue, improved engagement with individual postings