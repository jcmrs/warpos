# Model Selection Strategy

## Core Insight

**Deterministic execution enables efficient model selection.**

Once you have a clear plan with atomic steps, a lighter/faster model can execute perfectly because:
- ✅ No complex reasoning needed
- ✅ Clear inputs/outputs defined
- ✅ Validation criteria explicit
- ✅ No ambiguity requiring judgment

## Two-Phase Model Selection

### Phase 1: Planning (Use Powerful Model)

**Model**: Sonnet, Opus, or equivalent
**Token budget**: Higher (planning is expensive but one-time)
**Use for**:
- Analyzing requirements and user intent
- Designing system architecture
- Breaking complex tasks into atomic steps
- Creating execution plans with acceptance criteria
- Compiling Domain Profiles into framework prompts
- Making architectural trade-off decisions

**Why powerful model needed**:
- Requires deep reasoning about system design
- Must consider edge cases and failure modes
- Needs to balance competing constraints
- Creates the "script" that lighter models will follow

**Example tasks**:
- "Design the Task Instance generation system"
- "Create a plan for two-phase execution with GO/NO-GO approval"
- "Break down 'user authentication' into atomic tasks"

### Phase 2: Execution (Use Fast Model)

**Model**: Haiku or equivalent
**Token budget**: Lower (execution is cheap and repeated)
**Use for**:
- Implementing from explicit plans
- Following atomic task steps
- Running verification commands
- Applying deterministic transformations
- Validating against defined schemas
- Generating code from templates

**Why lighter model sufficient**:
- Plan provides all context and decisions
- Steps are atomic with clear boundaries
- No judgment calls or trade-offs needed
- Success criteria are explicit

**Example tasks**:
- "Implement Step 4 from the plan"
- "Create src/templateStore.ts with the specified methods"
- "Add MCP tools as defined in the plan"
- "Run npm run build and verify it passes"

## Decision Matrix

| Task Type | Model | Why |
|-----------|-------|-----|
| Create implementation plan | Sonnet/Opus | Requires architectural reasoning |
| Break task into atomic steps | Sonnet/Opus | Requires decomposition expertise |
| Compile Domain Profile framework | Haiku | Follow defined inheritance rules |
| Implement Step N from plan | Haiku | Plan provides all context |
| Debug unknown error | Sonnet/Opus | Requires investigation and reasoning |
| Fix known error from plan | Haiku | Solution is defined in plan |
| Design API interface | Sonnet/Opus | Requires design judgment |
| Implement API from schema | Haiku | Schema defines implementation |
| Write documentation | Haiku | Content is clear from code/plan |
| Refactor without plan | Sonnet/Opus | Requires reasoning about improvements |
| Refactor with explicit steps | Haiku | Steps define transformations |

## Cost/Speed Trade-offs

### Planning Phase (Sonnet)
- **Cost**: Higher per token
- **Speed**: Slower
- **Frequency**: Once per feature/task
- **Value**: Creates the multiplier for execution

### Execution Phase (Haiku)
- **Cost**: Lower per token (~10x cheaper than Sonnet)
- **Speed**: Faster (~2-3x faster than Sonnet)
- **Frequency**: Repeated for each atomic step
- **Value**: Efficient, reliable implementation

**Example**: Creating a feature with 10 atomic steps
- Planning (Sonnet): 1 call, 2000 tokens, $0.06
- Execution (Haiku): 10 calls, 5000 tokens total, $0.025
- **Total savings**: 5x cheaper than using Sonnet for everything

## When the Pattern Breaks Down

**Signs you need Sonnet even in execution**:
- 🚩 Plan is ambiguous or incomplete
- 🚩 Encountering unexpected blockers
- 🚩 Requirements changed mid-implementation
- 🚩 Need to make architectural decisions

**Action**: Stop execution, switch to Sonnet for replanning.

## Practical Guidelines

### Use Haiku When:
- ✅ You have a numbered step plan (Step 0, 1, 2...)
- ✅ Each step has clear acceptance criteria
- ✅ File paths and deliverables are explicit
- ✅ Success means "plan executed correctly"

### Use Sonnet When:
- ✅ Creating a new plan from user requirements
- ✅ Making architectural design decisions
- ✅ Blocked and need to replan
- ✅ Requirements are ambiguous

### Never Use (Red Flags):
- ❌ Using Sonnet for "just in case" when Haiku would work
- ❌ Using Haiku when plan is incomplete
- ❌ Switching models mid-step unnecessarily

## Integration with warpos MCP Server

**The warpos system should implement this pattern**:

1. **Warp creates MCD** (Main Context Document)
   - User intent captured in human-friendly format

2. **Domain Profile Agent** (uses Sonnet)
   - Applies framework constraints
   - Compiles domain guidance
   - Creates architectural direction

3. **Task Chain Proposal** (uses Sonnet)
   - Breaks MCD into linear task chains
   - Defines atomic tasks with schemas
   - Creates execution manifests

4. **Task Execution** (uses Haiku)
   - Loads execution manifest
   - Executes atomic tasks deterministically
   - Validates outputs against schemas

**Result**: Expensive reasoning (Sonnet) happens once; cheap execution (Haiku) happens many times.

## Efficiency Example (Real World)

**Scenario**: Implement Steps 0-7 of warpos
- **Planning**: 1 Sonnet call, created complete plan
- **Execution**: 8 Haiku calls (one per step)
- **Verification**: Haiku for build checks

**Without model selection**:
- 9 Sonnet calls: ~18,000 tokens @ $0.015/1k = $0.27

**With model selection**:
- 1 Sonnet call: ~2,000 tokens @ $0.015/1k = $0.03
- 8 Haiku calls: ~8,000 tokens @ $0.0025/1k = $0.02
- **Total**: $0.05 (5x cheaper, 3x faster)

## Implementation in MCP Tools

**Recommended**: Add `model` parameter to task execution tools:

```typescript
task_prepare({
  instance_id: "...",
  model: "sonnet"  // Planning phase
})

task_execute({
  instance_id: "...",
  model: "haiku"   // Execution phase
})
```

This allows the MCP server to optimize costs automatically based on task phase.
