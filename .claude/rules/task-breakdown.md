# Task Breakdown Guidelines

## The Goal: Atomic Tasks

**An atomic task is**:
- Small enough to execute in one focused session
- Self-contained with clear inputs/outputs
- Verifiable with explicit success criteria
- Independent (minimal dependencies on other tasks)

**"Atomic" means**: If you can't execute it linearly without branching, it's not atomic enough.

## The Anatomy of Determinism

**Key principle from Agent-MCP**:
> "Anything not expressible as Step 1 → Step N isn't atomic enough."

If a task requires exploration, decision-making, or "figure it out" - it needs to be broken down further.

## Good Task Breakdown Example

### ❌ Bad (Too Large, Ambiguous)
```
Task: Implement user authentication
```

**Problems**:
- Too many unknowns (which auth method? database? API?)
- Requires architectural decisions during execution
- Can't be verified with a single test
- Single agent would be overwhelmed

### ✅ Good (Atomic Chain)
```
Task Chain: User Authentication

Task 1: Database Layer
  - Create users table migration
  - Add password_hash, email, created_at columns
  - Create unique index on email
  - Verify: migration runs successfully

Task 2: Password Hashing Service
  - Implement hashPassword(plaintext) -> hash
  - Implement verifyPassword(plaintext, hash) -> boolean
  - Use bcrypt library
  - Verify: unit tests pass

Task 3: Registration Endpoint
  - POST /api/auth/register
  - Input: { email, password }
  - Output: { user_id, token }
  - Verify: curl test succeeds

Task 4: Login Endpoint
  - POST /api/auth/login
  - Input: { email, password }
  - Output: { user_id, token }
  - Verify: curl test succeeds

Task 5: Frontend Integration
  - Create RegisterForm component
  - Create LoginForm component
  - Wire to API endpoints
  - Verify: UI flows work end-to-end
```

**Why this works**:
- Each task is 1-3 hours max
- Clear dependencies (DB → Service → API → UI)
- Explicit verification for each task
- Can use Haiku for execution

## Decomposition Rules

### Rule 1: One Deliverable Per Task
- ❌ "Implement auth and add tests"
- ✅ "Implement auth" + separate task "Add auth tests"

### Rule 2: Explicit File Paths
- ❌ "Create the store module"
- ✅ "Create src/templateStore.ts with loadTemplate(), putTemplate() methods"

### Rule 3: Concrete Verification
- ❌ "Make sure it works"
- ✅ "Run npm run build - should compile with 0 errors"

### Rule 4: No Design Decisions During Execution
- ❌ "Add caching (decide on Redis vs memory)"
- ✅ "Add Redis caching using ioredis library"

### Rule 5: Linear Dependencies
```
Good (linear chain):
Task 1 → Task 2 → Task 3

Bad (branching):
         ┌→ Task 2a
Task 1 ──┤
         └→ Task 2b
```

If branching is required, create separate chains:
- Chain A: Task 1 → Task 2a → Task 3a
- Chain B: Task 1 → Task 2b → Task 3b

## Task Size Guidelines

### Too Small (< 30 minutes)
- Overhead > value
- Example: "Add import statement to file"
- **Solution**: Combine with related task

### Just Right (1-3 hours)
- Focused session
- Example: "Implement Task Template store with CRUD operations"
- Can verify completion clearly

### Too Large (> 3 hours)
- Requires breaks and context switching
- Example: "Build entire authentication system"
- **Solution**: Break into smaller tasks

## Verification Criteria Templates

### Code Implementation
```
Verify:
- File created: <exact path>
- npm run build passes (0 errors)
- Exports: <list expected exports>
```

### API Endpoint
```
Verify:
- curl POST /api/endpoint -d '{"test":"data"}' returns 200
- Response matches schema: { ... }
- Database record created
```

### Component/UI
```
Verify:
- Component renders without errors
- Props: <list required props>
- User can: <action 1>, <action 2>
```

### Refactoring
```
Verify:
- All existing tests still pass
- No new linting errors
- Functionality unchanged
```

## When to Break Down Further

**Signs a task is too large**:
1. Can't write clear acceptance criteria
2. Requires "figure out how to..."
3. Multiple "and" clauses in description
4. Would take > 3 hours focused work
5. Requires architectural decisions

**Action**: Break into subtasks with explicit handoffs.

## Example: Real World (warpos Steps 0-7)

### Original Task (Too Large)
```
Task: Build MCP server with Domain Profiles and Task Templates
```

### Actual Breakdown (Atomic)
```
Step 0: Scaffold directories + baseline docs
  - Create profiles/, task-templates/, docs/
  - Add example files
  - Verify: directories exist, npm run build works

Step 1: Add YAML parsing + validation
  - Install yaml, ajv, ajv-formats
  - Create src/schema.ts with validation helpers
  - Verify: npm run build passes

Step 2: Domain Profile MCP tools
  - Create src/profileStore.ts
  - Add 5 MCP tools to src/index.ts
  - Update docs/domain-profiles.md
  - Verify: npm run build passes, tools listed

Step 3: MCD storage tools
  - Create src/mcdStore.ts
  - Add 3 MCP tools to src/index.ts
  - Update docs/mcd.md
  - Verify: npm run build passes

Step 4: Task Template library tools
  - Create src/templateStore.ts
  - Add 4 MCP tools to src/index.ts
  - Update docs/task-templates.md
  - Verify: npm run build passes

[Steps 5-7 continue similarly...]
```

**Result**: Each step is 1-2 hours, clear deliverables, explicit verification.

## Task Templates (Reusable Patterns)

### CRUD API Endpoint Task
```
Task: Add <entity> CRUD endpoints
  - POST /api/<entity> (create)
  - GET /api/<entity>/:id (read)
  - PUT /api/<entity>/:id (update)
  - DELETE /api/<entity>/:id (delete)
  Verify: All 4 endpoints return expected status codes
```

### Database Migration Task
```
Task: Create <table> migration
  - Add migration file: migrations/YYYYMMDD_create_<table>.sql
  - Columns: <list columns and types>
  - Indexes: <list indexes>
  - Run migration: npm run migrate
  Verify: Table exists in database, schema matches
```

### Component Task
```
Task: Create <Component> component
  - File: src/components/<Component>.tsx
  - Props: <TypeScript interface>
  - Renders: <description>
  Verify: Component mounts without errors, props typed
```

## Integration with warpos

**Task Templates** (in task-templates/*.yaml) should follow these guidelines:
- Each template defines ONE atomic operation
- Inputs/outputs are explicit JSON schemas
- Steps are numbered and linear
- Verification commands are concrete

**Task Instances** (generated from templates) inherit this atomicity:
- Filled from MCD context
- Locked schemas and steps
- Ready for deterministic execution by Haiku
