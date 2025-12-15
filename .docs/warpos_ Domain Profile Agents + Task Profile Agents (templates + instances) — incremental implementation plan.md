# Problem statement
Extend this repository from a single `zai_plan` tool into a profile-driven MCP server that supports:
* Domain Profile Agents (behavioral + methodological frameworks with inheritance).
* Task Profile Agents implemented as a deterministic pipeline: Atomic Task Templates (stable library) → Task Instances (MCD-instantiated, version-pinned) → Task execution with strict input/output validation.
* Clear documentation so non-technical users can author/operate profiles and templates.
# Current state (as of this repo)
* `src/index.ts` exposes one MCP tool (`zai_plan`) over stdio.
* `src/zaiClient.ts` calls z.ai via `fetch`, using env vars and a placeholder request/response mapping.
* No lint/test scripts or docs system beyond `README.md`.
# Target outcomes
* A file-backed profile/template system with reproducible builds:
    * Domain profiles: YAML with inheritance (AXIVO-style).
    * MCDs: stored as Markdown (authored by Warp), retrievable by MCP.
    * Task templates: YAML, strongly typed (JSON Schema for inputs/outputs) and linear steps.
    * Task instances: JSON artifacts pinned to a template version and an MCD hash/selection.
* A set of MCP tools to list/get/put/delete templates and profiles; generate instances; run tasks.
* Determinism boundaries:
    * Validate all tool inputs.
    * For JSON-returning tools: parse JSON, validate against schema, optionally do one repair pass.
* Documentation explaining: concepts, file formats, versioning, and end-to-end workflow.
# Proposed repository structure
Add these directories:
* `profiles/domains/` (Domain Profile YAMLs)
* `task-templates/` (Atomic Task Template YAMLs)
* `task-instances/` (generated Task Instance JSON artifacts)
* `mcd/` (MCD markdown files)
* `docs/` (end-user documentation)
Add these modules:
* `src/profileStore.ts` (load/parse domain profiles, resolve inheritance)
* `src/mcdStore.ts` (store/get/list MCDs)
* `src/templateStore.ts` (task template CRUD + validation)
* `src/instanceStore.ts` (task instance generation + persistence)
* `src/taskExecutor.ts` (execute a task instance deterministically)
* `src/schema.ts` (shared JSON Schema helpers + validator)
# Data formats (first-pass specs)
## Domain Profile YAML
* Must support:
    * `description: string`
    * optional `relations: [{ target: string, type: "inherits" }]`
    * one or more sections that contain `profile.observations: string[]` and/or `*.observations: string[]` (methodology groups)
* Store under `profiles/domains/<id>.yaml`.
## MCD (Main Context Document)
* Store as markdown under `mcd/<projectSlug>.md`.
* Treat as source-of-truth text; optional future step: support extracted sections via frontmatter or a parallel JSON file.
## Atomic Task Template (ATT) YAML
* Store under `task-templates/<templateId>@<version>.yaml` (explicit versioning).
* Required fields:
    * `id: string`
    * `version: integer`
    * `description: string`
    * `inputs_schema: object` (JSON Schema)
    * `outputs_schema: object` (JSON Schema)
    * `steps: [{ id: string, instruction: string, expected_artifacts?: ... }]` (linear list)
    * optional `verification: [{ id: string, command: string }]`
    * optional `domain_profiles_default: string[]`
    * optional `mcd_selectors: string[]` (constrained selectors used by instance generation)
## Task Instance (ATI) JSON
* Store under `task-instances/<projectSlug>/<instanceId>.json`.
* Required fields:
    * `instance_id`, `project_slug`
    * `template_id`, `template_version`
    * `inputs` (validated against template `inputs_schema`)
    * `mcd_ref` and `mcd_hash`
    * `domain_profiles` (resolved defaults + overrides)
    * optional `locked_expectations` (future hook for additional invariants)
# MCP tool surface
The tool list is organized so each phase can add a small set without breaking earlier tools.
## Phase-1 tools (read-only building blocks)
* `domain_profile_list`
* `domain_profile_get`
* `task_template_list`
* `task_template_get`
## Phase-2 tools (mutation / library management)
* `domain_profile_put` (create/update YAML)
* `domain_profile_delete` (prefer “deprecate” metadata; delete only if explicitly allowed)
* `task_template_put` (add/update versioned template)
* `task_template_delete` (same guidance)
## Phase-3 tools (MCD lifecycle)
* `mcd_list`
* `mcd_get`
* `mcd_put`
## Phase-4 tools (instantiation)
* `task_instance_generate`
* `task_instance_list`
* `task_instance_get`
## Phase-5 tools (execution)
* `task_run_json`
    * Takes an `instance_id` (and `project_slug` if needed).
    * Executes the instance.
    * Returns a JSON object validated against the template `outputs_schema`.
    * Includes `verification_results` (command + exit code + captured stderr/stdout) as a sibling field if desired.
# Determinism & safety rules (server-side)
* All MCP tool inputs must be validated; reject unknown fields (use `additionalProperties: false`).
* For task execution tools:
    * Model temperature defaults to 0.
    * Require “JSON only” output for `task_run_json`.
    * Validate output against `outputs_schema`.
    * If invalid, allow a single corrective round trip by providing validation errors and requesting corrected JSON only.
* File operations should be explicit:
    * Task templates and profiles are stored only in their respective directories.
    * Task instances are append-only artifacts (do not rewrite by default; generate new instance IDs).
# Incremental implementation plan (progressive path)
## Step 0 — Baseline cleanup and scaffolding
* Add directories: `profiles/`, `task-templates/`, `task-instances/`, `mcd/`, `docs/`.
* Add a minimal “smoke” doc outline:
    * `docs/domain-profiles.md`
    * `docs/task-templates.md`
    * `docs/task-instances.md`
    * `docs/mcd.md`
* Add a small example Domain Profile and Task Template in the new directories.
* Update `README.md` to point to the new docs and clarify the end-to-end workflow.
## Step 1 — Add schema validation + YAML parsing foundation
* Add explicit dependencies (so we’re not relying on transitive installs):
    * YAML parser (e.g. `yaml`)
    * JSON Schema validator (e.g. `ajv` + `ajv-formats`)
* Implement `src/schema.ts`:
    * create Ajv instance
    * helper to validate objects and surface human-readable errors
* Implement `src/profileStore.ts`:
    * load YAML, parse, basic shape checks
    * resolve `relations` inheritance with cycle detection
    * compile a “framework prompt” string (grouped headings + observations)
Documentation update:
* `docs/domain-profiles.md`: file layout, inheritance semantics, and how observations are compiled.
## Step 2 — Add Domain Profile MCP tools
* Add MCP tool handlers:
    * `domain_profile_list`
    * `domain_profile_get`
    * `domain_profile_put`
    * `domain_profile_delete` (or `domain_profile_deprecate`)
* Add one “execution” tool that proves the pipeline:
    * `domain_agent_run`: compiles selected domain profiles and calls z.ai with the compiled framework + user input.
Documentation update:
* `docs/domain-profiles.md`: include a minimal “run” example (inputs/outputs) and how to author a profile.
## Step 3 — Add MCD storage tools
* Implement `src/mcdStore.ts`:
    * store/read/list MCD markdown files under `mcd/`
    * compute and persist a content hash
* Add MCP tool handlers:
    * `mcd_list`, `mcd_get`, `mcd_put`
Documentation update:
* `docs/mcd.md`: what an MCD is in this system, expected structure (lightweight), and how Warp hands it to MCP.
## Step 4 — Add Task Template library (CRUD + listing)
* Implement `src/templateStore.ts`:
    * list/get templates (support `id@version`)
    * validate template files include required fields
    * enforce versioned filename convention
* Add MCP tool handlers:
    * `task_template_list`
    * `task_template_get`
    * `task_template_put`
    * `task_template_delete` (or deprecate)
Documentation update:
* `docs/task-templates.md`: the ATT schema, atomicity rules, versioning rules, and examples.
## Step 5 — Task Instance generation from MCD
* Implement `src/instanceStore.ts`:
    * take `template_id`, `template_version`, `project_slug`, `mcd_ref`, and `inputs`
    * validate inputs vs `inputs_schema`
    * compute `mcd_hash`
    * write instance JSON (append-only)
* Add MCP tool handlers:
    * `task_instance_generate`
    * `task_instance_list`
    * `task_instance_get`
Documentation update:
* `docs/task-instances.md`: what gets “locked” (template version + MCD hash + validated inputs), and how chains are represented.
## Step 6 — Deterministic Task execution
* Implement `src/taskExecutor.ts`:
    * load instance + template
    * compose a strict prompt that includes:
        * domain framework (compiled from domain profiles)
        * the template’s steps
        * the instance inputs
        * hard requirement: output JSON only matching `outputs_schema`
    * call z.ai and validate JSON output
    * optionally run `verification` commands (if present) and return results
* Add MCP tool handler:
    * `task_run_json`
Documentation update:
* `docs/task-instances.md`: execution model, validation failure behavior, repair loop semantics.
## Step 7 — Testing & developer ergonomics
* Add a minimal test strategy without heavy framework changes:
    * Add `npm run test` using Node’s built-in `node --test` and a `tests/` folder.
    * Unit tests for:
        * inheritance resolution + cycle detection
        * JSON Schema validation errors
        * template parsing/validation
        * instance generation (hashing + pinning)
* Add a manual smoke script (optional) to call the MCP server over stdio and exercise:
    * `tools/list`
    * `domain_profile_list`
    * `task_template_list`
Documentation update:
* Update `WARP.md` with new commands (`npm run test`) and the new architecture modules.
# Open questions to confirm before Step 6
* Should template deletion be hard delete, or “deprecate” only (recommended)?
> DEPRECATE
* Should verification commands run by default in `task_run_json`, or be opt-in (`run_verification: true`)?
> RUN BY DEFAULT. CREATE CONFIGURATION MECHANISM TO SWITCH BETWEEN "RUN BY DEFAULT" / "OPT-IN"
* Should task execution be permitted to edit the repo (write files) from within MCP, or is this MCP intended only to generate plans/specs and let Warp apply edits? (This affects how strict `allowed_tools` is enforced.)
> THIS IS MCP IS WHAT WILL DO "THE WORK". BE ADVISED: THIS MCP MUST DO A "PREPARATION" STAGE BEFORE "EXECUTION" TO SAVE PLANS/SPECS IN AN OPTIMAL DIRECTORY STRUCTURE (e.g., "."mcp-name") FOR INSPECTION BY USER/WARP. THERE IS AS SUCH A POINT OF "GO/NO-GO" WHICH USER/WARP PROVIDE. 
# Acceptance criteria
* A non-technical user can:
    * add/list/remove (or deprecate) task templates via MCP tools
    * provide an MCD and generate task instances pinned to template versions
    * run a task instance and get validated JSON output (or a clear validation error)
* The system is auditable:
    * instances record template version + MCD hash
    * templates are versioned and retrievable
    * domain frameworks are reproducibly compiled from YAML + inheritance
