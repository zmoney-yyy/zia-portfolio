import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { about, hero, howIWork, proof } from '../data/site';
import { approvedFacts, buildSystemPrompt, withPrivateRules, type PromptProject } from './chat-prompt';

const facts = readFileSync('content/chat-facts.md', 'utf8');
const projects: PromptProject[] = readdirSync('src/content/projects')
  .sort()
  .map((f) => {
    const fm = readFileSync(`src/content/projects/${f}`, 'utf8').split('---')[1];
    const get = (k: string) => fm.match(new RegExp(`^${k}: "(.*)"$`, 'm'))?.[1] ?? '';
    return { num: get('num'), title: get('title'), blurb: get('blurb'), role: get('role'), tagline: get('tagline'), metric: get('metric') };
  });
const prompt = buildSystemPrompt({ site: { hero, proof, howIWork, about }, projects, facts });

describe('chat system prompt', () => {
  it('includes all six project cards and the fact sheet', () => {
    expect(projects).toHaveLength(6);
    for (const p of projects) expect(prompt).toContain(p.title);
    expect(prompt).toContain('Senior Campaign Manager');
    expect(prompt).toContain('12+');
  });

  it('leaves out the review-notes log, including the retracted departure date', () => {
    const withLog = `${facts}\n## Decisions (Zia, Nov 8)\n- an earlier date was wrong: SAMPLE-DATE\n\n## Later section\n- kept\n`;
    const cleaned = approvedFacts(withLog);
    expect(cleaned).not.toContain('SAMPLE-DATE');
    expect(cleaned).not.toContain('## Decisions');
    expect(cleaned).toContain('## Later section');
    expect(cleaned).toContain('## What the chat must not do');
    expect(prompt).not.toMatch(/## Decisions/);
  });

  it('does not name any side business', () => {
    expect(prompt).not.toMatch(/real estate|crm consult/i);
  });

  it('carries no email address, key or draft placeholder', () => {
    expect(prompt).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/);
    expect(prompt).not.toMatch(/sk-ant|TODO_/);
  });

  it('introduces no number that is not in the page text or fact sheet', () => {
    const nums = (s: string) => new Set(s.match(/\d[\d.,]*/g)?.map((n) => n.replace(/[.,]+$/, '')) ?? []);
    const source =
      [hero.subhead, ...proof.map((p) => p.value + p.label), ...projects.flatMap((p) => [p.num, p.blurb, p.metric]), ...howIWork.principles.map((w) => w.body), about.body].join('\n') +
      '\n' +
      approvedFacts(facts);
    const allowed = nums(source);
    // Numbers in the instruction text itself (rule numbers, "12+" quoted from the sheet).
    const rules = prompt.slice(0, prompt.lastIndexOf('<portfolio>\n'));
    const inside = prompt.slice(prompt.lastIndexOf('<portfolio>\n'));
    const unknown = [...nums(inside)].filter((n) => !allowed.has(n));
    expect(unknown.map((n) => `${n} @ ${inside.slice(Math.max(0, inside.indexOf(n) - 30), inside.indexOf(n) + 20)}`)).toEqual([]);
    expect([...nums(rules)].every((n) => /^\d$/.test(n) || n === '12')).toBe(true);
  });
});

describe('withPrivateRules', () => {
  it('appends the rules after the base prompt, separated by a blank line', () => {
    expect(withPrivateRules('BASE', '  extra rule  ')).toBe('BASE\n\nextra rule');
  });
  it('leaves the prompt untouched when the rules are unset or blank', () => {
    expect(withPrivateRules('BASE', undefined)).toBe('BASE');
    expect(withPrivateRules('BASE', '   \n ')).toBe('BASE');
  });
});
