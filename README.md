# HYBRID DB AI ENGINE

## Project Overview
The HYBRID DB AI ENGINE is a modern, responsive web application designed to act as the primary interface for our intelligent database architecture system. It bridges the gap between unstructured data and structured database schemas. By combining natural language processing capabilities with a visual diagramming tool, this application allows users to seamlessly convert data structures, CSV files, and textual descriptions into production-ready Entity-Relationship (ER) schemas.

## Core Objective
The primary focus of this application is to accelerate database architecture and design. Users can expect a highly intuitive interface that simplifies complex schema generation, offering intelligent suggestions for both SQL and NoSQL database structures based on provided context.

## Key Features

### Current Capabilities
* **Intelligent File Processing:** Seamlessly upload and process various file formats (CSV, JSON, PDF, Excel) to extract structural data.
* **Natural Language Queries:** An interactive chat interface that processes plain English prompts to generate or modify database architectures.
* **Visual Schema Editor:** An interactive, node-based canvas (powered by React Flow) that allows users to drag, drop, and connect entities visually.
* **Real-time ER Diagram Generation:** Automatically converts AI-processed schema data into visual relationship diagrams.
* **Responsive Theming:** A professional UI built with a custom design system, fully supporting dynamic light and dark modes.
* **State Management:** Robust client-side state handling ensuring smooth transitions between chat interactions and canvas editing.

### Future Expectations
* **Advanced Schema Export:** Capabilities to directly export generated schemas into raw SQL, MongoDB schemas, or Prisma models.
* **Real-time Collaboration:** Allowing multiple database architects to collaborate on a single schema instance simultaneously.
* **Database Optimization Insights:** Automated suggestions for indexing, foreign key constraints, and query optimization based on the visual schema.

## Technology Stack
* **Framework:** React 19 with TypeScript
* **Build Tool:** Vite
* **Styling:** TailwindCSS v4 with Shadcn/UI components
* **State Management:** Zustand
* **Diagramming:** React Flow
* **Backend Integration:** Optimized for seamless communication with a Python FastAPI backend.

## Local Development Setup

1. **Install Dependencies**
   Ensure you have Node.js installed, then run:
   ```bash
   npm install
   ```

2. **Start the Development Server**
   Start the Vite development server:
   ```bash
   npm run dev
   ```

3. **Backend Requirements**
   This frontend expects a running instance of the HYBRID DB AI ENGINE backend (FastAPI). Ensure your backend server is running and accessible (the proxy is configured in `vite.config.ts` to route `/api` requests to the appropriate backend port).

## Project Guidelines
This repository maintains strict professional standards. All UI components are modular, styling is managed centrally via CSS variables and Tailwind utilities, and state is localized where appropriate and elevated to Zustand for global access. Code contributions should maintain this architectural consistency.
