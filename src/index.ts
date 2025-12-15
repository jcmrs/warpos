import 'dotenv/config';

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import YAML from 'yaml';

import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { DomainProfileStore } from './profileStore.js';
import { McdStore } from './mcdStore.js';
import { TaskTemplateStore } from './templateStore.js';
import { TaskInstanceStore } from './instanceStore.js';
import { TaskExecutor } from './taskExecutor.js';
import { zaiChat, zaiPlan } from './zaiClient.js';

const server = new Server(
  {
    name: 'warpos',
    version: '0.1.0'
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

const domainProfiles = new DomainProfileStore();
const mcdStore = new McdStore();
const taskTemplates = new TaskTemplateStore();
const taskInstances = new TaskInstanceStore();
const taskExecutor = new TaskExecutor();

function asNonEmptyString(v: unknown, label: string): string {
  if (typeof v !== 'string' || v.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return v;
}

function asStringArray(v: unknown, label: string): string[] {
  if (!Array.isArray(v) || v.length === 0) {
    throw new Error(`${label} must be a non-empty array of strings`);
  }
  const out = v.filter((x) => typeof x === 'string' && x.trim().length > 0) as string[];
  if (out.length !== v.length) {
    throw new Error(`${label} must be a non-empty array of strings`);
  }
  return out;
}

function assertSafeProfileId(id: string): void {
  // Reject obvious path traversal. IDs are always repo-relative like `example/developer`.
  if (id.includes('\\') || id.startsWith('/') || id.includes('..')) {
    throw new Error('Invalid profile id (must be a repo-relative id using `/` separators)');
  }
}

function assertSafeProjectSlug(slug: string): void {
  // Slug is used as a filename under `mcd/`.
  if (slug.includes('\\') || slug.includes('/') || slug.includes('..') || slug.length > 120) {
    throw new Error('Invalid project_slug');
  }
  // Keep it conservative for filesystem safety.
  if (!/^[a-zA-Z0-9._-]+$/.test(slug)) {
    throw new Error('Invalid project_slug (allowed: letters, numbers, dot, underscore, dash)');
  }
}

function jsonText(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'zai_plan',
        description:
          'Send a planning/orchestration prompt to z.ai (using DEVPACK_CODING_PLAN_API_KEY) and return the response.',
        inputSchema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            prompt: { type: 'string', description: 'The planning prompt.' }
          },
          required: ['prompt']
        }
      },
      {
        name: 'domain_profile_list',
        description: 'List Domain Profile IDs under profiles/domains/ (YAML files).',
        inputSchema: { type: 'object', additionalProperties: false, properties: {} }
      },
      {
        name: 'domain_profile_get',
        description: 'Get a Domain Profile YAML by profile id (e.g. example/developer).',
        inputSchema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            id: { type: 'string' }
          },
          required: ['id']
        }
      },
      {
        name: 'domain_profile_put',
        description:
          'Create or update a Domain Profile YAML. NOTE: this overwrites the file for the given profile id.',
        inputSchema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            id: { type: 'string' },
            yaml: { type: 'string', description: 'Full YAML file contents.' }
          },
          required: ['id', 'yaml']
        }
      },
      {
        name: 'domain_profile_delete',
        description:
          'Deprecate (not hard-delete) a Domain Profile by setting deprecated metadata in the YAML file.',
        inputSchema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            id: { type: 'string' },
            reason: { type: 'string' }
          },
          required: ['id']
        }
      },
      {
        name: 'domain_agent_run',
        description:
          'Apply one or more Domain Profiles (with inheritance) and call z.ai with the compiled framework + user input.',
        inputSchema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            profiles: { type: 'array', items: { type: 'string' }, minItems: 1 },
            input: { type: 'string' },
            model: { type: 'string' },
            temperature: { type: 'number' }
          },
          required: ['profiles', 'input']
        }
      },
      {
        name: 'mcd_list',
        description: 'List available MCD project slugs (mcd/<projectSlug>.md).',
        inputSchema: { type: 'object', additionalProperties: false, properties: {} }
      },
      {
        name: 'mcd_get',
        description: 'Get an MCD markdown document and its metadata (sha256, updated_at).',
        inputSchema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            project_slug: { type: 'string' }
          },
          required: ['project_slug']
        }
      },
      {
        name: 'mcd_put',
        description: 'Create or update an MCD markdown document (writes mcd/<projectSlug>.md).',
        inputSchema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            project_slug: { type: 'string' },
            markdown: { type: 'string' }
          },
          required: ['project_slug', 'markdown']
        }
      },
      {
        name: 'task_template_list',
        description: 'List available Task Template IDs (latest version of each template).',
        inputSchema: { type: 'object', additionalProperties: false, properties: {} }
      },
      {
        name: 'task_template_get',
        description:
          'Get a Task Template YAML by id and optional version. If version is not specified, returns the latest version.',
        inputSchema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            id: { type: 'string' },
            version: { type: 'integer', minimum: 1 }
          },
          required: ['id']
        }
      },
      {
        name: 'task_template_put',
        description:
          'Create or update a Task Template. The template object must include id, version, description, inputs_schema, outputs_schema, and steps.',
        inputSchema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            template: { type: 'object', description: 'Complete task template object' }
          },
          required: ['template']
        }
      },
      {
        name: 'task_template_delete',
        description:
          'Deprecate (soft delete) a Task Template by id and version. Sets deprecated metadata in the YAML file.',
        inputSchema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            id: { type: 'string' },
            version: { type: 'integer', minimum: 1 },
            reason: { type: 'string' }
          },
          required: ['id', 'version']
        }
      },
      {
        name: 'task_instance_list',
        description: 'List Task Instance IDs for a given project.',
        inputSchema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            project_slug: { type: 'string' }
          },
          required: ['project_slug']
        }
      },
      {
        name: 'task_instance_get',
        description: 'Get a Task Instance by project slug and instance ID.',
        inputSchema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            project_slug: { type: 'string' },
            instance_id: { type: 'string' }
          },
          required: ['project_slug', 'instance_id']
        }
      },
      {
        name: 'task_instance_generate',
        description:
          'Generate a new Task Instance from a template. Validates inputs against the template schema and creates a locked instance for execution.',
        inputSchema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            project_slug: { type: 'string' },
            template_id: { type: 'string' },
            template_version: { type: 'integer', minimum: 1 },
            inputs: {
              type: 'object',
              description: 'Input parameters validated against template inputs_schema'
            },
            mcd_hash: { type: 'string', description: 'SHA-256 hash of the MCD this instance is based on' },
            domain_profiles: {
              type: 'array',
              items: { type: 'string' },
              description: 'Domain Profile IDs to apply during execution'
            }
          },
          required: ['project_slug', 'template_id', 'template_version', 'inputs', 'mcd_hash', 'domain_profiles']
        }
      },
      {
        name: 'task_prepare',
        description:
          'Prepare phase: Generate a declarative execution plan from a task instance. Safe to run (no side effects). Returns plan stored at .warpos/plans/<plan_id>.yaml for inspection.',
        inputSchema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            project_slug: { type: 'string' },
            instance_id: { type: 'string' }
          },
          required: ['project_slug', 'instance_id']
        }
      },
      {
        name: 'task_execute',
        description:
          'Execute phase: Apply the execution plan after GO/NO-GO approval. Has side effects - actually runs the task. Plan status must be "pending".',
        inputSchema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            plan_id: { type: 'string', description: 'Plan ID from task_prepare output' }
          },
          required: ['plan_id']
        }
      }
    ]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;

  if (name === 'zai_plan') {
    const prompt = asNonEmptyString((args as any)?.prompt, 'prompt');
    const out = await zaiPlan(prompt);
    return { content: [{ type: 'text', text: out.text }] };
  }

  if (name === 'domain_profile_list') {
    const ids = await domainProfiles.listProfileIds();
    return { content: [{ type: 'text', text: jsonText({ profiles: ids }) }] };
  }

  if (name === 'domain_profile_get') {
    const id = asNonEmptyString((args as any)?.id, 'id');
    assertSafeProfileId(id);
    const filePath = domainProfiles.profilePath(id);

    let yamlText: string;
    try {
      yamlText = await readFile(filePath, 'utf8');
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'code' in err && err.code === 'ENOENT') {
        throw new Error(`Profile '${id}' not found`);
      }
      throw err; // Re-throw other errors unchanged
    }

    return { content: [{ type: 'text', text: yamlText }] };
  }

  if (name === 'domain_profile_put') {
    const id = asNonEmptyString((args as any)?.id, 'id');
    assertSafeProfileId(id);
    const yamlText = asNonEmptyString((args as any)?.yaml, 'yaml');

    // Validate that YAML parses to an object before writing.
    const parsed = YAML.parse(yamlText) as unknown;
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new Error('domain_profile_put: yaml must parse to a YAML mapping/object');
    }

    const filePath = domainProfiles.profilePath(id);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, yamlText, 'utf8');

    return {
      content: [
        {
          type: 'text',
          text: jsonText({ ok: true, id, file: path.relative(process.cwd(), filePath) })
        }
      ]
    };
  }

  if (name === 'domain_profile_delete') {
    const id = asNonEmptyString((args as any)?.id, 'id');
    assertSafeProfileId(id);
    const reason = typeof (args as any)?.reason === 'string' ? (args as any).reason : undefined;

    const filePath = domainProfiles.profilePath(id);
    const raw = await readFile(filePath, 'utf8');
    const parsed = YAML.parse(raw) as any;
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new Error('domain_profile_delete: profile YAML must parse to a YAML mapping/object');
    }

    parsed.deprecated = true;
    parsed.deprecated_at = new Date().toISOString();
    if (reason && reason.trim().length > 0) parsed.deprecated_reason = reason;

    const outYaml = YAML.stringify(parsed);
    await writeFile(filePath, outYaml, 'utf8');

    return {
      content: [
        {
          type: 'text',
          text: jsonText({ ok: true, id, deprecated: true, file: path.relative(process.cwd(), filePath) })
        }
      ]
    };
  }

  if (name === 'domain_agent_run') {
    const profileIds = asStringArray((args as any)?.profiles, 'profiles');
    profileIds.forEach(assertSafeProfileId);
    const input = asNonEmptyString((args as any)?.input, 'input');

    const model = typeof (args as any)?.model === 'string' ? (args as any).model : undefined;
    const temperature = typeof (args as any)?.temperature === 'number' ? (args as any).temperature : undefined;

    const resolved = await domainProfiles.resolveProfiles(profileIds);
    const framework = domainProfiles.compileFrameworkPrompt(resolved);

    const out = await zaiChat(
      [
        {
          role: 'system',
          content:
            'You must follow this framework. Treat all observations as mandatory requirements.\n\n' +
            framework
        },
        { role: 'user', content: input }
      ],
      {
        model,
        temperature
      }
    );

    return { content: [{ type: 'text', text: out.text }] };
  }

  if (name === 'mcd_list') {
    const slugs = await mcdStore.listProjectSlugs();
    return { content: [{ type: 'text', text: jsonText({ projects: slugs }) }] };
  }

  if (name === 'mcd_get') {
    const projectSlug = asNonEmptyString((args as any)?.project_slug, 'project_slug');
    assertSafeProjectSlug(projectSlug);
    const out = await mcdStore.get(projectSlug);
    return {
      content: [
        {
          type: 'text',
          text: jsonText({ meta: out.meta, markdown: out.markdown })
        }
      ]
    };
  }

  if (name === 'mcd_put') {
    const projectSlug = asNonEmptyString((args as any)?.project_slug, 'project_slug');
    assertSafeProjectSlug(projectSlug);
    const markdown = typeof (args as any)?.markdown === 'string' ? (args as any).markdown : '';
    const meta = await mcdStore.put(projectSlug, markdown);
    return { content: [{ type: 'text', text: jsonText({ ok: true, meta }) }] };
  }

  if (name === 'task_template_list') {
    const ids = await taskTemplates.listTemplateIds();
    return { content: [{ type: 'text', text: jsonText({ templates: ids }) }] };
  }

  if (name === 'task_template_get') {
    const id = asNonEmptyString((args as any)?.id, 'id');
    const version = typeof (args as any)?.version === 'number' ? (args as any).version : undefined;

    const template = await taskTemplates.loadTemplate(id, version);
    const yamlText = YAML.stringify(template);

    return {
      content: [
        {
          type: 'text',
          text: jsonText({
            template,
            yaml: yamlText
          })
        }
      ]
    };
  }

  if (name === 'task_template_put') {
    const templateObj = (args as any)?.template;
    if (!templateObj || typeof templateObj !== 'object') {
      throw new Error('task_template_put: template must be an object');
    }

    const result = await taskTemplates.putTemplate(templateObj);
    return { content: [{ type: 'text', text: jsonText({ ok: true, ...result }) }] };
  }

  if (name === 'task_template_delete') {
    const id = asNonEmptyString((args as any)?.id, 'id');
    const version = (args as any)?.version;
    if (typeof version !== 'number' || version < 1) {
      throw new Error('task_template_delete: version must be a positive integer');
    }

    const reason = typeof (args as any)?.reason === 'string' ? (args as any).reason : undefined;

    const result = await taskTemplates.deleteTemplate(id, version, reason);
    return { content: [{ type: 'text', text: jsonText({ ok: true, ...result }) }] };
  }

  if (name === 'task_instance_list') {
    const projectSlug = asNonEmptyString((args as any)?.project_slug, 'project_slug');
    assertSafeProjectSlug(projectSlug);

    const instanceIds = await taskInstances.listInstances(projectSlug);
    return { content: [{ type: 'text', text: jsonText({ instances: instanceIds }) }] };
  }

  if (name === 'task_instance_get') {
    const projectSlug = asNonEmptyString((args as any)?.project_slug, 'project_slug');
    assertSafeProjectSlug(projectSlug);
    const instanceId = asNonEmptyString((args as any)?.instance_id, 'instance_id');

    const instance = await taskInstances.getInstance(projectSlug, instanceId);
    return { content: [{ type: 'text', text: jsonText({ instance }) }] };
  }

  if (name === 'task_instance_generate') {
    const projectSlug = asNonEmptyString((args as any)?.project_slug, 'project_slug');
    assertSafeProjectSlug(projectSlug);
    const templateId = asNonEmptyString((args as any)?.template_id, 'template_id');
    const templateVersion = (args as any)?.template_version;
    if (typeof templateVersion !== 'number' || templateVersion < 1) {
      throw new Error('task_instance_generate: template_version must be a positive integer');
    }

    const inputs = (args as any)?.inputs;
    if (!inputs || typeof inputs !== 'object' || Array.isArray(inputs)) {
      throw new Error('task_instance_generate: inputs must be an object');
    }

    const mcdHash = asNonEmptyString((args as any)?.mcd_hash, 'mcd_hash');
    const domainProfiles = asStringArray((args as any)?.domain_profiles, 'domain_profiles');

    const instance = await taskInstances.generateInstance(
      projectSlug,
      templateId,
      templateVersion,
      inputs,
      mcdHash,
      domainProfiles
    );

    return {
      content: [
        {
          type: 'text',
          text: jsonText({
            ok: true,
            instance_id: instance.instance_id,
            instance
          })
        }
      ]
    };
  }

  if (name === 'task_prepare') {
    const projectSlug = asNonEmptyString((args as any)?.project_slug, 'project_slug');
    assertSafeProjectSlug(projectSlug);
    const instanceId = asNonEmptyString((args as any)?.instance_id, 'instance_id');

    const plan = await taskExecutor.prepareTask(projectSlug, instanceId);

    return {
      content: [
        {
          type: 'text',
          text: jsonText({
            ok: true,
            plan_id: plan.plan_id,
            plan
          })
        }
      ]
    };
  }

  if (name === 'task_execute') {
    const planId = asNonEmptyString((args as any)?.plan_id, 'plan_id');

    const result = await taskExecutor.executeTask(planId);

    return {
      content: [
        {
          type: 'text',
          text: jsonText({
            ok: result.ok,
            plan: result.plan,
            results: result.results
          })
        }
      ]
    };
  }

  throw new Error(`Unknown tool: ${name}`);
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  // MCP servers should log to stderr.
  console.error(err);
  process.exit(1);
});
