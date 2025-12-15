# Atomic Task Templates
Atomic Task Templates (ATTs) are the stable library of deterministic "task contracts".

## Directory
- `task-templates/`

## Versioning
Templates are versioned via filename:
- `task-templates/<templateId>@<version>.yaml`

A change to `inputs_schema` or `outputs_schema` should create a new version.

## Required fields (first pass)
- `id: string`
- `version: integer`
- `description: string`
- `inputs_schema: object` (JSON Schema)
- `outputs_schema: object` (JSON Schema)
- `steps: [{ id: string, instruction: string }]` (linear list)

## Optional fields
- `verification: [{ id: string, command: string }]`
- `domain_profiles_default: string[]`
- `mcd_selectors: string[]`

## Example
See `task-templates/example.echo@1.yaml`.

## MCP Tools

The following MCP tools are available for managing Task Templates:

### task_template_list
Lists all available Task Template IDs (latest version of each).
- **Input:** None
- **Output:** `{ templates: string[] }`

### task_template_get
Retrieves a Task Template by ID and optional version.
- **Input:** `{ id: string, version?: number }`
- **Output:** `{ template: TaskTemplate, yaml: string }`
- If version is not specified, returns the latest version.

### task_template_put
Creates or updates a Task Template.
- **Input:** `{ template: TaskTemplate }`
- **Output:** `{ ok: true, id: string, version: number, file: string }`
- The template object must include all required fields (id, version, description, inputs_schema, outputs_schema, steps).
- Validates against the Task Template schema before saving.

### task_template_delete
Deprecates (soft deletes) a Task Template.
- **Input:** `{ id: string, version: number, reason?: string }`
- **Output:** `{ ok: true, id: string, version: number, deprecated: true }`
- Does not remove the file; instead marks it as deprecated with metadata.