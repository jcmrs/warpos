# Deterministic Execution Pattern

## Core Principle

**Deterministic execution** means: same input → same output, no exploration, no branching, just execute the plan.

## The Pattern (5 Steps)

### 1. Plan-First
- **Before any implementation**, create an explicit plan with:
  - Numbered steps (Step 0, 1, 2, ...)
  - Clear acceptance criteria for each step
  - Explicit dependencies between steps
  - File paths and concrete deliverables

**Example:**
```
Step 4: Implement Task Template library tools
- Create src/templateStore.ts
- Add task_template_list/get/put/delete MCP tools to src/index.ts
- Update docs/task-templates.md with tool documentation
- Verify: npm run build passes
```

### 2. Linear Execution
- Execute steps in order: 0 → 1 → 2 → ...
- **No parallel exploration** of alternatives
- **No "what if" scenarios** - the plan defines the path
- **No backtracking** - if blocked, stop and report

### 3. Minimal State Checking
- Check only what's necessary for the current step
- Don't read files "just in case"
- Don't validate things not needed for current step
- **Example**: If Step 4 needs src/schema.ts, read it. Don't read src/profileStore.ts "to understand the pattern."

### 4. High-Confidence Execution
- **No second-guessing** - the plan was validated during planning phase
- **No overthinking** - implement exactly what the step says
- **No "better ideas"** - execute the plan as written
- **Trust the plan** - it was created with full context

### 5. Tight Verification
- After each step: verify acceptance criteria
- **Build passes** - run `npm run build`
- **Docs updated** - if step says "update docs," verify it's done
- **Move to next step** - don't linger or "improve" the current step

## What This Eliminates

❌ **Exploratory branching** - "Let me try approach A... or maybe B..."
❌ **Overthinking** - "What if we also need to handle X?"
❌ **Premature optimization** - "While I'm here, let me also..."
❌ **Scope creep** - "This step could also include..."
❌ **Context switching** - "Let me check how profileStore does it..."

## What This Enables

✅ **Efficiency** - No wasted exploration
✅ **Reproducibility** - Same plan → same implementation
✅ **Clarity** - Easy to audit and verify
✅ **Speed** - No overthinking delays
✅ **Lighter models** - Haiku can execute plans that Sonnet created

## When to Use This Pattern

**Perfect for:**
- Implementing from explicit plans
- Following architectural decisions already made
- Executing atomic, well-defined tasks
- Refactoring with clear before/after states

**Not appropriate for:**
- Initial exploration of a problem space
- Architectural design decisions
- Research tasks ("what options exist?")
- Debugging unknown issues

## Red Flags (You're Violating the Pattern)

🚩 **Thinking "I wonder if..."** - Stop. Execute the plan.
🚩 **Reading files not mentioned in current step** - Stop. Focus.
🚩 **Considering alternative approaches** - Stop. Follow the plan.
🚩 **"While I'm here..."** - Stop. Complete current step only.
🚩 **Validating things not in acceptance criteria** - Stop. Ship it.

## Example: Bad vs Good

### ❌ Bad (Exploratory)
```
Step 4: Implement Task Template tools

Let me first explore how Domain Profiles work...
[reads profileStore.ts]
[reads mcdStore.ts]
[thinks about whether to use similar pattern]
[considers alternative storage approaches]
[implements with "improvements"]
[adds extra validation "just in case"]
```

### ✅ Good (Deterministic)
```
Step 4: Implement Task Template tools

[reads plan: create src/templateStore.ts]
[implements exactly what's specified]
[adds MCP tools to src/index.ts as planned]
[updates docs as planned]
[runs npm run build - passes]
[marks step complete, moves to Step 5]
```

## Efficiency Metrics

**Good deterministic execution:**
- 1 file read per file mentioned in step
- 1 build verification per step
- 0 exploratory branches
- Step complete in minutes, not hours

**Inefficient execution:**
- Multiple file reads "to understand patterns"
- Multiple build attempts
- Exploring alternatives
- Step takes hours due to overthinking

## Integration with Model Selection

- **Planning phase (Sonnet/Opus)**: Create the deterministic plan
- **Execution phase (Haiku)**: Follow the plan without deviation
- **Validation**: Both phases verify success criteria

The plan captures all the reasoning; execution just implements it.
