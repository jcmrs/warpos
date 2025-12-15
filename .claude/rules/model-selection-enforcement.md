# Model Selection Enforcement - Decision Checklist

**MANDATORY: Run this checklist before any implementation work.**

## Pre-Implementation Decision Tree

```
┌─────────────────────────────────────┐
│ About to implement/write code?     │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│ Do I have an explicit plan?         │
│ (numbered steps, clear deliverables)│
└─────┬───────────────────────┬───────┘
      │ YES                   │ NO
      ▼                       ▼
┌─────────────────┐    ┌──────────────────┐
│ STOP            │    │ Is this planning │
│ Use Task tool   │    │ or exploration?  │
│ model: "haiku"  │    └────┬─────────────┘
└─────────────────┘         │
                            ▼
                     ┌──────────────────┐
                     │ YES: Continue    │
                     │ with Sonnet      │
                     │ NO: Ask user     │
                     │ for plan first   │
                     └──────────────────┘
```

## Step-by-Step Checklist

**BEFORE writing any code, answer these questions:**

### 1. Plan Check
- [ ] Is there a numbered plan (Step 1, Step 2, etc.)?
- [ ] Are deliverables explicit (file paths, functions, schemas)?
- [ ] Are acceptance criteria clear?

**If ALL checked → Delegate to Haiku (see Step 2)**
**If ANY unchecked → Continue to Step 3**

### 2. Delegation to Haiku (Execution Phase)

When delegating, use this exact pattern:

```typescript
// Use Task tool with Haiku
Task({
  subagent_type: "general-purpose", // or appropriate agent
  model: "haiku",
  description: "Implement Step N",
  prompt: `Execute Step N from the plan:

[Copy exact step requirements from plan]

Deliverables:
- [List files to create/modify]

Acceptance Criteria:
- npm run build passes
- [Other criteria from plan]

Follow deterministic execution: read plan → implement exactly → verify → done.`
})
```

**Cost/Speed Impact:**
- Haiku: ~$0.0025/1k tokens (10x cheaper than Sonnet)
- Haiku: 2-3x faster than Sonnet
- For 3 steps @ 3k tokens each: Save ~$0.20, Save ~5 minutes

### 3. Planning Check (Continue with Sonnet)

Use Sonnet if answering YES to any:
- [ ] Need to make architectural decisions?
- [ ] Need to explore multiple approaches?
- [ ] Need to break down complex requirements?
- [ ] Need to design interfaces/schemas?
- [ ] Unclear what the user wants?

**If YES to any → Continue with Sonnet**
**If NO to all → Ask user for plan, then delegate to Haiku**

## Phase Indicators

### ✅ Use Haiku (Execution Signals)
- "Implement Step N"
- "Following the plan in..."
- "Create src/foo.ts with methods X, Y, Z"
- "Add MCP tools for..."
- Plan file exists with numbered steps
- Clear file paths and schemas provided
- Acceptance criteria are explicit

### ✅ Use Sonnet (Planning Signals)
- "Design a system for..."
- "What's the best approach to..."
- "Should we use X or Y?"
- "Break down this feature"
- No plan exists yet
- Requirements are ambiguous
- Need to explore trade-offs

## Red Flags - I'm Doing It Wrong

🚩 **"I'll implement this directly"** when a plan with steps exists
- ACTION: Stop, delegate to Haiku

🚩 **Starting to write code** without checking this checklist
- ACTION: Stop, run checklist

🚩 **"This is simple enough"** (bypassing delegation)
- ACTION: If plan exists, delegate anyway (builds habit, saves tokens)

🚩 **Writing multiple files** without using Haiku for execution
- ACTION: Stop, break into steps, delegate each to Haiku

## Examples - Correct Behavior

### Example 1: Continuing from Explicit Plan

**Scenario:** Steps 5-7 exist in conversation log with clear deliverables

**WRONG:**
```
✗ I'll implement Step 5 directly [proceeds to write code]
```

**CORRECT:**
```
✓ Step 5 has explicit plan: create src/instanceStore.ts, add 3 MCP tools
✓ Delegating to Haiku for execution

[Uses Task tool with model: "haiku"]
```

### Example 2: New Feature Request

**Scenario:** User says "Add user authentication"

**WRONG:**
```
✗ I'll create the auth system [starts implementing]
```

**CORRECT:**
```
✓ No plan exists, requirements unclear
✓ This is planning phase - need to design first
✓ Using Sonnet to:
  - Break down into atomic tasks
  - Design schemas and interfaces
  - Create execution plan
✓ Then delegate execution to Haiku
```

### Example 3: Simple Bug Fix

**Scenario:** User says "Fix typo in WARP.md line 42"

**WRONG:**
```
✗ This is too simple for delegation [fixes directly]
```

**CORRECT (Best Practice):**
```
✓ Simple task, but has clear steps:
  1. Read WARP.md
  2. Fix line 42
  3. Verify build
✓ Delegating to Haiku (builds habit, minimal overhead)
```

## Accountability

**Self-check after completing work:**
- [ ] Did I delegate execution to Haiku when plan existed?
- [ ] If I used Sonnet for execution, was it justified (planning phase)?
- [ ] Did I follow the decision tree?

**If NO to question 1:** I violated the pattern and wasted tokens/time.

## Integration with TodoWrite

When creating todos for multi-step work, include model selection:

```typescript
TodoWrite({
  todos: [
    {
      content: "Step 5: Implement instanceStore (DELEGATE TO HAIKU)",
      status: "pending",
      activeForm: "Delegating Step 5 to Haiku"
    }
  ]
})
```

## Bottom Line

**The rule is simple:**
- **Explicit plan exists** → Delegate to Haiku
- **No plan** → Plan with Sonnet, THEN delegate to Haiku
- **Never** → Use Sonnet for execution when Haiku can do it

**Violation = Waste.** Every time I execute with Sonnet when a plan exists, I waste:
- 10x more tokens ($$$)
- 2-3x more time
- The opportunity to prove the pattern works
