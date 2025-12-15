import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, readdir, readFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { DomainProfileStore } from '../../src/profileStore.js';
import { McdStore } from '../../src/mcdStore.js';
import { TaskTemplateStore } from '../../src/templateStore.js';
import { TaskInstanceStore } from '../../src/instanceStore.js';
import { TaskExecutor } from '../../src/taskExecutor.js';

describe('MCP Tools Integration Tests', () => {
  let testDir: string;

  beforeEach(async () => {
    // Create temporary directory for each test
    testDir = await mkdtemp(path.join(tmpdir(), 'warpos-test-'));
  });

  afterEach(async () => {
    // Clean up test directory
    await rm(testDir, { recursive: true, force: true });
  });

  describe('Domain Profile Tools', () => {
    let profileStore: DomainProfileStore;
    let profilesDir: string;

    beforeEach(async () => {
      profilesDir = path.join(testDir, 'profiles', 'domains');
      await mkdir(profilesDir, { recursive: true });
      profileStore = new DomainProfileStore(profilesDir);
    });

    it('domain_profile_list: lists all available profiles', async () => {
      // Create test profiles
      await mkdir(path.join(profilesDir, 'test'), { recursive: true });
      await writeFile(
        path.join(profilesDir, 'test', 'profile1.yaml'),
        'description: Profile 1'
      );
      await writeFile(
        path.join(profilesDir, 'test', 'profile2.yaml'),
        'description: Profile 2'
      );

      const result = await profileStore.listProfileIds();

      expect(result).toEqual(['test/profile1', 'test/profile2']);
    });

    it('domain_profile_get: retrieves specific profile', async () => {
      // Create test profile
      const profileContent = `description: Test profile
context:
  observations:
    - Observation 1
    - Observation 2`;

      await mkdir(path.join(profilesDir, 'test'), { recursive: true });
      await writeFile(
        path.join(profilesDir, 'test', 'example.yaml'),
        profileContent
      );

      const result = await profileStore.loadProfile('test/example');

      expect(result.id).toBe('test/example');
      expect(result.profile.description).toBe('Test profile');
      expect(result.groups).toHaveLength(1);
      expect(result.groups[0].observations).toEqual(['Observation 1', 'Observation 2']);
    });

    it('domain_profile_put: creates new profile', async () => {
      const profileContent = `description: New profile
context:
  observations:
    - Test observation`;

      await mkdir(path.join(profilesDir, 'new'), { recursive: true });
      await writeFile(
        path.join(profilesDir, 'new', 'profile.yaml'),
        profileContent
      );

      // Verify file was created
      const files = await readdir(path.join(profilesDir, 'new'));
      expect(files).toContain('profile.yaml');

      const content = await readFile(
        path.join(profilesDir, 'new', 'profile.yaml'),
        'utf8'
      );
      expect(content).toContain('New profile');
    });

    it('domain_profile_delete: soft-deletes profile', async () => {
      // Create profile to delete
      await mkdir(path.join(profilesDir, 'test'), { recursive: true });
      await writeFile(
        path.join(profilesDir, 'test', 'todelete.yaml'),
        'description: To delete'
      );

      // Soft delete by adding deprecation metadata
      const updatedContent = `deprecated: true
reason: Test deletion
description: To delete`;

      await writeFile(
        path.join(profilesDir, 'test', 'todelete.yaml'),
        updatedContent
      );

      const content = await readFile(
        path.join(profilesDir, 'test', 'todelete.yaml'),
        'utf8'
      );
      expect(content).toContain('deprecated: true');
      expect(content).toContain('reason: Test deletion');
    });

    it('domain_agent_run: compiles profiles and generates framework prompt', async () => {
      // Create test profile
      const profileContent = `description: Test framework
context:
  behavioral:
    observations:
      - Behavior 1
      - Behavior 2
  technical:
    observations:
      - Tech 1`;

      await mkdir(path.join(profilesDir, 'test'), { recursive: true });
      await writeFile(
        path.join(profilesDir, 'test', 'framework.yaml'),
        profileContent
      );

      const resolved = await profileStore.resolveProfiles(['test/framework']);
      const frameworkPrompt = profileStore.compileFrameworkPrompt(resolved);

      expect(frameworkPrompt).toContain('# Profile: test/framework');
      expect(frameworkPrompt).toContain('Test framework');
      expect(frameworkPrompt).toContain('## context.behavioral');
      expect(frameworkPrompt).toContain('- Behavior 1');
      expect(frameworkPrompt).toContain('- Behavior 2');
      expect(frameworkPrompt).toContain('## context.technical');
      expect(frameworkPrompt).toContain('- Tech 1');
    });
  });

  describe('MCD Tools', () => {
    let mcdStore: McdStore;
    let mcdDir: string;

    beforeEach(async () => {
      mcdDir = path.join(testDir, 'mcd');
      await mkdir(mcdDir, { recursive: true });
      mcdStore = new McdStore(mcdDir);
    });

    it('mcd_list: lists all project slugs', async () => {
      // Create test MCDs
      await writeFile(path.join(mcdDir, 'project1.md'), '# Project 1');
      await writeFile(path.join(mcdDir, 'project2.md'), '# Project 2');

      const result = await mcdStore.listProjectSlugs();

      expect(result).toEqual(['project1', 'project2']);
    });

    it('mcd_get: retrieves MCD with metadata', async () => {
      const mcdContent = '# Test Project\n\nProject description';
      await writeFile(path.join(mcdDir, 'test-project.md'), mcdContent);

      const result = await mcdStore.get('test-project');

      expect(result.markdown).toBe(mcdContent);
      expect(result.meta.sha256).toBeDefined();
      expect(result.meta.updated_at).toBeDefined();
    });

    it('mcd_put: creates/updates MCD', async () => {
      const mcdContent = '# New Project\n\nDescription';

      await mcdStore.put('new-project', mcdContent);

      const files = await readdir(mcdDir);
      expect(files).toContain('new-project.md');
      expect(files).toContain('new-project.meta.json');

      const content = await readFile(path.join(mcdDir, 'new-project.md'), 'utf8');
      expect(content).toBe(mcdContent);

      const meta = JSON.parse(
        await readFile(path.join(mcdDir, 'new-project.meta.json'), 'utf8')
      );
      expect(meta.sha256).toBeDefined();
    });
  });

  describe('Task Template Tools', () => {
    let templateStore: TaskTemplateStore;
    let templatesDir: string;

    beforeEach(async () => {
      templatesDir = path.join(testDir, 'task-templates');
      await mkdir(templatesDir, { recursive: true });
      templateStore = new TaskTemplateStore(templatesDir);
    });

    it('task_template_list: lists all templates', async () => {
      // Create test templates
      await writeFile(
        path.join(templatesDir, 'template1@1.yaml'),
        'id: template1\nversion: 1\ndescription: Test'
      );
      await writeFile(
        path.join(templatesDir, 'template2@1.yaml'),
        'id: template2\nversion: 1\ndescription: Test'
      );

      // Get all template IDs
      const ids = await templateStore.listTemplateIds();

      // Get latest version for each
      const result = await Promise.all(
        ids.map(async (id) => {
          const version = await templateStore.getLatestVersion(id);
          return { id, version };
        })
      );

      expect(result).toEqual([
        { id: 'template1', version: 1 },
        { id: 'template2', version: 1 }
      ]);
    });

    it('task_template_get: retrieves specific template', async () => {
      const templateContent = `id: test-template
version: 1
description: Test template
inputs_schema:
  type: object
  properties:
    name:
      type: string
outputs_schema:
  type: object
steps:
  - id: step1
    instruction: Test step`;

      await writeFile(
        path.join(templatesDir, 'test-template@1.yaml'),
        templateContent
      );

      const result = await templateStore.loadTemplate('test-template', 1);

      expect(result.id).toBe('test-template');
      expect(result.version).toBe(1);
      expect(result.description).toBe('Test template');
    });

    it('task_template_put: creates new template', async () => {
      const template = {
        id: 'new-template',
        version: 1,
        description: 'New template',
        inputs_schema: {
          type: 'object' as const,
          properties: {
            name: { type: 'string' as const }
          }
        },
        outputs_schema: {
          type: 'object' as const
        },
        steps: [{ id: 'step1', instruction: 'Test step' }]
      };

      await templateStore.putTemplate(template);

      const files = await readdir(templatesDir);
      expect(files).toContain('new-template@1.yaml');
    });

    it('task_template_delete: soft-deletes template', async () => {
      const template = {
        id: 'to-delete',
        version: 1,
        description: 'To delete',
        inputs_schema: { type: 'object' as const },
        outputs_schema: { type: 'object' as const },
        steps: [{ id: 'step1', instruction: 'Test step' }]
      };

      await templateStore.putTemplate(template);

      // Soft delete
      await templateStore.deleteTemplate('to-delete', 1, 'Test deletion');

      const content = await readFile(
        path.join(templatesDir, 'to-delete@1.yaml'),
        'utf8'
      );
      expect(content).toContain('deprecated: true');
      expect(content).toContain('reason: Test deletion');
    });
  });

  describe('Task Instance Tools', () => {
    let instanceStore: TaskInstanceStore;
    let templateStore: TaskTemplateStore;
    let mcdStore: McdStore;
    let instancesDir: string;
    let templatesDir: string;
    let mcdDir: string;

    beforeEach(async () => {
      instancesDir = path.join(testDir, 'task-instances');
      templatesDir = path.join(testDir, 'task-templates');
      mcdDir = path.join(testDir, 'mcd');

      await mkdir(instancesDir, { recursive: true });
      await mkdir(templatesDir, { recursive: true });
      await mkdir(mcdDir, { recursive: true });

      templateStore = new TaskTemplateStore(templatesDir);
      mcdStore = new McdStore(mcdDir);
      instanceStore = new TaskInstanceStore(templateStore, instancesDir);
    });

    it('task_instance_list: lists instances for project', async () => {
      // Create test instances
      const projectDir = path.join(instancesDir, 'test-project');
      await mkdir(projectDir, { recursive: true });

      const instance1 = {
        instance_id: 'id1',
        project_slug: 'test-project',
        template_id: 'template',
        template_version: 1,
        inputs: {},
        mcd_hash: 'hash',
        domain_profiles: [],
        created_at: new Date().toISOString(),
        status: 'pending'
      };

      await writeFile(
        path.join(projectDir, 'id1.json'),
        JSON.stringify(instance1)
      );

      const result = await instanceStore.listInstances('test-project');

      expect(result).toEqual(['id1']);
    });

    it('task_instance_get: retrieves specific instance', async () => {
      const projectDir = path.join(instancesDir, 'test-project');
      await mkdir(projectDir, { recursive: true });

      const instance = {
        instance_id: 'test-id',
        project_slug: 'test-project',
        template_id: 'template',
        template_version: 1,
        inputs: { name: 'test' },
        mcd_hash: 'hash123',
        domain_profiles: ['profile1'],
        created_at: new Date().toISOString(),
        status: 'pending'
      };

      await writeFile(
        path.join(projectDir, 'test-id.json'),
        JSON.stringify(instance)
      );

      const result = await instanceStore.getInstance('test-project', 'test-id');

      expect(result.instance_id).toBe('test-id');
      expect(result.inputs).toEqual({ name: 'test' });
      expect(result.mcd_hash).toBe('hash123');
    });

    it('task_instance_generate: creates instance from template', async () => {
      // Create template first
      const template = {
        id: 'test-template',
        version: 1,
        description: 'Test',
        inputs_schema: {
          type: 'object' as const,
          properties: {
            name: { type: 'string' as const }
          },
          required: ['name' as const]
        },
        outputs_schema: { type: 'object' as const },
        steps: [{ id: 'step1', instruction: 'Test step' }]
      };

      await templateStore.putTemplate(template);

      // Generate instance
      const instance = await instanceStore.generateInstance(
        'test-project',
        'test-template',
        1,
        { name: 'Test Name' },
        'abc123',
        ['profile1']
      );

      expect(instance.project_slug).toBe('test-project');
      expect(instance.template_id).toBe('test-template');
      expect(instance.inputs).toEqual({ name: 'Test Name' });

      // Verify file was created
      const projectDir = path.join(instancesDir, 'test-project');
      const files = await readdir(projectDir);
      expect(files).toHaveLength(1);
    });
  });

  describe('Task Execution Tools', () => {
    let executor: TaskExecutor;
    let instanceStore: TaskInstanceStore;
    let templateStore: TaskTemplateStore;
    let profileStore: DomainProfileStore;
    let plansDir: string;

    beforeEach(async () => {
      plansDir = path.join(testDir, '.warpos', 'plans');
      const templatesDir = path.join(testDir, 'task-templates');
      const instancesDir = path.join(testDir, 'task-instances');
      const profilesDir = path.join(testDir, 'profiles', 'domains');

      await mkdir(plansDir, { recursive: true });
      await mkdir(templatesDir, { recursive: true });
      await mkdir(instancesDir, { recursive: true });
      await mkdir(profilesDir, { recursive: true });

      templateStore = new TaskTemplateStore(templatesDir);
      instanceStore = new TaskInstanceStore(templateStore, instancesDir);
      profileStore = new DomainProfileStore(profilesDir);
      executor = new TaskExecutor(instanceStore, templateStore, profileStore, plansDir);
    });

    it('task_prepare: generates execution plan', async () => {
      // Create template and instance
      const template = {
        id: 'test-task',
        version: 1,
        description: 'Test task',
        inputs_schema: {
          type: 'object' as const,
          properties: {
            name: { type: 'string' as const }
          }
        },
        outputs_schema: { type: 'object' as const },
        steps: [
          {
            id: 'create_file',
            instruction: 'Create file named {name}'
          }
        ]
      };

      await templateStore.putTemplate(template);

      const instance = await instanceStore.generateInstance(
        'test-project',
        'test-task',
        1,
        { name: 'test.txt' },
        'hash123',
        []
      );

      const result = await executor.prepareTask('test-project', instance.instance_id);

      // prepareTask returns ExecutionPlan directly
      expect(result.plan_id).toBeDefined();
      expect(result.steps).toHaveLength(1);
      expect(result.steps[0].instruction).toBe('Create file named test.txt');
      expect(result.status).toBe('pending');

      // Verify plan file was created
      const files = await readdir(plansDir);
      expect(files).toContain(`${result.plan_id}.yaml`);
    });

    it('task_execute: executes approved plan', async () => {
      // Create template, instance, and plan
      const template = {
        id: 'test-task',
        version: 1,
        description: 'Test task',
        inputs_schema: {
          type: 'object' as const,
          properties: {
            message: { type: 'string' as const }
          }
        },
        outputs_schema: { type: 'object' as const },
        steps: [
          {
            id: 'echo',
            instruction: 'Echo: {message}'
          }
        ]
      };

      await templateStore.putTemplate(template);

      const instance = await instanceStore.generateInstance(
        'test-project',
        'test-task',
        1,
        { message: 'Hello World' },
        'hash123',
        []
      );

      const prepareResult = await executor.prepareTask('test-project', instance.instance_id);

      // Execute the plan (in real MCP tool, user would approve first)
      const executeResult = await executor.executeTask(prepareResult.plan_id);

      // executeTask returns { ok, plan, results }
      expect(executeResult.ok).toBe(true);
      expect(executeResult.plan.status).toBe('completed');
      expect(executeResult.plan.plan_id).toBe(prepareResult.plan_id);
    });
  });
});
