---
trigger: always_on
---

# Project Scripts & CLI Rules

## 1. Prioritize Existing Scripts

Before executing any CLI commands, you MUST check the `package.json` scripts.

- **Rule:** Always use the predefined scripts (e.g., `npm start`, `npm run build`, `npm run lint`) instead of raw tool commands.
- **Exception:** You are only allowed to invent or construct a new command if a suitable script for the task does NOT exist in `package.json`.

## 2. Ionic CLI

When working with Ionic:

- Use `ionic serve` (via `npm start`) for development
- Use `ionic build` (via `npm run build`) for production builds
- Use `ionic generate` for scaffolding new pages/components

## 3. Package Manager

This project uses **npm**. Never use `yarn` or `pnpm`.
