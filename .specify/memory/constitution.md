# GnuCash Web Constitution

## Core Principles

### I. Local-First
All data stays 100% on the user's machine. No cloud services, no external databases, no data transmission. The backend runs locally; the GnuCash file is read and written directly on disk.

### II. Technology Stack
- **Backend**: Express
- **Frontend**: Vite + React + TypeScript
- **Data**: GnuCash XML files (`.gnucash`) — no separate database

### III. Follow Existing Patterns
New code must align with established patterns in `backend/` and `frontend/`. Study the existing structure before implementing: parser, serializer, importer, API routes, components, store, and lib utilities.

### IV. GnuCash Compatibility
All writes must produce GnuCash-compatible output. Use the existing serializer; maintain timestamped backups and `.log` audit files. The `.gnucash` file must remain openable in the GnuCash desktop app.

## Additional Constraints

- No user accounts or authentication (local app)
- Backend on port 3001, frontend on port 5173 (or next available)
- AI features (e.g., Advisor) run locally via Ollama when used

## Governance

This constitution guides all feature development. Amendments should document the rationale and any migration impact.

**Version**: 1.0 | **Ratified**: 2025-03-03
