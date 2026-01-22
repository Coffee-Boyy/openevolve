/**
 * Template management for prompts
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * Template manager for loading and rendering templates
 */
export class TemplateManager {
  private templates: Map<string, string>;
  private fragments: Map<string, string>;
  private defaultTemplateDir: string;
  private customTemplateDir?: string;

  constructor(customTemplateDir?: string) {
    this.templates = new Map();
    this.fragments = new Map();
    this.customTemplateDir = customTemplateDir;

    // Default template directory relative to this file
    this.defaultTemplateDir = path.join(__dirname, 'prompts', 'defaults');

    this.loadTemplates();
    console.log('Initialized template manager');
    console.log('Template directory:', this.defaultTemplateDir);
    console.log('Templates loaded:', Array.from(this.templates.keys()));
  }

  /**
   * Load templates from disk
   */
  private loadTemplates(): void {
    // Try custom directory first
    if (this.customTemplateDir && fs.existsSync(this.customTemplateDir)) {
      console.log('Loading custom templates from:', this.customTemplateDir);
      this.loadTemplatesFromDir(this.customTemplateDir);
    }

    // Load from default directory
    if (fs.existsSync(this.defaultTemplateDir)) {
      console.log('Loading default templates from:', this.defaultTemplateDir);
      this.loadTemplatesFromDir(this.defaultTemplateDir);
    } else {
      console.error('Default template directory not found:', this.defaultTemplateDir);
      console.error('This may cause template loading to fail');
    }

    // Load fragments
    this.loadFragments();
  }

  /**
   * Load templates from a directory
   */
  private loadTemplatesFromDir(dir: string): void {
    if (!fs.existsSync(dir)) {
      console.warn('Template directory does not exist:', dir);
      return;
    }

    try {
      const files = fs.readdirSync(dir);
      console.log(`Found ${files.length} files in ${dir}`);
      
      for (const file of files) {
        if (file.endsWith('.txt')) {
          const name = path.basename(file, '.txt');
          const filePath = path.join(dir, file);
          const content = fs.readFileSync(filePath, 'utf8');
          this.templates.set(name, content);
          console.log(`✓ Loaded template: ${name}`);
        }
      }
    } catch (error) {
      console.error('Error loading templates from directory:', dir, error);
    }
  }

  /**
   * Load fragments from JSON file
   */
  private loadFragments(): void {
    const fragmentsPath = path.join(this.defaultTemplateDir, 'fragments.json');
    if (fs.existsSync(fragmentsPath)) {
      try {
        const content = fs.readFileSync(fragmentsPath, 'utf8');
        const fragments = JSON.parse(content);
        for (const [key, value] of Object.entries(fragments)) {
          this.fragments.set(key, value as string);
        }
        console.log(`✓ Loaded ${this.fragments.size} fragments`);
      } catch (error) {
        console.error('Error loading fragments from:', fragmentsPath, error);
      }
    } else {
      console.warn('Fragments file not found at:', fragmentsPath);
    }
  }

  /**
   * Get a template by name
   */
  getTemplate(name: string): string {
    const template = this.templates.get(name);
    if (!template) {
      console.warn(`Template '${name}' not found, using empty string`);
      return '';
    }
    return template;
  }

  /**
   * Get a fragment by name with optional formatting
   */
  getFragment(name: string, params?: Record<string, any>): string {
    let fragment = this.fragments.get(name);
    if (!fragment) {
      console.warn(`Fragment '${name}' not found`);
      return '';
    }

    // Simple string replacement for parameters
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        fragment = fragment.replace(new RegExp(`{${key}}`, 'g'), String(value));
      }
    }

    return fragment;
  }

  /**
   * Check if template exists
   */
  hasTemplate(name: string): boolean {
    return this.templates.has(name);
  }
}
