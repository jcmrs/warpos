# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project summary

**warpos** is a TypeScript/Node.js MCP (Model Context Protocol) server that enables deterministic task execution through:
- **Domain Profile Agents**: Framework/methodology providers with YAML-based inheritance
- **Task Profile Agents**: Atomic, deterministic task executors with strict schemas
- **Two-phase execution**: Preparation (safe, inspectable) → Execution (side-effects after approval)

The server exposes **20 MCP tools** across 5 functional areas.

## Common commands

- Install dependencies: `npm install`
- Build (TypeScript → `dist/`): `npm run build`
- Run compiled MCP server (stdio): `npm start`
- Dev mode (run TypeScript directly): `npm run dev`

Linting and comprehensive tests are not currently configured.

## Environment / configuration

The server loads environment variables via `dotenv/config` (supports local `.env` file).

**Required**:
- `DEVPACK_CODING_PLAN_API_KEY` (preferred) or `ZAI_API_KEY` - API key for z.ai integration

**Optional**:
- `ZAI_BASE_URL` (defaults to `https://api.z.ai/v1`)
- `ZAI_MODEL` (defaults to `z-ai`)

## High-level architecture

### Directory structure

```
warpos/
├── src/
│   ├── index.ts           # MCP server entrypoint + all tool handlers
│   ├── schema.ts          # JSON Schema validation helpers
│   ├── profileStore.ts    # Domain Profile loading/inheritance/compilation
│   ├── mcdStore.ts        # Main Context Document storage + hashing
│   ├── templateStore.ts   # Task Template library (versioned)
│   ├── instanceStore.ts   # Task Instance generation
│   ├── taskExecutor.ts    # Two-phase execution (prepare/execute)
│   └── zaiClient.ts       # z.ai API client
├── profiles/domains/      # Domain Profile YAMLs (with inheritance)
├── task-templates/        # Atomic Task Template library (versioned)
├── task-instances/        # Generated Task Instances per project
├── mcd/                   # Main Context Documents per project
├── .warpos/               # Staging area for execution plans
└── docs/                  # Implementation documentation
```

### Core modules

**`src/index.ts`**
- MCP server entrypoint
- Handles `ListToolsRequestSchema` and `CallToolRequestSchema`
- Registers and routes all 20 MCP tools
- Returns results as `content: [{ type: 'text', text: jsonText(...) }]`

**`src/schema.ts`**
- JSON Schema validation using Ajv library
- Provides `validateSchema()` for runtime validation
- Used across stores for data integrity

**`src/profileStore.ts`**
- Loads Domain Profiles from `profiles/domains/`
- Resolves inheritance chains (DFS with cycle detection)
- Compiles framework prompts from observation groups
- Supports soft deletion via deprecation metadata

**`src/mcdStore.ts`**
- Manages Main Context Documents at `mcd/<projectSlug>.md`
- Computes SHA-256 hashes for tracking MCD versions
- Stores metadata (hash, updated_at) alongside markdown

**`src/templateStore.ts`**
- Manages Task Templates at `task-templates/<id>@<version>.yaml`
- Validates template structure against JSON Schema
- Supports versioning and soft deletion
- Returns latest version when version not specified

**`src/instanceStore.ts`**
- Generates Task Instances at `task-instances/<projectSlug>/<instanceId>.json`
- Validates inputs against template input schemas
- Locks template version, inputs, MCD hash, domain profiles
- Prepares instances for execution

**`src/taskExecutor.ts`**
- Implements two-phase execution pattern
- **prepare()**: Generates declarative execution plan (no side effects)
- **execute()**: Applies plan after GO/NO-GO approval (side effects)
- Stores plans at `.warpos/plans/<planId>.yaml`

**`src/zaiClient.ts`**
- HTTP client for z.ai API
- Used by `zai_plan` and `domain_agent_run` tools
- Permissive response parsing (placeholder implementation)

## MCP tools catalog

### z.ai Integration (1 tool)

**`zai_plan`**
- Send planning/orchestration prompt to z.ai
- Input: `{ prompt: string }`
- Returns: Response text from z.ai

### Domain Profiles (5 tools)

**`domain_profile_list`**
- List Domain Profile IDs under `profiles/domains/`
- Input: `{}`
- Returns: `{ profiles: string[] }`

**`domain_profile_get`**
- Get Domain Profile YAML by ID
- Input: `{ id: string }`
- Returns: YAML file contents

**`domain_profile_put`**
- Create or update Domain Profile
- Input: `{ id: string, yaml: string }`
- Returns: `{ ok: true, id, file }`

**`domain_profile_delete`**
- Deprecate Domain Profile (soft delete)
- Input: `{ id: string, reason?: string }`
- Returns: `{ ok: true, id, deprecated: true }`

**`domain_agent_run`**
- Apply Domain Profiles and call z.ai
- Input: `{ profiles: string[], input: string, model?: string, temperature?: number }`
- Returns: Response text from z.ai with compiled framework

### Main Context Documents (3 tools)

**`mcd_list`**
- List MCD project slugs
- Input: `{}`
- Returns: `{ projects: string[] }`

**`mcd_get`**
- Get MCD markdown and metadata
- Input: `{ project_slug: string }`
- Returns: `{ meta: { sha256, updated_at }, markdown }`

**`mcd_put`**
- Create or update MCD
- Input: `{ project_slug: string, markdown: string }`
- Returns: `{ ok: true, meta }`

### Task Templates (4 tools)

**`task_template_list`**
- List Task Template IDs (latest version of each)
- Input: `{}`
- Returns: `{ templates: string[] }`

**`task_template_get`**
- Get Task Template YAML by ID and optional version
- Input: `{ id: string, version?: number }`
- Returns: `{ template, yaml }`

**`task_template_put`**
- Create or update Task Template
- Input: `{ template: object }`
- Returns: `{ ok: true, id, version, file }`

**`task_template_delete`**
- Deprecate Task Template (soft delete)
- Input: `{ id: string, version: number, reason?: string }`
- Returns: `{ ok: true, id, version, deprecated: true }`

### Task Instances (3 tools)

**`task_instance_list`**
- List Task Instance IDs for a project
- Input: `{ project_slug: string }`
- Returns: `{ instances: string[] }`

**`task_instance_get`**
- Get Task Instance by project and ID
- Input: `{ project_slug: string, instance_id: string }`
- Returns: `{ instance }`

**`task_instance_generate`**
- Generate new Task Instance from template
- Validates inputs against template schema
- Input: `{ project_slug, template_id, template_version, inputs, mcd_hash, domain_profiles }`
- Returns: `{ ok: true, instance_id, instance }`

### Two-Phase Execution (2 tools)

**`task_prepare`**
- Prepare: Generate declarative execution plan (no side effects)
- Input: `{ project_slug: string, instance_id: string }`
- Returns: `{ ok: true, plan_id, plan }`
- Stores plan at `.warpos/plans/<plan_id>.yaml`

**`task_execute`**
- Execute: Apply execution plan after GO/NO-GO (has side effects)
- Input: `{ plan_id: string }`
- Returns: `{ ok: true, plan, results }`
- Plan status must be 'pending'

## Key concepts

### Deterministic Execution Pattern

The project implements a 5-step deterministic execution pattern:
1. **Plan-first**: Create explicit plans before implementation
2. **Linear execution**: No exploratory branching
3. **Minimal state checking**: Check only what's necessary
4. **High-confidence**: Trust the plan, no second-guessing
5. **Tight verification**: Verify after each step

See `.claude/rules/deterministic-execution.md` for details.

### Model Selection Strategy

Two-phase model selection for efficiency:
- **Planning phase**: Use powerful model (Sonnet/Opus) for reasoning
- **Execution phase**: Use fast model (Haiku) for following plans
- Result: 5x cheaper, 3x faster

See `.claude/rules/model-selection.md` for details.

### Task Atomicity

Tasks must be:
- Small enough to execute in one focused session (1-3 hours)
- Self-contained with clear inputs/outputs
- Verifiable with explicit success criteria
- Independent (minimal dependencies)

"If you can't execute it linearly without branching, it's not atomic enough."

See `.claude/rules/task-breakdown.md` for details.

### Verification Pattern

**Build → Verify → Next** workflow:
- Never move to next step without verifying current step complete
- Run `npm run build` after each change
- Verify files exist, acceptance criteria met
- Fix immediately if verification fails

See `.claude/rules/verification-pattern.md` for details.

## Notes / gotchas

- This repo is ESM (`"type": "module"`). Source imports use `.js` extensions
- Node.js 18+ required (uses built-in `fetch`)
- All file operations use absolute paths from `process.cwd()`
- Domain Profile inheritance uses DFS traversal with cycle detection
- Task Templates use versioned filenames: `<id>@<version>.yaml`
- Soft deletion pattern: Set `deprecated: true` metadata instead of deleting files
- JSON Schema validation is mandatory for all template and instance operations
- Execution plans are declarative YAML files for human inspection before GO
- `.warpos/` directory is gitignored (staging area for execution plans)

## Testing strategy

Currently no test framework configured. When adding tests:
- Unit tests for validation logic (schema.ts)
- Integration tests for stores (CRUD operations)
- End-to-end tests for two-phase execution workflow
- Fixture-based tests for Domain Profile inheritance resolution

## Documentation

See `docs/` for detailed documentation:
- `docs/domain-profiles.md` - Domain Profile system
- `docs/task-templates.md` - Task Template library
- `docs/task-instances.md` - Task Instance generation
- `docs/mcd.md` - Main Context Document format

See `.claude/rules/` for development patterns:
- `.claude/rules/deterministic-execution.md` - Core execution pattern
- `.claude/rules/model-selection.md` - Model selection strategy
- `.claude/rules/task-breakdown.md` - Atomic task decomposition
- `.claude/rules/verification-pattern.md` - Verification workflow

See `CLAUDE.md` for project-level Claude Code instructions.
