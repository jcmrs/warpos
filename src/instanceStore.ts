import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import { validateSchema } from './schema.js';
import { TaskTemplateStore } from './templateStore.js';

/**
 * A Task Instance is a project-specific instantiation of a Task Template.
 * It records the locked template version, validated inputs, MCD reference, and domain profiles.
 */
export type TaskInstance = {
  instance_id: string;
  project_slug: string;
  template_id: string;
  template_version: number;
  inputs: Record<string, unknown>;
  mcd_hash: string;
  domain_profiles: string[];
  created_at: string;
  status?: 'pending' | 'prepared' | 'executed' | 'failed';
};

const TASK_INSTANCE_SCHEMA = {
  type: 'object',
  required: [
    'instance_id',
    'project_slug',
    'template_id',
    'template_version',
    'inputs',
    'mcd_hash',
    'domain_profiles',
    'created_at'
  ],
  additionalProperties: true,
  properties: {
    instance_id: { type: 'string', minLength: 1 },
    project_slug: { type: 'string', minLength: 1 },
    template_id: { type: 'string', minLength: 1 },
    template_version: { type: 'integer', minimum: 1 },
    inputs: { type: 'object' },
    mcd_hash: { type: 'string', minLength: 1 },
    domain_profiles: {
      type: 'array',
      items: { type: 'string' }
    },
    created_at: { type: 'string' },
    status: {
      type: 'string',
      enum: ['pending', 'prepared', 'executed', 'failed']
    }
  }
} as const;

export class TaskInstanceStore {
  private readonly baseDir = path.join(process.cwd(), 'task-instances');
  private readonly templateStore = new TaskTemplateStore();

  /**
   * Returns the directory path for a project's instances.
   */
  private projectDir(projectSlug: string): string {
    return path.join(this.baseDir, projectSlug);
  }

  /**
   * Returns the file path for a specific instance.
   */
  private instancePath(projectSlug: string, instanceId: string): string {
    return path.join(this.projectDir(projectSlug), `${instanceId}.json`);
  }

  /**
   * List all instance IDs for a given project.
   */
  async listInstances(projectSlug: string): Promise<string[]> {
    const dir = this.projectDir(projectSlug);
    try {
      const files = await readdir(dir);
      // Filter for .json files
      const instanceIds = files
        .filter((f) => f.endsWith('.json'))
        .map((f) => f.replace(/\.json$/, ''));
      return instanceIds.sort();
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        return [];
      }
      throw err;
    }
  }

  /**
   * Get a specific task instance by project and instance ID.
   */
  async getInstance(projectSlug: string, instanceId: string): Promise<TaskInstance> {
    const filePath = this.instancePath(projectSlug, instanceId);

    let raw: string;
    try {
      raw = await readFile(filePath, 'utf8');
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'code' in err && err.code === 'ENOENT') {
        throw new Error(`Task instance '${instanceId}' not found in project '${projectSlug}'`);
      }
      throw err; // Re-throw other errors unchanged
    }

    const instance = JSON.parse(raw) as TaskInstance;

    // Validate structure
    const validation = validateSchema(TASK_INSTANCE_SCHEMA, instance);
    if (!validation.valid) {
      throw new Error(`Invalid task instance structure: ${validation.errors.join(', ')}`);
    }

    return instance;
  }

  /**
   * Generate a new task instance from a template.
   * Validates inputs against the template's input schema before creating.
   */
  async generateInstance(
    projectSlug: string,
    templateId: string,
    templateVersion: number,
    inputs: Record<string, unknown>,
    mcdHash: string,
    domainProfiles: string[]
  ): Promise<TaskInstance> {
    // Load the template to validate inputs
    const template = await this.templateStore.loadTemplate(templateId, templateVersion);

    // Validate inputs against template's input schema
    const inputValidation = validateSchema(template.inputs_schema, inputs);
    if (!inputValidation.valid) {
      throw new Error(
        `Input validation failed for template ${templateId}@${templateVersion}: ${inputValidation.errors.join(', ')}`
      );
    }

    // Create instance with locked parameters
    const instance: TaskInstance = {
      instance_id: randomUUID(),
      project_slug: projectSlug,
      template_id: templateId,
      template_version: templateVersion,
      inputs,
      mcd_hash: mcdHash,
      domain_profiles: [...domainProfiles],
      created_at: new Date().toISOString(),
      status: 'pending'
    };

    // Validate instance structure
    const instanceValidation = validateSchema(TASK_INSTANCE_SCHEMA, instance);
    if (!instanceValidation.valid) {
      throw new Error(
        `Generated instance failed validation: ${instanceValidation.errors.join(', ')}`
      );
    }

    // Write to disk
    const dir = this.projectDir(projectSlug);
    await mkdir(dir, { recursive: true });

    const filePath = this.instancePath(projectSlug, instance.instance_id);
    await writeFile(filePath, JSON.stringify(instance, null, 2), 'utf8');

    return instance;
  }
}
