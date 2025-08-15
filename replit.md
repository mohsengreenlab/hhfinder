# Overview

This AI-powered job search application helps users find vacancies on HH.ru (HeadHunter) through a multi-step wizard. It enables users to input job keywords, receive AI-generated suggestions, apply filters, and browse results one-by-one with AI-generated cover letters. The system aims to simplify the job search process, improve result relevance, and assist users with application materials, leveraging Google's Gemini AI for intelligence and personalization. The project's vision is to provide a streamlined, intelligent job search experience that reduces cognitive overload and enhances the success rate for job seekers.

# User Preferences

Preferred communication style: Simple, everyday language.

# Recent Changes

## August 15, 2025 - Migration and Rate Limiting Fix
- **Migration**: Successfully migrated project from Replit Agent to standard Replit environment
- **Rate Limiting Fix**: Fixed Gemini AI overload issue by:
  - Increased minimum request interval from 2s to 5s between AI calls
  - Added 3s additional wait between candidate generation and ranking steps
  - Implemented fallback logic to use unranked candidates if ranking fails
  - This prevents 503 "Service Unavailable" errors from Gemini API

# System Architecture

## Frontend Architecture
- **Framework**: React with TypeScript (Vite build tool)
- **UI Library**: Shadcn/ui components (Radix UI, Tailwind CSS)
- **State Management**: Zustand (for wizard state with persistence)
- **Data Fetching**: TanStack React Query (server state management, caching)
- **Routing**: Wouter (lightweight client-side routing)
- **Design System**: CSS custom properties for theming, Inter font family.

## Backend Architecture
- **Runtime**: Node.js with Express.js server
- **Language**: TypeScript with ES modules
- **API Structure**: RESTful endpoints under `/api`
- **Middleware**: Compression, request logging, Server-Timing headers
- **Error Handling**: Centralized with status code mapping
- **Development**: Hot module replacement via Vite.

## Data Storage Solutions
- **Database**: PostgreSQL via Drizzle ORM (Neon Database serverless driver)
- **Schema Management**: Drizzle Kit (migrations)
- **In-Memory Storage**: Fallback MemStorage class for development
- **Caching**: Multi-tier LRU cache for AI suggestions (60s), HH.ru dictionaries/areas (24h), vacancy details (10min).

## Authentication and Authorization
- **Session Management**: Express sessions with PostgreSQL store (connect-pg-simple)
- **User Schema**: Basic user model (id, username)
- **Storage Interface**: Abstracted IStorage for flexible user data persistence.

## Key Architectural Decisions

### Multi-Step Wizard Flow
- **Decision**: Implement a 4-step wizard (keywords → confirmation → filters → results) with strictly forward-only navigation.
- **Benefit**: Reduces cognitive load, provides progressive disclosure, and ensures a guided user journey.

### Optional Filter System
- **Decision**: Each filter category has an enable/disable toggle, disabled by default.
- **Benefit**: Users control filter application, allowing for broad or specific searches.

### Intelligent Keyword Verification
- **Decision**: Character-by-character verification of AI-generated keywords against HH.ru's suggestion API.
- **Benefit**: Ensures higher search relevance and aligns suggestions with market terms.

### Aggressive Caching Strategy
- **Decision**: Multi-tier LRU caching with request coalescing for external API calls.
- **Benefit**: Improves performance, reduces API costs, and enhances user experience by minimizing latency.

### One-at-a-Time Vacancy Display
- **Decision**: Present vacancies one at a time with previous/next navigation.
- **Benefit**: Reduces decision fatigue, improves focus on individual postings, and enhances engagement.

### Tiered Search System
- **Decision**: Implement a three-tier search using HH.ru's search fields (name, description, company_name) with skills as a fallback.
- **Benefit**: Prioritizes relevance by matching keywords in key fields first.

### Enhanced Relevance Scoring
- **Decision**: Apply detailed relevance scoring within tiers, including positive and negative keyword penalties, and various tie-breaker criteria.
- **Benefit**: Provides more accurate and user-preferred vacancy ordering.

# External Dependencies

- **HH.ru API**: For vacancy search, keyword suggestions, area/location data, and dictionary data. Custom HTTP client with rate limiting and specific headers (e.g., `Accept-Language: ru`).
- **Google Gemini AI**: Uses Gemini 2.5 Flash and Pro models for job title generation, natural language to filter mapping, and customizable cover letter generation.
- **PostgreSQL**: Primary database for user management, job applications, session storage, and core application data.
- **DOMPurify with JSDOM**: For HTML sanitization of job description rendering.