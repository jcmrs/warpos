# MCD (Main Context Document)
The MCD is authored outside MCP (in Warp) and is the source of truth for user intent, scope, constraints, and acceptance criteria.

## Directory
- `mcd/<projectSlug>.md`

## How it is used
- Task Instance generation references an MCD (and stores an `mcd_hash`).
- Domain Profiles provide the governing framework when interpreting an MCD.

## MCP tools (planned/implemented)
- `mcd_list`: list available project slugs
- `mcd_get`: fetch MCD markdown + metadata
- `mcd_put`: create/update an MCD

## Notes
This repo treats the MCD as markdown text. A future extension may support extracting structured sections (frontmatter or sidecar JSON), but that is not required for initial implementation.
