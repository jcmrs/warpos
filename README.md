# warpos
An MCP (Model Context Protocol) server intended to run as a Warp or other CLI Based AI Assistant plugin/tool.

It provides a thin layer for **planning/orchestration** by calling **z.ai** using your Devpack coding plan API key, so more work can happen inside the MCP process (minimizing Warp usage / context window).

## Requirements
- Node.js 18+ (for built-in `fetch`)
- Git

## Setup
1. Copy `.env.example` to `.env` and fill in your key.
2. Install deps:
   - `npm install`

## Build & run (stdio MCP server)
- Build: `npm run build`
- Run: `npm start`

## Add to Warp (MCP Servers)
1. Build the server so `dist/` exists:
   - `npm run build`
2. In Warp, open **Settings → AI → Manage MCP servers** (or Warp Drive → Personal → MCP Servers) and click **Add**.
3. Paste a JSON config like this (update `working_directory` to your checkout path):

```json
{
  "mcpServers": {
    "warpos": {
      "command": "npm",
      "args": ["start"],
      "working_directory": "C:\\Development\\warpos",
      "env": {},
      "start_on_launch": true
    }
  }
}
```

Notes:
- This server loads `.env` via `dotenv`, so you can usually leave `env` empty as long as `.env` is present in `working_directory`.
- If you prefer not to use `.env`, set `DEVPACK_CODING_PLAN_API_KEY` (or `ZAI_API_KEY`) in the `env` object instead.

## Tools exposed
- `zai_plan`: sends a prompt to z.ai and returns the response text.

## Profiles, MCDs, and task templates (in progress)
This repository is being extended to support a deterministic workflow:
- Warp authors an MCD (Main Context Document)
- MCP applies Domain Profiles (behavioral/technical/methodological frameworks)
- MCP uses Atomic Task Templates (stable library) to generate project-specific Task Instances
- MCP executes work via a two-phase model: prepare (write plan/spec for inspection) → execute (apply after GO/NO-GO)

Docs:
- Domain Profiles: `docs/domain-profiles.md`
- MCD: `docs/mcd.md`
- Atomic Task Templates: `docs/task-templates.md`
- Task Instances: `docs/task-instances.md`

## Notes
- The z.ai HTTP endpoint/shape may differ from the placeholder implementation in `src/zaiClient.ts`. Adjust `ZAI_BASE_URL` and request/response mapping as needed.
