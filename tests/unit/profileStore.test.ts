import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { DomainProfileStore, type DomainProfile, type ResolvedProfile } from '../../src/profileStore.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

// Mock fs promises
vi.mock('node:fs/promises');

describe('DomainProfileStore', () => {
  let store: DomainProfileStore;
  const mockBaseDir = path.join(process.cwd(), 'profiles', 'domains');

  beforeEach(() => {
    vi.clearAllMocks();
    store = new DomainProfileStore();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('profilePath()', () => {
    it('converts simple profile ID to file path', () => {
      const result = store.profilePath('test');
      expect(result).toBe(path.join(mockBaseDir, 'test.yaml'));
    });

    it('converts nested profile ID with slashes', () => {
      const result = store.profilePath('example/developer');
      expect(result).toBe(path.join(mockBaseDir, 'example', 'developer.yaml'));
    });

    it('protects against path traversal attacks', () => {
      const result = store.profilePath('../../../etc/passwd');
      expect(result).toBe(path.join(mockBaseDir, '__', '__', '__', 'etc', 'passwd.yaml'));
    });

    it('handles multiple path segments correctly', () => {
      const result = store.profilePath('a/b/c');
      expect(result).toBe(path.join(mockBaseDir, 'a', 'b', 'c.yaml'));
    });
  });

  describe('listProfileIds()', () => {
    it('returns empty array when base directory does not exist', async () => {
      vi.mocked(fs.stat).mockRejectedValue(new Error('ENOENT'));

      const result = await store.listProfileIds();

      expect(result).toEqual([]);
    });

    it('returns empty array when base directory is not a directory', async () => {
      vi.mocked(fs.stat).mockResolvedValue({
        isDirectory: () => false
      } as any);

      const result = await store.listProfileIds();

      expect(result).toEqual([]);
    });

    it('returns sorted profile IDs from YAML files', async () => {
      vi.mocked(fs.stat).mockResolvedValue({
        isDirectory: () => true
      } as any);

      vi.mocked(fs.readdir).mockImplementation(async (dir: any) => {
        if (dir === mockBaseDir) {
          return [
            { name: 'example', isDirectory: () => true, isFile: () => false },
            { name: 'test', isDirectory: () => true, isFile: () => false }
          ] as any;
        }
        if (dir === path.join(mockBaseDir, 'example')) {
          return [
            { name: 'developer.yaml', isDirectory: () => false, isFile: () => true }
          ] as any;
        }
        if (dir === path.join(mockBaseDir, 'test')) {
          return [
            { name: 'minimal.yaml', isDirectory: () => false, isFile: () => true },
            { name: 'advanced.yml', isDirectory: () => false, isFile: () => true }
          ] as any;
        }
        return [] as any;
      });

      const result = await store.listProfileIds();

      expect(result).toEqual([
        'example/developer',
        'test/advanced',
        'test/minimal'
      ]);
    });

    it('ignores non-YAML files', async () => {
      vi.mocked(fs.stat).mockResolvedValue({
        isDirectory: () => true
      } as any);

      vi.mocked(fs.readdir).mockResolvedValue([
        { name: 'profile.yaml', isDirectory: () => false, isFile: () => true },
        { name: 'README.md', isDirectory: () => false, isFile: () => true },
        { name: 'config.json', isDirectory: () => false, isFile: () => true }
      ] as any);

      const result = await store.listProfileIds();

      expect(result).toEqual(['profile']);
    });
  });

  describe('loadProfile()', () => {
    it('successfully loads valid profile', async () => {
      const yamlContent = `description: Test profile
relations:
  - target: base
    type: inherits
context:
  observations:
    - Test observation 1
    - Test observation 2`;

      vi.mocked(fs.readFile).mockResolvedValue(yamlContent);

      const result = await store.loadProfile('test/profile');

      expect(result).toMatchObject({
        id: 'test/profile',
        profile: {
          description: 'Test profile',
          relations: [
            { target: 'base', type: 'inherits' }
          ],
          context: {
            observations: [
              'Test observation 1',
              'Test observation 2'
            ]
          }
        },
        groups: [
          {
            groupPath: 'context',
            observations: [
              'Test observation 1',
              'Test observation 2'
            ]
          }
        ]
      });
    });

    it('throws error when profile file not found', async () => {
      const error: any = new Error('File not found');
      error.code = 'ENOENT';
      vi.mocked(fs.readFile).mockRejectedValue(error);

      await expect(store.loadProfile('nonexistent')).rejects.toThrow(
        "Profile 'nonexistent' not found"
      );
    });

    it('re-throws non-ENOENT errors unchanged', async () => {
      const error = new Error('Permission denied');
      vi.mocked(fs.readFile).mockRejectedValue(error);

      await expect(store.loadProfile('test')).rejects.toThrow('Permission denied');
    });

    it('throws error when YAML is not an object', async () => {
      vi.mocked(fs.readFile).mockResolvedValue('- just\n- an\n- array');

      await expect(store.loadProfile('invalid')).rejects.toThrow(
        'Domain profile invalid did not parse as an object'
      );
    });

    it('handles profile with no observations', async () => {
      const yamlContent = `description: Minimal profile`;
      vi.mocked(fs.readFile).mockResolvedValue(yamlContent);

      const result = await store.loadProfile('minimal');

      expect(result.groups).toEqual([]);
    });

    it('collects nested observation groups', async () => {
      const yamlContent = `context:
  behavioral:
    observations:
      - Behavior 1
      - Behavior 2
  technical:
    observations:
      - Tech 1`;

      vi.mocked(fs.readFile).mockResolvedValue(yamlContent);

      const result = await store.loadProfile('nested');

      expect(result.groups).toEqual([
        {
          groupPath: 'context.behavioral',
          observations: ['Behavior 1', 'Behavior 2']
        },
        {
          groupPath: 'context.technical',
          observations: ['Tech 1']
        }
      ]);
    });
  });

  describe('resolveProfiles()', () => {
    it('resolves single profile without inheritance', async () => {
      const yamlContent = `description: Standalone profile
context:
  observations:
    - Observation 1`;

      vi.mocked(fs.readFile).mockResolvedValue(yamlContent);

      const result = await store.resolveProfiles(['standalone']);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('standalone');
      expect(result[0].profile.description).toBe('Standalone profile');
    });

    it('resolves simple inheritance chain (A inherits B)', async () => {
      vi.mocked(fs.readFile).mockImplementation(async (path: any) => {
        if (path.includes('derived.yaml')) {
          return `description: Derived profile
relations:
  - target: base
    type: inherits
context:
  observations:
    - Derived observation`;
        }
        if (path.includes('base.yaml')) {
          return `description: Base profile
context:
  observations:
    - Base observation`;
        }
        throw new Error('Unexpected file');
      });

      const result = await store.resolveProfiles(['derived']);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('base');
      expect(result[1].id).toBe('derived');
    });

    it('resolves diamond inheritance (A inherits B,C; B,C both inherit D)', async () => {
      vi.mocked(fs.readFile).mockImplementation(async (path: any) => {
        if (path.includes('a.yaml')) {
          return `description: A
relations:
  - target: b
    type: inherits
  - target: c
    type: inherits`;
        }
        if (path.includes('b.yaml')) {
          return `description: B
relations:
  - target: d
    type: inherits`;
        }
        if (path.includes('c.yaml')) {
          return `description: C
relations:
  - target: d
    type: inherits`;
        }
        if (path.includes('d.yaml')) {
          return `description: D`;
        }
        throw new Error('Unexpected file');
      });

      const result = await store.resolveProfiles(['a']);

      // D should appear only once (DFS handles duplicates)
      expect(result).toHaveLength(4);
      expect(result[0].id).toBe('d');
      expect(result[1].id).toBe('b');
      expect(result[2].id).toBe('c');
      expect(result[3].id).toBe('a');
    });

    it('detects direct circular dependency (A inherits B, B inherits A)', async () => {
      vi.mocked(fs.readFile).mockImplementation(async (path: any) => {
        if (path.includes('a.yaml')) {
          return `description: A
relations:
  - target: b
    type: inherits`;
        }
        if (path.includes('b.yaml')) {
          return `description: B
relations:
  - target: a
    type: inherits`;
        }
        throw new Error('Unexpected file');
      });

      await expect(store.resolveProfiles(['a'])).rejects.toThrow(
        'Cycle detected in domain profile inheritance'
      );
    });

    it('detects indirect circular dependency (A→B→C→A)', async () => {
      vi.mocked(fs.readFile).mockImplementation(async (path: any) => {
        if (path.includes('a.yaml')) {
          return `description: A
relations:
  - target: b
    type: inherits`;
        }
        if (path.includes('b.yaml')) {
          return `description: B
relations:
  - target: c
    type: inherits`;
        }
        if (path.includes('c.yaml')) {
          return `description: C
relations:
  - target: a
    type: inherits`;
        }
        throw new Error('Unexpected file');
      });

      await expect(store.resolveProfiles(['a'])).rejects.toThrow(
        'Cycle detected in domain profile inheritance'
      );
    });

    it('resolves multiple entry profiles independently', async () => {
      vi.mocked(fs.readFile).mockImplementation(async (path: any) => {
        if (path.includes('profile1.yaml')) {
          return `description: Profile 1`;
        }
        if (path.includes('profile2.yaml')) {
          return `description: Profile 2`;
        }
        throw new Error('Unexpected file');
      });

      const result = await store.resolveProfiles(['profile1', 'profile2']);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('profile1');
      expect(result[1].id).toBe('profile2');
    });
  });

  describe('compileFrameworkPrompt()', () => {
    it('compiles single profile with description and observations', () => {
      const profiles: ResolvedProfile[] = [
        {
          id: 'test',
          filePath: '/path/to/test.yaml',
          profile: {
            description: 'Test profile description'
          },
          groups: [
            {
              groupPath: 'context',
              observations: [
                'Observation 1',
                'Observation 2'
              ]
            }
          ]
        }
      ];

      const result = store.compileFrameworkPrompt(profiles);

      expect(result).toBe(`# Profile: test
Test profile description

## context
- Observation 1
- Observation 2`);
    });

    it('compiles multiple profiles in order', () => {
      const profiles: ResolvedProfile[] = [
        {
          id: 'base',
          filePath: '/path/to/base.yaml',
          profile: { description: 'Base profile' },
          groups: [
            {
              groupPath: 'context',
              observations: ['Base observation']
            }
          ]
        },
        {
          id: 'derived',
          filePath: '/path/to/derived.yaml',
          profile: { description: 'Derived profile' },
          groups: [
            {
              groupPath: 'context',
              observations: ['Derived observation']
            }
          ]
        }
      ];

      const result = store.compileFrameworkPrompt(profiles);

      expect(result).toContain('# Profile: base');
      expect(result).toContain('# Profile: derived');
      expect(result).toContain('Base observation');
      expect(result).toContain('Derived observation');
    });

    it('handles profile with multiple observation groups', () => {
      const profiles: ResolvedProfile[] = [
        {
          id: 'multi',
          filePath: '/path/to/multi.yaml',
          profile: {},
          groups: [
            {
              groupPath: 'behavioral',
              observations: ['Behavior 1', 'Behavior 2']
            },
            {
              groupPath: 'technical',
              observations: ['Tech 1']
            }
          ]
        }
      ];

      const result = store.compileFrameworkPrompt(profiles);

      expect(result).toContain('## behavioral');
      expect(result).toContain('- Behavior 1');
      expect(result).toContain('- Behavior 2');
      expect(result).toContain('## technical');
      expect(result).toContain('- Tech 1');
    });

    it('handles profile with no description', () => {
      const profiles: ResolvedProfile[] = [
        {
          id: 'nodesc',
          filePath: '/path/to/nodesc.yaml',
          profile: {},
          groups: [
            {
              groupPath: 'context',
              observations: ['Observation 1']
            }
          ]
        }
      ];

      const result = store.compileFrameworkPrompt(profiles);

      expect(result).toBe(`# Profile: nodesc

## context
- Observation 1`);
    });

    it('handles empty profiles array', () => {
      const result = store.compileFrameworkPrompt([]);

      expect(result).toBe('');
    });
  });
});
