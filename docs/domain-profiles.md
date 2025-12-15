# Domain Profiles
Domain Profiles define reusable behavioral/technical/methodological frameworks as YAML files. Profiles may inherit from other profiles.

## Directory
- `profiles/domains/`

## Profile IDs
A profile ID is its path under `profiles/domains/` without the `.yaml` extension, using `/` separators.

Examples:
- File `profiles/domains/example/developer.yaml` → profile ID `example/developer`
- A relation target should use the same ID format.

## Intended YAML shape (first pass)
A domain profile is a YAML document with:
- `description: string`
- optional `relations:` array where each relation is `{ target: string, type: "inherits" }`
- one or more groups containing `observations: string[]`

The AXIVO-style convention typically looks like:
- `<name>_context.profile.observations: [...]`
- `<name>_methodology.<group>.observations: [...]`

## Inheritance
- `relations` form a directed graph.
- `inherits` means "pull in all observations from the target".
- Resolution order should be base → derived (more general first).

## How it is used
Domain profiles are compiled into a single "framework prompt" which is included as system instructions when calling z.ai.

## MCP tools (planned/implemented)
- `domain_profile_list`: list profile IDs
- `domain_profile_get`: fetch YAML for a profile ID
- `domain_profile_put`: create/update a profile by providing full YAML
- `domain_profile_delete`: deprecate a profile (writes deprecation metadata into YAML)
- `domain_agent_run`: run z.ai with one or more profiles applied (inheritance resolved)

## Example
See `profiles/domains/example/developer.yaml`.