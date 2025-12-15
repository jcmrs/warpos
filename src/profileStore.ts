import { readFile, readdir, stat } from 'node:fs/promises';
import * as path from 'node:path';
import YAML from 'yaml';

export type ProfileRelation = {
  target: string;
  type: 'inherits';
};

export type DomainProfile = {
  description?: string;
  relations?: ProfileRelation[];
  // Other keys are permitted (context/methodology groups, etc.).
  [k: string]: unknown;
};

export type ObservationGroup = {
  groupPath: string;
  observations: string[];
};

export type ResolvedProfile = {
  id: string;
  filePath: string;
  profile: DomainProfile;
  groups: ObservationGroup[];
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function collectObservationGroups(
  node: unknown,
  currentPath: string[] = []
): ObservationGroup[] {
  const out: ObservationGroup[] = [];
  if (!isRecord(node)) return out;

  for (const [k, v] of Object.entries(node)) {
    const nextPath = [...currentPath, k];

    if (k === 'observations' && Array.isArray(v)) {
      const obs = v.filter((x) => typeof x === 'string') as string[];
      if (obs.length > 0) {
        // groupPath is the path *to the containing object*, without trailing `.observations`.
        const groupPath = currentPath.length > 0 ? currentPath.join('.') : 'observations';
        out.push({ groupPath, observations: obs });
      }
      continue;
    }

    if (isRecord(v)) {
      out.push(...collectObservationGroups(v, nextPath));
    }
  }

  return out;
}

async function listYamlFilesRecursive(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const out: string[] = [];

  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      out.push(...(await listYamlFilesRecursive(full)));
      continue;
    }
    if (e.isFile() && (e.name.endsWith('.yaml') || e.name.endsWith('.yml'))) {
      out.push(full);
    }
  }

  return out;
}

export class DomainProfileStore {
  constructor(private readonly baseDir = path.join(process.cwd(), 'profiles', 'domains')) {}

  async listProfileIds(): Promise<string[]> {
    try {
      const s = await stat(this.baseDir);
      if (!s.isDirectory()) return [];
    } catch {
      return [];
    }

    const files = await listYamlFilesRecursive(this.baseDir);
    const ids = files.map((f) => {
      const rel = path.relative(this.baseDir, f);
      return rel.replace(/\\/g, '/').replace(/\.(ya?ml)$/i, '');
    });

    // Stable ordering
    return ids.sort((a, b) => a.localeCompare(b));
  }

  profilePath(profileId: string): string {
    // profileId uses `/` separators regardless of OS.
    const safeRel = profileId.replace(/\.\./g, '__');
    return path.join(this.baseDir, ...safeRel.split('/')) + '.yaml';
  }

  async loadProfile(profileId: string): Promise<ResolvedProfile> {
    const filePath = this.profilePath(profileId);

    let raw: string;
    try {
      raw = await readFile(filePath, 'utf8');
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'code' in err && err.code === 'ENOENT') {
        throw new Error(`Profile '${profileId}' not found`);
      }
      throw err; // Re-throw other errors unchanged
    }

    const parsed = YAML.parse(raw) as unknown;
    if (!isRecord(parsed)) {
      throw new Error(`Domain profile ${profileId} did not parse as an object`);
    }

    const profile = parsed as DomainProfile;
    const groups = collectObservationGroups(profile);

    return { id: profileId, filePath, profile, groups };
  }

  async resolveProfiles(entryProfileIds: string[]): Promise<ResolvedProfile[]> {
    // DFS with cycle detection.
    const resolved: ResolvedProfile[] = [];
    const visiting = new Set<string>();
    const visited = new Set<string>();

    const visit = async (id: string) => {
      if (visited.has(id)) return;
      if (visiting.has(id)) {
        throw new Error(`Cycle detected in domain profile inheritance at: ${id}`);
      }

      visiting.add(id);
      const p = await this.loadProfile(id);

      const rels = Array.isArray(p.profile.relations) ? p.profile.relations : [];
      for (const r of rels) {
        if (!r || r.type !== 'inherits' || typeof r.target !== 'string') continue;
        await visit(r.target);
      }

      visiting.delete(id);
      visited.add(id);
      resolved.push(p);
    };

    for (const id of entryProfileIds) {
      await visit(id);
    }

    // `resolved` order is base → derived due to DFS post-order push.
    return resolved;
  }

  compileFrameworkPrompt(profiles: ResolvedProfile[]): string {
    const lines: string[] = [];

    for (const p of profiles) {
      lines.push(`# Profile: ${p.id}`);
      if (p.profile.description && typeof p.profile.description === 'string') {
        lines.push(p.profile.description);
      }

      // Group headings + bullets.
      for (const g of p.groups) {
        lines.push(`\n## ${g.groupPath}`);
        for (const o of g.observations) {
          lines.push(`- ${o}`);
        }
      }

      lines.push('');
    }

    return lines.join('\n').trim();
  }
}