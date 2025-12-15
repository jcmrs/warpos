import { mkdir, readFile, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import YAML from 'yaml';

import { TaskInstanceStore } from './instanceStore.js';
import { TaskTemplateStore } from './templateStore.js';
import { DomainProfileStore } from './profileStore.js';

/**
 * An Execution Plan is the declarative, inspectable output of prepare().
 * It describes exactly what will happen when execute() is called.
 */
export type ExecutionPlan = {
  plan_id: string;
  instance_id: string;
  project_slug: string;
  template_id: string;
  template_version: number;
  created_at: string;
  steps: Array<{
    id: string;
    instruction: string;
  }>;
  verification: Array<{
    id: string;
    command: string;
  }>;
  domain_framework?: string;
  status: 'pending' | 'executing' | 'completed' | 'failed';
};

/**
 * TaskExecutor implements the two-phase execution pattern:
 * - prepare(): Generate declarative execution plan (safe, inspectable)
 * - execute(): Apply the plan after GO/NO-GO approval
 */
export class TaskExecutor {
  private readonly instanceStore: TaskInstanceStore;
  private readonly templateStore: TaskTemplateStore;
  private readonly profileStore: DomainProfileStore;
  private readonly plansDir: string;

  constructor(
    instanceStore: TaskInstanceStore,
    templateStore: TaskTemplateStore,
    profileStore: DomainProfileStore,
    plansDir: string
  ) {
    this.instanceStore = instanceStore;
    this.templateStore = templateStore;
    this.profileStore = profileStore;
    this.plansDir = plansDir;
  }

  /**
   * Substitute variables in template strings with values from inputs.
   * Variables are in the format {variable_name}.
   * Complex values (objects/arrays) are converted to JSON strings.
   */
  private substituteVariables(template: string, inputs: Record<string, unknown>): string {
    let result = template;

    // Also derive common convenience variables
    const derivedVars: Record<string, string> = {
      ...this.deriveConvenienceVariables(inputs)
    };

    const allVars = { ...inputs, ...derivedVars };

    for (const [key, value] of Object.entries(allVars)) {
      const placeholder = `{${key}}`;
      let replacement: string;

      if (typeof value === 'string') {
        replacement = value;
      } else if (typeof value === 'number' || typeof value === 'boolean') {
        replacement = String(value);
      } else if (value === null || value === undefined) {
        replacement = '';
      } else {
        // Complex types (objects, arrays) - convert to JSON
        replacement = JSON.stringify(value, null, 2);
      }

      result = result.replaceAll(placeholder, replacement);
    }

    return result;
  }

  /**
   * Derive convenience variables from inputs.
   * Example: endpoint_path="/api/todos" → resource="todos"
   */
  private deriveConvenienceVariables(inputs: Record<string, unknown>): Record<string, string> {
    const derived: Record<string, string> = {};

    // Extract resource name from endpoint_path
    if (typeof inputs.endpoint_path === 'string') {
      const path = inputs.endpoint_path;
      // Extract last meaningful segment: /api/todos → todos, /users/:id → users
      // Match all segments, then take the last one that doesn't contain : or ?
      const segments = path.split('/').filter(s => s && !s.includes(':') && !s.includes('?'));
      if (segments.length > 0) {
        derived.resource = segments[segments.length - 1];
      }
    }

    return derived;
  }

  /**
   * Prepare: Generate a declarative execution plan from a task instance.
   * This is safe to run - no side effects, just creates a plan file.
   */
  async prepareTask(projectSlug: string, instanceId: string): Promise<ExecutionPlan> {
    // Load the task instance
    const instance = await this.instanceStore.getInstance(projectSlug, instanceId);

    // Load the template
    const template = await this.templateStore.loadTemplate(
      instance.template_id,
      instance.template_version
    );

    // Compile domain framework if domain profiles specified
    let domainFramework: string | undefined;
    if (instance.domain_profiles && instance.domain_profiles.length > 0) {
      const resolved = await this.profileStore.resolveProfiles(instance.domain_profiles);
      domainFramework = this.profileStore.compileFrameworkPrompt(resolved);
    }

    // Create execution plan with variable substitution
    const plan: ExecutionPlan = {
      plan_id: randomUUID(),
      instance_id: instance.instance_id,
      project_slug: instance.project_slug,
      template_id: instance.template_id,
      template_version: instance.template_version,
      created_at: new Date().toISOString(),
      steps: template.steps.map((step) => ({
        id: step.id,
        instruction: this.substituteVariables(step.instruction, instance.inputs)
      })),
      verification: (template.verification || []).map((v) => ({
        id: v.id,
        command: this.substituteVariables(v.command, instance.inputs)
      })),
      domain_framework: domainFramework,
      status: 'pending'
    };

    // Write plan to .warpos/plans/
    await mkdir(this.plansDir, { recursive: true });
    const planPath = path.join(this.plansDir, `${plan.plan_id}.yaml`);
    await writeFile(planPath, YAML.stringify(plan), 'utf8');

    return plan;
  }

  /**
   * Execute: Apply the execution plan after GO approval.
   * This has side effects - actually runs the task steps.
   */
  async executeTask(planId: string): Promise<{ ok: boolean; plan: ExecutionPlan; results: string[] }> {
    // Load the plan
    const planPath = path.join(this.plansDir, `${planId}.yaml`);
    const raw = await readFile(planPath, 'utf8');
    const plan = YAML.parse(raw) as ExecutionPlan;

    if (plan.status !== 'pending') {
      throw new Error(`Cannot execute plan with status: ${plan.status}`);
    }

    // Mark plan as executing
    plan.status = 'executing';
    await writeFile(planPath, YAML.stringify(plan), 'utf8');

    const results: string[] = [];

    try {
      // Execute steps sequentially
      for (const step of plan.steps) {
        results.push(`[Step ${step.id}] ${step.instruction}`);
        // Actual execution logic would go here
        // For now, this is a placeholder - real execution will involve:
        // - Applying domain framework constraints
        // - Running the step instruction
        // - Validating outputs
      }

      // Run verification commands
      for (const verify of plan.verification) {
        results.push(`[Verify ${verify.id}] ${verify.command}`);
        // Actual verification execution would go here
      }

      // Mark plan as completed
      plan.status = 'completed';
      await writeFile(planPath, YAML.stringify(plan), 'utf8');

      return { ok: true, plan, results };
    } catch (err: any) {
      // Mark plan as failed
      plan.status = 'failed';
      await writeFile(planPath, YAML.stringify(plan), 'utf8');

      throw err;
    }
  }

  /**
   * Get an execution plan by ID.
   */
  async getPlan(planId: string): Promise<ExecutionPlan> {
    const planPath = path.join(this.plansDir, `${planId}.yaml`);
    const raw = await readFile(planPath, 'utf8');
    return YAML.parse(raw) as ExecutionPlan;
  }
}
