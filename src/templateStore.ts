import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import YAML from 'yaml';
import { validateSchema } from './schema.js';

export type TaskStep = {
  id: string;
  instruction: string;
};

export type VerificationStep = {
  id: string;
  command: string;
};

export type TaskTemplate = {
  id: string;
  version: number;
  description: string;
  inputs_schema: Record<string, unknown>;
  outputs_schema: Record<string, unknown>;
  steps: TaskStep[];
  verification?: VerificationStep[];
  domain_profiles_default?: string[];
  mcd_selectors?: string[];
  active?: boolean;
  deprecated?: boolean;
  deprecated_at?: string;
  deprecated_reason?: string;
};

// JSON Schema for validating TaskTemplate structure
const TASK_TEMPLATE_SCHEMA = {
  type: 'object',
  required: ['id', 'version', 'description', 'inputs_schema', 'outputs_schema', 'steps'],
  additionalProperties: true, // Allow optional fields
  properties: {
    id: { type: 'string', minLength: 1 },
    version: { type: 'integer', minimum: 1 },
    description: { type: 'string', minLength: 1 },
    inputs_schema: { type: 'object' },
    outputs_schema: { type: 'object' },
    steps: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        required: ['id', 'instruction'],
        properties: {
          id: { type: 'string' },
          instruction: { type: 'string' }
        }
      }
    },
    verification: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'command'],
        properties: {
          id: { type: 'string' },
          command: { type: 'string' }
        }
      }
    },
    domain_profiles_default: {
      type: 'array',
      items: { type: 'string' }
    },
    mcd_selectors: {
      type: 'array',
      items: { type: 'string' }
    },
    active: { type: 'boolean' },
    deprecated: { type: 'boolean' },
    deprecated_at: { type: 'string' },
    deprecated_reason: { type: 'string' }
  }
} as const;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export class TaskTemplateStore {
  constructor(private readonly baseDir = path.join(process.cwd(), 'task-templates')) {}

  /**
   * Returns filename for a template with version: <id>@<version>.yaml
   */
  private templateFilename(templateId: string, version: number): string {
    return `${templateId}@${version}.yaml`;
  }

  /**
   * Returns full path for a template file
   */
  private templatePath(templateId: string, version: number): string {
    return path.join(this.baseDir, this.templateFilename(templateId, version));
  }

  /**
   * Parses a template filename to extract id and version
   * Returns null if format is invalid
   */
  private parseFilename(filename: string): { id: string; version: number } | null {
    const match = filename.match(/^(.+)@(\d+)\.ya?ml$/i);
    if (!match) return null;

    const id = match[1];
    const version = parseInt(match[2], 10);

    if (!id || isNaN(version) || version < 1) return null;

    return { id, version };
  }

  /**
   * List all template IDs (unique, sorted)
   * Returns only the latest version of each template ID
   */
  async listTemplateIds(): Promise<string[]> {
    try {
      const s = await stat(this.baseDir);
      if (!s.isDirectory()) return [];
    } catch {
      return [];
    }

    const entries = await readdir(this.baseDir, { withFileTypes: true });
    const templateMap = new Map<string, number>(); // id -> max version

    for (const e of entries) {
      if (!e.isFile()) continue;
      const parsed = this.parseFilename(e.name);
      if (!parsed) continue;

      const existing = templateMap.get(parsed.id);
      if (existing === undefined || parsed.version > existing) {
        templateMap.set(parsed.id, parsed.version);
      }
    }

    const ids = Array.from(templateMap.keys());
    return ids.sort((a, b) => a.localeCompare(b));
  }

  /**
   * List all versions for a given template ID
   */
  async listTemplateVersions(templateId: string): Promise<number[]> {
    try {
      const s = await stat(this.baseDir);
      if (!s.isDirectory()) return [];
    } catch {
      return [];
    }

    const entries = await readdir(this.baseDir, { withFileTypes: true });
    const versions: number[] = [];

    for (const e of entries) {
      if (!e.isFile()) continue;
      const parsed = this.parseFilename(e.name);
      if (!parsed || parsed.id !== templateId) continue;
      versions.push(parsed.version);
    }

    return versions.sort((a, b) => b - a); // Descending order (latest first)
  }

  /**
   * Get the latest version number for a template ID
   * Returns undefined if template doesn't exist
   */
  async getLatestVersion(templateId: string): Promise<number | undefined> {
    const versions = await this.listTemplateVersions(templateId);
    return versions.length > 0 ? versions[0] : undefined;
  }

  /**
   * Load and validate a task template
   */
  async loadTemplate(templateId: string, version?: number): Promise<TaskTemplate> {
    // If version not specified, use latest
    const targetVersion = version ?? (await this.getLatestVersion(templateId));

    if (targetVersion === undefined) {
      throw new Error(`Task template not found: ${templateId}`);
    }

    const filePath = this.templatePath(templateId, targetVersion);
    const raw = await readFile(filePath, 'utf8');

    const parsed = YAML.parse(raw) as unknown;
    if (!isRecord(parsed)) {
      throw new Error(`Task template ${templateId}@${targetVersion} did not parse as an object`);
    }

    // Validate against schema
    const { valid, errors } = validateSchema(TASK_TEMPLATE_SCHEMA, parsed);
    if (!valid) {
      throw new Error(
        `Task template ${templateId}@${targetVersion} failed validation: ${errors.join(', ')}`
      );
    }

    return parsed as TaskTemplate;
  }

  /**
   * Save a task template with versioning
   */
  async putTemplate(template: TaskTemplate): Promise<{ id: string; version: number; file: string }> {
    // Validate template structure
    const { valid, errors } = validateSchema(TASK_TEMPLATE_SCHEMA, template);
    if (!valid) {
      throw new Error(`Invalid task template: ${errors.join(', ')}`);
    }

    await mkdir(this.baseDir, { recursive: true });

    const filePath = this.templatePath(template.id, template.version);
    const yamlText = YAML.stringify(template);
    await writeFile(filePath, yamlText, 'utf8');

    return {
      id: template.id,
      version: template.version,
      file: path.relative(process.cwd(), filePath)
    };
  }

  /**
   * Deprecate a task template (soft delete)
   * Loads the template, adds deprecation metadata, and saves it back
   */
  async deleteTemplate(
    templateId: string,
    version: number,
    reason?: string
  ): Promise<{ id: string; version: number; deprecated: boolean }> {
    const template = await this.loadTemplate(templateId, version);

    template.active = false;
    template.deprecated = true;
    template.deprecated_at = new Date().toISOString();
    if (reason && reason.trim().length > 0) {
      template.deprecated_reason = reason;
    }

    const filePath = this.templatePath(templateId, version);
    const yamlText = YAML.stringify(template);
    await writeFile(filePath, yamlText, 'utf8');

    return {
      id: templateId,
      version,
      deprecated: true
    };
  }
}
