# Verification Pattern: Build → Verify → Next

## Core Principle

**Never move to the next step without verifying the current step is complete and correct.**

Verification is not optional - it's the gate that ensures quality and catches errors early.

## The Three-Step Pattern

### 1. Build
- Implement exactly what the current step specifies
- No more, no less
- Focus on the deliverables

### 2. Verify
- Run acceptance criteria checks
- Confirm success before proceeding
- If verification fails, fix immediately

### 3. Next
- Only move to next step when current step verified
- Mark current step complete
- Load next step requirements

## Verification Checklist (Universal)

**Every step must verify**:
- ✅ **Build compiles**: `npm run build` (or equivalent) passes
- ✅ **Files exist**: All specified files created/modified
- ✅ **No regressions**: Existing functionality still works
- ✅ **Acceptance criteria met**: Step-specific checks pass

**Optional (step-dependent)**:
- Tests pass (if step involves testable code)
- Linter clean (if configured)
- Documentation updated (if step requires it)

## Step-Specific Verification

### Code Implementation Steps
```bash
# 1. Build check
npm run build

# 2. Verify exports (if TypeScript)
# Check dist/ has expected files

# 3. Verify imports work
# If step created src/foo.ts, verify it imports correctly
```

### MCP Tool Addition Steps
```bash
# 1. Build check
npm run build

# 2. Verify tool appears in list
# Start server, call ListTools, verify new tool present

# 3. Test basic invocation
# Call the new tool with valid input, verify no crash
```

### Documentation Steps
```bash
# 1. Verify file exists
ls docs/new-file.md

# 2. Verify content
# Check that documented tools/APIs match actual implementation

# 3. Verify links work
# If doc links to other files, verify they exist
```

## Common Verification Commands

### TypeScript/Node Projects
```bash
npm run build          # Compile check
npm test              # Run tests (if configured)
npm run lint          # Linting (if configured)
node dist/index.js    # Smoke test (if applicable)
```

### Python Projects
```bash
python -m build       # Build check
pytest                # Run tests
mypy src/             # Type checking
python -m src.main    # Smoke test
```

### General
```bash
git status            # Verify expected files modified
git diff              # Review changes make sense
ls -la <path>         # Verify file/directory created
cat <file>            # Verify file contents
```

## What "Build Passes" Means

**Successful build**:
- Exit code 0
- No error messages in output
- All expected output files created
- No warnings (unless pre-existing)

**Failed build**:
- Exit code non-zero
- Error messages in stdout/stderr
- Missing output files
- TypeScript compilation errors

**Action on failure**: Fix immediately, re-run, don't proceed.

## Red Flags (Insufficient Verification)

🚩 **"It should work"** - Not verified, just assumed
🚩 **"I'll test it later"** - Deferred verification
🚩 **"Build passed last time"** - Not re-verified after changes
🚩 **"Looks good to me"** - Visual check instead of running commands
🚩 **"I trust my implementation"** - Confidence without evidence

## Green Flags (Good Verification)

✅ **Command output shown** - `npm run build` output in response
✅ **Specific evidence** - "Created src/foo.ts, exports 3 functions"
✅ **Error-free output** - "0 errors, 0 warnings"
✅ **Before moving on** - "Verified, now proceeding to Step 5"

## Example: Good Verification Flow

```
Step 4: Implement Task Template library tools

[implements src/templateStore.ts]
[adds MCP tools to src/index.ts]
[updates docs/task-templates.md]

VERIFY:
$ npm run build
> warpos@0.1.0 build
> tsc -p tsconfig.json

✅ Build passed (0 errors)

$ ls src/templateStore.ts
src/templateStore.ts

✅ File exists

$ grep "task_template_list" src/index.ts
    name: 'task_template_list',

✅ MCP tool added

$ ls docs/task-templates.md
docs/task-templates.md

✅ Documentation updated

Step 4 VERIFIED ✅
Moving to Step 5...
```

## Example: Bad Verification Flow

```
Step 4: Implement Task Template library tools

[implements src/templateStore.ts]
[adds MCP tools to src/index.ts]

I think this looks good, the build should pass.
Moving to Step 5...

❌ WRONG - Did not verify!
❌ Did not run npm run build
❌ Did not check files exist
❌ Did not update documentation
```

## When Verification Fails

**Immediate actions**:
1. Read error message carefully
2. Identify root cause
3. Fix the specific error
4. Re-run verification
5. Repeat until verified

**Don't**:
- ❌ Ignore errors and continue
- ❌ "Fix it later"
- ❌ Assume it's a transient issue
- ❌ Move to next step unverified

## Verification in warpos Task Execution

**The warpos system implements verification at two levels**:

### 1. Step-Level (during implementation)
```typescript
// After each implementation step
await verifyStep({
  build_passes: true,
  files_created: ['src/foo.ts'],
  docs_updated: ['docs/foo.md']
})
```

### 2. Task-Level (in Task Templates)
```yaml
verification:
  - id: build
    command: npm run build
  - id: test
    command: npm test
  - id: integration
    command: curl -X POST http://localhost:3000/api/test
```

**Execution flow**:
1. Load task template
2. Execute steps sequentially
3. Run verification commands
4. Return results with pass/fail for each verification

## Verification vs Testing

**Verification** (gate for proceeding):
- Did I complete what this step required?
- Does the build still work?
- Are the deliverables present?

**Testing** (quality assurance):
- Does the code behave correctly?
- Are edge cases handled?
- Will it work in production?

**Both are important**, but verification is the minimum gate for moving to the next step.

## Efficiency Note

**Verification is fast** - typical checks take seconds:
- `npm run build`: 5-10 seconds
- `ls <file>`: < 1 second
- `grep <pattern> <file>`: < 1 second

**Fixing unverified bugs is slow** - debugging issues found 5 steps later takes minutes to hours.

**Trade-off**: Spend 15 seconds verifying now vs 15 minutes debugging later.

## Integration with Model Selection

**Haiku is perfect for verification**:
- Clear success criteria
- Deterministic pass/fail
- No judgment needed

**Example verification script**:
```typescript
// Haiku can execute this perfectly
async function verifyStep4() {
  const build = await exec('npm run build')
  const file = await exists('src/templateStore.ts')
  const docs = await exists('docs/task-templates.md')

  return {
    build_passed: build.exitCode === 0,
    file_created: file,
    docs_updated: docs,
    overall: build.exitCode === 0 && file && docs
  }
}
```

No reasoning needed - just execute and report.
