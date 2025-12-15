# warpos - MCP Server for Deterministic Task Execution

## Project Overview

**warpos** is a TypeScript/Node.js MCP (Model Context Protocol) server that enables deterministic task execution through:
- **Domain Profile Agents**: Framework/methodology providers (behavioral + technical constraints)
- **Task Profile Agents**: Atomic, deterministic task executors
- **Two-phase execution**: Preparation (safe, inspectable) → Execution (side-effects after approval)

**Core Philosophy**: Transform ambiguous user intent into deterministic execution through explicit planning and atomic task decomposition.

## 🎯 Execution Pattern: Deterministic Linear Execution

**This project follows a strict deterministic execution pattern** pioneered during initial implementation. This pattern is:
- **Plan-first, execute-second**: Create explicit plans before any implementation
- **Linear, atomic steps**: Each step has exactly one next step
- **Minimal exploration**: No "what if" branching; execute the plan
- **High-confidence**: Pre-made decisions eliminate overthinking
- **Verifiable**: Each step has clear acceptance criteria

See `.claude/rules/deterministic-execution.md` for complete pattern details.

## 🤖 Model Selection Strategy

**Critical Insight**: Deterministic execution enables efficient model selection:

### Planning Phase (use powerful model: Sonnet/Opus)
- Analyzing requirements
- Designing architecture
- Breaking down into atomic tasks
- Creating execution plans
- Domain Profile compilation

### Execution Phase (use fast model: Haiku)
- Following explicit plans
- Implementing atomic tasks
- Running verification steps
- Applying deterministic transformations

**Why this works**: Once you have a clear plan with atomic steps, a lighter model can execute perfectly because there's no complex reasoning needed - just clear inputs/outputs with explicit validation criteria.

See `.claude/rules/model-selection.md` for detailed guidance.

## 📋 Current Project State

**Completed (Steps 0-4)**:
- ✅ Directory scaffolding + baseline docs
- ✅ YAML parsing + JSON Schema validation (src/schema.ts)
- ✅ Domain Profile tools (src/profileStore.ts + MCP tools)
- ✅ MCD storage tools (src/mcdStore.ts + MCP tools)
- ✅ Task Template library tools (src/templateStore.ts + MCP tools)

**Remaining (Steps 5-7)**:
- ⏳ Step 5: Task Instance generation tools
- ⏳ Step 6: Two-phase execution (prepare + execute)
- ⏳ Step 7: Tests + documentation updates

## 🔧 Development Commands

```bash
npm install          # Install dependencies
npm run build        # TypeScript → dist/
npm start            # Run compiled MCP server (stdio)
npm run dev          # Dev mode (run TS directly via ts-node)
```

**No linting/testing configured yet** - will be added in Step 7.

## 🌳 Project Structure

```
warpos/
├── src/
│   ├── index.ts           # MCP server entrypoint + tool handlers
│   ├── schema.ts          # JSON Schema validation helpers
│   ├── profileStore.ts    # Domain Profile loading/inheritance/compilation
│   ├── mcdStore.ts        # Main Context Document storage + hashing
│   ├── templateStore.ts   # Task Template library (versioned)
│   ├── instanceStore.ts   # [Step 5] Task Instance generation
│   ├── taskExecutor.ts    # [Step 6] Two-phase execution (prepare/execute)
│   └── zaiClient.ts       # z.ai API client
├── profiles/domains/      # Domain Profile YAMLs (with inheritance)
├── task-templates/        # Atomic Task Template library (versioned)
├── task-instances/        # Generated Task Instances per project
├── mcd/                   # Main Context Documents per project
├── docs/                  # Implementation documentation
└── .warpos/               # [Step 6] Staging area for execution plans
```

## 🚨 Critical Rules for This Project

1. **Follow the plan** - Steps 0-7 are explicit; execute linearly
2. **Use TodoWrite** - Track progress through multi-step implementation
3. **Build after changes** - Run `npm run build` to verify TypeScript compiles
4. **Verify incrementally** - Each step has acceptance criteria; check them
5. **No exploratory branching** - If blocked, stop and report; don't explore alternatives
6. **MANDATORY: Check model selection** - Before ANY implementation, run the decision checklist in `.claude/rules/model-selection-enforcement.md`
7. **Delegate execution to Haiku** - When explicit plan exists, use Task tool with `model: "haiku"` (10x cheaper, 2-3x faster)

## 📚 Key Documentation Files

- `docs/domain-profiles.md` - Domain Profile system + MCP tools
- `docs/task-templates.md` - Task Template library + versioning
- `docs/task-instances.md` - Task Instance generation (Step 5)
- `docs/mcd.md` - Main Context Document format
- `WARP.md` - Warp-specific guidance (will update in Step 7)

## 🔗 Related Concepts

This project implements patterns from:
- **Agent-MCP**: Linear task decomposition philosophy ([github.com/rinadelph/Agent-MCP](https://github.com/rinadelph/Agent-MCP))
- **AXIVO profiles**: Framework-driven agent design with inheritance
- **Anatomy of Determinism**: "Anything not expressible as Step 1 → Step N isn't atomic enough"

## ⚠️ Working with This Codebase

**When continuing implementation:**
1. Read the todo list to see current progress
2. Load the current step's requirements
3. Execute the step linearly (don't explore alternatives)
4. Verify acceptance criteria (build passes, docs updated)
5. Mark complete and move to next step

**When blocked:**
- Don't explore alternatives or "think through" solutions
- Report the blocker with specific details
- Wait for explicit decision/guidance

**Model selection guidance:**
- Use Sonnet/Opus when: Planning new features, architectural decisions, breaking down tasks
- Use Haiku when: Following explicit plans, implementing atomic steps, running verifications
