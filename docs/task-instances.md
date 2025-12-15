# Task Instances
Task Instances are project-specific instantiations of Atomic Task Templates (ATTs).

## Directory
- `task-instances/<projectSlug>/<instanceId>.json`

## What is "locked"
A task instance is intended to be auditable and reproducible by recording:
- template identity: `template_id` + `template_version`
- validated `inputs`
- a reference to the MCD plus `mcd_hash`
- selected `domain_profiles`

## Relationship to GO/NO-GO
Instances are separate from execution.
- "Prepare" generates a declarative execution plan and stores it under `.warpos/plans/`.
- "Execute" applies exactly that plan after GO.

(Implementation of prepare/execute will be added in Step 6.)

## MCP Tools

### task_instance_list
**Description**: List Task Instance IDs for a given project.

**Input**:
```json
{ "project_slug": "my-project" }
```

**Output**:
```json
{ "instances": ["uuid1", "uuid2", "uuid3"] }
```

### task_instance_get
**Description**: Get a Task Instance by project slug and instance ID.

**Input**:
```json
{
  "project_slug": "my-project",
  "instance_id": "uuid1"
}
```

**Output**:
```json
{
  "instance": {
    "instance_id": "uuid1",
    "project_slug": "my-project",
    "template_id": "implement-feature",
    "template_version": 1,
    "inputs": { "feature_name": "auth" },
    "mcd_hash": "sha256...",
    "domain_profiles": ["developer", "backend"],
    "created_at": "2024-01-15T10:30:00Z",
    "status": "pending"
  }
}
```

### task_instance_generate
**Description**: Generate a new Task Instance from a template. Validates inputs against the template schema and creates a locked instance for execution.

**Input**:
```json
{
  "project_slug": "my-project",
  "template_id": "implement-feature",
  "template_version": 1,
  "inputs": { "feature_name": "auth", "complexity": "medium" },
  "mcd_hash": "abc123...",
  "domain_profiles": ["developer", "backend"]
}
```

**Output**:
```json
{
  "ok": true,
  "instance_id": "generated-uuid",
  "instance": {
    "instance_id": "generated-uuid",
    "project_slug": "my-project",
    "template_id": "implement-feature",
    "template_version": 1,
    "inputs": { "feature_name": "auth", "complexity": "medium" },
    "mcd_hash": "abc123...",
    "domain_profiles": ["developer", "backend"],
    "created_at": "2024-01-15T10:30:00Z",
    "status": "pending"
  }
}
```

**Notes**:
- Validates inputs against template's `inputs_schema` before creating instance
- Returns error if validation fails
- Generates unique UUID for instance_id
- Stores instance at `task-instances/<projectSlug>/<instanceId>.json`