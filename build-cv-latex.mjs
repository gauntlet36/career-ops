#!/usr/bin/env node

import { readFile, writeFile, stat } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve, dirname, basename, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_PATH = resolve(__dirname, 'templates', 'cv-template.tex');
const PLACEHOLDER_RE = /\{\{[A-Z_]+\}\}/g;

function escapeLatex(text, mode = 'text') {
  if (typeof text !== 'string') return '';
  if (mode === 'url') return text;
  const out = [];
  for (const ch of text) {
    switch (ch) {
      case '\\': out.push('\\textbackslash{}'); break;
      case '{': case '}': out.push('\\' + ch); break;
      case '^': out.push('\\textasciicircum{}'); break;
      case '~': out.push('\\textasciitilde{}'); break;
      case '_': out.push('\\_'); break;
      case '&': out.push('\\&'); break;
      case '%': out.push('\\%'); break;
      case '$': out.push('\\$'); break;
      case '#': out.push('\\#'); break;
      case '\u00B1': out.push('$\\pm$'); break;
      case '\u2192': out.push('$\\rightarrow$'); break;
      default: out.push(ch);
    }
  }
  return out.join('');
}

function sanitizeUrl(url) {
  if (typeof url !== 'string') return '';
  url = url.trim();
  if (!url) return '';
  const allowedSchemes = ['mailto:', 'http:', 'https:'];
  const hasScheme = allowedSchemes.some(s => url.toLowerCase().startsWith(s));
  if (!hasScheme) {
    if (url.includes('@') && !url.includes('/')) {
      url = 'mailto:' + url;
    } else {
      url = 'https://' + url;
    }
  }
  url = url.replace(/[{}%$#\\~^]/g, '');
  return url;
}

function buildEducation(entries) {
  if (!Array.isArray(entries) || entries.length === 0) return '';
  const blocks = [];
  for (const e of entries) {
    if (!e) continue;
    let block = `    \\resumeSubheading\n      {${escapeLatex(e.institution)}}{${escapeLatex(e.location)}}\n      {${escapeLatex(e.degree)}}{${escapeLatex(e.dates)}}`;
    if (Array.isArray(e.coursework) && e.coursework.length > 0) {
      const courses = e.coursework.map(c => escapeLatex(c)).join(', ');
      block += `\n        \\resumeItemListStart\n            \\resumeItem{\\textbf{Coursework:} ${courses}}\n        \\resumeItemListEnd`;
    }
    blocks.push(block);
  }
  return blocks.join('\n\n');
}

function buildExperience(entries) {
  if (!Array.isArray(entries) || entries.length === 0) return '';
  const blocks = [];
  for (const e of entries) {
    if (!e) continue;
    const bullets = Array.isArray(e.bullets) ? e.bullets.map(b => `            \\resumeItem{${escapeLatex(b)}}`).join('\n') : '';
    blocks.push(`    \\resumeSubheading\n      {${escapeLatex(e.company)}}{${escapeLatex(e.dates)}}\n      {${escapeLatex(e.role)}}{${escapeLatex(e.location)}}\n      \\resumeItemListStart\n${bullets}\n      \\resumeItemListEnd`);
  }
  return blocks.join('\n\n');
}

// Renders the contact links row (email / linkedin / github). Each link is
// included only when its URL is present, so a candidate with no GitHub does not
// get a dangling, empty GitHub icon in the header.
function buildContactLinks(payload) {
  const parts = [];

  const emailUrl = sanitizeUrl(payload.email?.url || '');
  if (emailUrl) {
    const emailDisplay = payload.email?.display || payload.email?.url || '';
    parts.push(`\\href{${emailUrl}}{\\raisebox{-0.2\\height}\\faEnvelope\\  \\underline{${escapeLatex(emailDisplay)}}}`);
  }

  const linkedinUrl = sanitizeUrl(payload.linkedin?.url || '');
  if (linkedinUrl) {
    const linkedinDisplay = payload.linkedin?.display || '';
    parts.push(`\\href{${linkedinUrl}}{\\raisebox{-0.2\\height}\\faLinkedin\\ \\underline{${escapeLatex(linkedinDisplay)}}}`);
  }

  const githubUrl = sanitizeUrl(payload.github?.url || '');
  if (githubUrl) {
    const githubDisplay = payload.github?.display || '';
    parts.push(`\\href{${githubUrl}}{\\raisebox{-0.2\\height}\\faGithub\\ \\underline{${escapeLatex(githubDisplay)}}}`);
  }

  return parts.join(' ~\n        ');
}

// Renders an optional Professional Summary section. Returns '' when absent so the
// section disappears entirely (no empty heading). Senior profiles lead with this.
function buildSummary(summary) {
  if (typeof summary !== 'string' || !summary.trim()) return '';
  return `\\section{Professional Summary}\n  \\vspace{2pt}\n  {\\small ${escapeLatex(summary.trim())}}\n  \\vspace{-4pt}`;
}

// Renders an optional Projects section, including its own \section wrapper.
// Returns '' when there are no projects (the section vanishes — a senior
// candidate need not invent "personal projects"). The heading defaults to
// "Projects" but can be overridden (e.g. "Selected Engagements").
function buildProjects(entries, sectionTitle = 'Projects') {
  if (!Array.isArray(entries) || entries.length === 0) return '';
  const blocks = [];
  for (const e of entries) {
    if (!e) continue;
    const context = e.context ? ` \\emph{$|$ ${escapeLatex(e.context)}}` : '';
    const bullets = Array.isArray(e.bullets) ? e.bullets.map(b => `            \\resumeItem{${escapeLatex(b)}}`).join('\n') : '';
    blocks.push(`    \\resumeProjectHeading\n      {\\textbf{${escapeLatex(e.name)}}${context}}{${escapeLatex(e.dates)}}\n      \\resumeItemListStart\n${bullets}\n      \\resumeItemListEnd`);
  }
  const body = blocks.join('\n\n');
  return `\\section{${escapeLatex(sectionTitle)}}\n\\resumeSubHeadingListStart\n${body}\n\\resumeSubHeadingListEnd`;
}

// Renders an optional standalone Certifications section, including its own
// \section wrapper. Returns '' when there are no certifications so the section
// disappears entirely (no empty heading) — same pattern as Projects. Entries may
// be plain strings ("Okta Certified Professional") or objects { name, year };
// when a year is present it is appended in parentheses. Rendered as a compact
// comma-separated block (dense, ATS-clean) to match the Technical Skills style.
function buildCertifications(entries) {
  if (!Array.isArray(entries) || entries.length === 0) return '';
  const items = entries.map(e => {
    if (!e) return '';
    if (typeof e === 'string') return escapeLatex(e);
    const name = escapeLatex(e.name || '');
    if (!name) return '';
    const year = e.year ? ` (${escapeLatex(String(e.year))})` : '';
    return `${name}${year}`;
  }).filter(Boolean);
  if (items.length === 0) return '';
  return `\\section{Certifications}\n\\vspace{-7pt}\n\\begin{itemize}[leftmargin=0.15in, label={}]\\small{\\item{\n${items.join(', ')}\n}}\n\\end{itemize}`;
}

function buildSkills(categories) {
  if (!Array.isArray(categories) || categories.length === 0) return '';
  return categories.map(c => {
    if (!c) return '';
    const items = Array.isArray(c.items) ? c.items.join(', ') : (c.items || '');
    return `        \\textbf{${escapeLatex(c.category)}}{: ${escapeLatex(items)}} \\\\`;
  }).filter(Boolean).join('\n');
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help')) {
    console.error('Usage:');
    console.error('  node build-cv-latex.mjs <input.json> <output.tex>');
    console.error('  node build-cv-latex.mjs --test');
    process.exit(1);
  }

  if (args.includes('--test')) {
    await runSelfTest();
    return;
  }

  const [inputPath, outputPath] = args;

  if (!inputPath || !outputPath) {
    console.error('Usage: node build-cv-latex.mjs <input.json> <output.tex>');
    process.exit(1);
  }

  const absInput = resolve(inputPath);
  const absOutput = resolve(outputPath);
  const outDir = dirname(absOutput);

  if (!existsSync(absInput)) {
    console.error(`Input file not found: ${absInput}`);
    process.exit(1);
  }

  let payload;
  try {
    const raw = await readFile(absInput, 'utf-8');
    payload = JSON.parse(raw);
  } catch (err) {
    console.error(`Failed to parse input JSON: ${err.message}`);
    process.exit(1);
  }

  if (!existsSync(TEMPLATE_PATH)) {
    console.error(`Template not found: ${TEMPLATE_PATH}`);
    process.exit(1);
  }

  let template = await readFile(TEMPLATE_PATH, 'utf-8');

  const substitutions = {
    NAME: escapeLatex(payload.name || ''),
    CONTACT_LINE: escapeLatex(payload.contact_line || ''),
    CONTACT_LINKS: buildContactLinks(payload),
    SUMMARY: buildSummary(payload.summary),
    EDUCATION: buildEducation(payload.education),
    EXPERIENCE: buildExperience(payload.experience),
    PROJECTS: buildProjects(payload.projects, payload.projects_section_title || 'Projects'),
    CERTIFICATIONS: buildCertifications(payload.certifications),
    SKILLS: buildSkills(payload.skills),
  };

  for (const [key, value] of Object.entries(substitutions)) {
    template = template.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }

  const unresolved = template.match(PLACEHOLDER_RE);
  if (unresolved) {
    console.error(`Unresolved placeholders: ${[...new Set(unresolved)].join(', ')}`);
    process.exit(1);
  }

  if (!existsSync(outDir)) {
    const { mkdirSync } = await import('fs');
    mkdirSync(outDir, { recursive: true });
  }

  await writeFile(absOutput, template, 'utf-8');

  const fileInfo = await stat(absOutput);
  const sizeKB = (fileInfo.size / 1024).toFixed(1);

  const report = {
    file: basename(absOutput),
    path: absOutput,
    sizeKB: parseFloat(sizeKB),
    counts: {
      educationEntries: (payload.education || []).length,
      experienceEntries: (payload.experience || []).length,
      projectEntries: (payload.projects || []).length,
      certificationEntries: (payload.certifications || []).length,
      skillCategories: (payload.skills || []).length,
      totalBullets: (() => {
        const ex = Array.isArray(payload.experience) ? payload.experience.flatMap(e => Array.isArray(e?.bullets) ? e.bullets : []) : [];
        const pr = Array.isArray(payload.projects) ? payload.projects.flatMap(p => Array.isArray(p?.bullets) ? p.bullets : []) : [];
        return ex.length + pr.length;
      })(),
    },
    valid: true,
  };

  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}

async function runSelfTest() {
  const sample = {
    name: 'Test Candidate',
    contact_line: 'City, State | +1 234 567 8900',
    summary: 'Test summary line proving the optional Professional Summary section renders.',
    email: { url: 'test@example.com', display: 'test@example.com' },
    linkedin: { url: 'https://linkedin.com/in/test', display: 'linkedin.com/in/test' },
    github: { url: 'https://github.com/test', display: 'github.com/test' },
    education: [{
      institution: 'Test University',
      location: 'City, State',
      degree: 'Bachelor of Science in Testing',
      dates: '2020 - 2024',
      coursework: ['Data Structures', 'Algorithms', 'Machine Learning'],
    }],
    experience: [{
      company: 'Test Corp',
      role: 'Test Engineer',
      location: 'Remote',
      dates: 'June 2024 - Present',
      bullets: [
        'Built automated testing pipelines with CI/CD integration',
        'Reduced regression test time by 60% through parallel execution',
      ],
    }],
    projects: [{
      name: 'Test Project',
      context: 'Python, FastAPI, Docker',
      dates: '2024',
      bullets: [
        'Built a REST API with automated test coverage exceeding 90%',
      ],
    }],
    certifications: [
      'Okta Certified Professional',
      { name: 'AWS Certified Solutions Architect - Associate', year: '2023' },
    ],
    skills: [
      { category: 'Languages', items: 'Python, JavaScript, TypeScript' },
      { category: 'Frameworks', items: 'FastAPI, React, PyTorch' },
    ],
  };

  const testOutput = '/tmp/build-cv-latex-test.tex';
  const raw = JSON.stringify(sample, null, 2);
  const tmpInput = '/tmp/build-cv-latex-test-input.json';
  await writeFile(tmpInput, raw, 'utf-8');

  const absInput = resolve(tmpInput);
  const absOutput = resolve(testOutput);

  if (!existsSync(TEMPLATE_PATH)) {
    console.error(`Self-test failed: template not found at ${TEMPLATE_PATH}`);
    process.exit(1);
  }

  let template = await readFile(TEMPLATE_PATH, 'utf-8');

  const substitutions = {
    NAME: escapeLatex(sample.name),
    CONTACT_LINE: escapeLatex(sample.contact_line),
    CONTACT_LINKS: buildContactLinks(sample),
    SUMMARY: buildSummary(sample.summary),
    EDUCATION: buildEducation(sample.education),
    EXPERIENCE: buildExperience(sample.experience),
    PROJECTS: buildProjects(sample.projects, sample.projects_section_title || 'Projects'),
    CERTIFICATIONS: buildCertifications(sample.certifications),
    SKILLS: buildSkills(sample.skills),
  };

  for (const [key, value] of Object.entries(substitutions)) {
    template = template.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }

  const unresolved = template.match(PLACEHOLDER_RE);
  if (unresolved) {
    console.error(`Self-test failed: unresolved placeholders: ${[...new Set(unresolved)].join(', ')}`);
    process.exit(1);
  }

  const outDir = dirname(absOutput);
  if (!existsSync(outDir)) {
    const { mkdirSync } = await import('fs');
    mkdirSync(outDir, { recursive: true });
  }

  await writeFile(absOutput, template, 'utf-8');

  const fileInfo = await stat(absOutput);
  const sizeKB = (fileInfo.size / 1024).toFixed(1);

  const report = {
    status: 'self-test-passed',
    file: basename(absOutput),
    path: absOutput,
    sizeKB: parseFloat(sizeKB),
    counts: {
      educationEntries: sample.education.length,
      experienceEntries: sample.experience.length,
      projectEntries: sample.projects.length,
      certificationEntries: sample.certifications.length,
      skillCategories: sample.skills.length,
      totalBullets: (() => {
        const ex = Array.isArray(sample.experience) ? sample.experience.flatMap(e => Array.isArray(e?.bullets) ? e.bullets : []) : [];
        const pr = Array.isArray(sample.projects) ? sample.projects.flatMap(p => Array.isArray(p?.bullets) ? p.bullets : []) : [];
        return ex.length + pr.length;
      })(),
    },
  };

  console.log(JSON.stringify(report, null, 2));

  await import('fs/promises').then(fs =>
    Promise.all([
      fs.rm(tmpInput).catch(() => {}),
      fs.rm(testOutput).catch(() => {}),
    ])
  );

  process.exit(0);
}

main();
