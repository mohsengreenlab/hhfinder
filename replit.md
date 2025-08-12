# Overview

This is an AI-powered job search application that helps users find vacancies on HH.ru (HeadHunter). The system provides a multi-step wizard interface where users enter job keywords, get AI-generated suggestions verified through HH.ru's API, apply filters, and browse results one-by-one with AI-generated cover letters. The application uses Google's Gemini AI for intelligent keyword suggestions and cover letter generation.

# User Preferences

Preferred communication style: Simple, everyday language.

# Recent Changes

**Migration to Replit Environment (January 2025):**
- Successfully migrated from Replit Agent to standard Replit environment
- Fixed JavaScript initialization error in Step4Viewer component (hhFilters variable scoping)
- Updated TypeScript definitions to include missing filter properties (enableEducationFilter, enableWorkFormatFilter, educationLevel, workFormats)
- Configured Google Gemini API integration with proper environment variable (GEMINI_API_KEY)
- Updated AI models to use supported versions (gemini-1.5-flash, gemini-1.5-pro instead of 2.5 versions)
- Implemented fallback cover letter generation for rate-limited scenarios
- Fixed setGeneratedLetter undefined error by adding missing state variables in Step4Viewer component
- Resolved plainDescription property issue by converting from descriptionHtmlSanitized
- All core functionality verified working: keyword generation, filter matching, vacancy search, cover letter generation

**Authentication and Session Management Addition (January 2025):**
- Added private, invite-only user authentication system with bcrypt password hashing
- Created PostgreSQL database with user management, job applications, and session storage
- Built comprehensive login system with Express session management
- Created admin panel for user management with create/edit/activate/deactivate capabilities
- Built user dashboard for managing job search applications with session continuity
- Added session persistence allowing users to save and resume job searches across sessions
- Integrated authentication protection across all API endpoints
- Created initial admin user (username: admin, password: admin123)

**Single Dashboard with Auto-Save (January 2025):**
- Redesigned dashboard to single "My Applications" section eliminating confusing dual options
- Implemented comprehensive auto-save functionality that automatically saves job searches during wizard navigation
- Added visual auto-save indicators in wizard header showing save status and last saved time
- Enhanced wizard store with automatic saving triggers on keyword confirmation, filter changes, and vacancy navigation
- Added application deletion feature with confirmation dialog for managing saved searches
- Created detailed application cards showing progress steps, keywords preview, and last viewed vacancy position
- All searches are now automatically saved without user intervention and can be resumed exactly where left off

**Unified Cover Letter System (January 2025):**
- Fixed duplicate Save buttons issue by creating unified ImprovedCoverLetterGenerator component
- Implemented single "Save your prompt" button replacing confusing dual save interfaces
- Added comprehensive saved prompts management with database integration
- Created user settings persistence for remembering last-used prompt preferences
- Built proper error handling and validation for prompt operations
- Added ability to load, edit, and delete saved prompts through clean interface
- Enhanced user experience with clickable placeholder insertion and modern UI design
- Fixed prompt saving API error by correcting schema validation and request processing

**Enhanced User Experience with Smooth Scrolling and AI Prompt Preview (January 2025):**
- Added AI prompt preview toggle showing exact text sent to Gemini with all placeholders filled
- Implemented smooth scrolling when "Generate Cover Letter" button is clicked to auto-scroll to generator panel
- Added smooth scrolling to generated cover letter results for immediate visibility after AI completion
- Created smooth scroll-to-top functionality when navigating between vacancies (Next/Previous buttons)
- Enhanced cover letter generator with copy-to-clipboard functionality for AI prompts
- Improved overall user experience with gentle, reliable scrolling across desktop and mobile devices

**Phase 2: Tiered Search Implementation (January 2025):**
- Implemented complete tiered search system showing Title → Description → Skills matches in priority order
- Built three-tier search using search_field=name, description, and company_name (skills fallback)
- Created unified pagination over merged results with proper deduplication by vacancy ID
- Added comprehensive debug panel showing tier-specific counts, URLs, and source identification
- Enhanced exact phrase search with proper quote wrapping when enabled
- Integrated with existing auto-save and filter change detection for seamless user experience
- Maintained backward compatibility with all existing Phase 1 features and filter options

**Phase 3: Enhanced Relevance and Transparency (January 2025):**
- Implemented enhanced relevance scoring within tiers with multiple tie-breaker criteria (exact phrase at title start +30, contains in title +15, description matches +6, salary presence +4, recency bonuses +2-3)
- Added negative keywords functionality allowing users to exclude unwanted terms like "intern", "trainee", "junior" with -20 score penalty per exclusion
- Built AND across phrases logic with automatic fallback to OR when results are insufficient (<30 total), with user notification
- Created comprehensive match badges system showing "Title match", "Description match", "Skills match" on each vacancy card
- Added enhanced debug mode displaying relevance scores, matched keywords, match locations, and tier source information
- Implemented toggle persistence in localStorage for all search strategy options (Title-First, Exact Phrase, AND Across Phrases, Debug Mode, Exclude Words)
- Built Gemini API connection flow with modal interface explaining AI benefits and secure API key storage for session
- Enhanced Step3 with consolidated search strategy toggles section and improved user experience
- Removed hidden geography defaults ensuring transparent location behavior with explicit "All regions" messaging
- Added comprehensive fallback messaging when AND logic broadens to OR for better user understanding

**Fixed Independent Search Context and State Management (January 2025):**
- Resolved critical issue where different job searches shared cached data and progress counters
- Implemented complete state isolation for each search with independent vacancy lists, totals, and progress tracking
- Added comprehensive cache clearing when starting new searches or switching between saved applications
- Enhanced reset functionality to clear localStorage and React Query cache for true independence
- Ensured each "My Applications" card displays accurate search-specific numbers and progress
- Fixed issue where continuing different searches showed incorrect shared totals and vacancy positions

**Live Search Sync and Page Jump Navigation (January 2025):**
- Added live sync between Steps 2-4: changes to keywords or filters automatically refresh vacancy results in Step 4
- Implemented smart change tracking to detect when search parameters have been modified
- Added comprehensive validation requiring at least one keyword before proceeding to vacancy search
- Built page jump functionality allowing users to jump directly to any vacancy by number (1-based indexing)
- Added input validation with friendly error messages for invalid page numbers or out-of-range values
- Enhanced navigation with Enter key support and smooth scrolling after jumps
- Integrated auto-save functionality to maintain current position when jumping between vacancies
- All changes maintain session continuity and auto-save the user's current search progress

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
  - Dictionary data (`/dictionaries`) including vacancy labels and search fields
  - Vacancy search and details with advanced filtering (metro, employer, labels, search fields)
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

### Optional Filter System with Checkboxes
- **Problem**: Users sometimes want to see all results without restrictive filters
- **Solution**: Each filter category has an enable/disable toggle switch, filters are disabled by default
- **Benefits**: Users can choose to apply only relevant filters, "see all results" mode when no filters enabled

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