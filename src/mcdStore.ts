import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import { createHash } from 'node:crypto';

export type McdMeta = {
  project_slug: string;
  sha256: string;
  updated_at: string;
};

function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

export class McdStore {
  constructor(private readonly baseDir = path.join(process.cwd(), 'mcd')) {}

  private mcdPath(projectSlug: string): string {
    return path.join(this.baseDir, `${projectSlug}.md`);
  }

  private metaPath(projectSlug: string): string {
    return path.join(this.baseDir, `${projectSlug}.meta.json`);
  }

  async listProjectSlugs(): Promise<string[]> {
    try {
      const s = await stat(this.baseDir);
      if (!s.isDirectory()) return [];
    } catch {
      return [];
    }

    const entries = await readdir(this.baseDir, { withFileTypes: true });
    const slugs: string[] = [];

    for (const e of entries) {
      if (!e.isFile()) continue;
      if (!e.name.endsWith('.md')) continue;
      slugs.push(e.name.replace(/\.md$/i, ''));
    }

    return slugs.sort((a, b) => a.localeCompare(b));
  }

  async get(projectSlug: string): Promise<{ markdown: string; meta: McdMeta }> {
    const markdown = await readFile(this.mcdPath(projectSlug), 'utf8');
    const computed = sha256(markdown);

    // Try to load persisted meta; if missing or invalid, fall back to computed.
    let persisted: Partial<McdMeta> | undefined;
    try {
      const raw = await readFile(this.metaPath(projectSlug), 'utf8');
      persisted = JSON.parse(raw) as Partial<McdMeta>;
    } catch {
      persisted = undefined;
    }

    const meta: McdMeta = {
      project_slug: projectSlug,
      sha256: typeof persisted?.sha256 === 'string' ? persisted.sha256 : computed,
      updated_at:
        typeof persisted?.updated_at === 'string'
          ? persisted.updated_at
          : new Date().toISOString()
    };

    return { markdown, meta };
  }

  async put(projectSlug: string, markdown: string): Promise<McdMeta> {
    await mkdir(this.baseDir, { recursive: true });

    await writeFile(this.mcdPath(projectSlug), markdown, 'utf8');

    const meta: McdMeta = {
      project_slug: projectSlug,
      sha256: sha256(markdown),
      updated_at: new Date().toISOString()
    };

    await writeFile(this.metaPath(projectSlug), JSON.stringify(meta, null, 2) + '\n', 'utf8');

    return meta;
  }
}