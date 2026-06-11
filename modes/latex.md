# Mode: latex — LaTeX/Overleaf CV Export

Export a tailored, ATS-optimized CV as a `.tex` file and compile it to PDF via `tectonic` or `pdflatex`.

## Pipeline

1. Read `cv.md` as source of truth
2. Read `config/profile.yml` for candidate identity and contact info
3. Ask the user for the JD if not already in context (text or URL)
4. Extract 15-20 keywords from the JD
5. Detect JD language → CV language (EN default)
6. Detect role archetype → adapt framing
7. Rewrite Professional Summary injecting JD keywords (same rules as `pdf` mode — NEVER invent skills)
8. Select top 3-4 most relevant projects for the offer
9. Reorder experience bullets by JD relevance
10. Inject keywords naturally into existing achievements
10b. **Reviewer pass** — run the Reviewer Pass from `_shared.md` on the drafted summary + reordered bullets before assembling the payload. Apply Part A edits, weigh Part B suggestions, surface any backtrack-test failures to the user.
11. Build a JSON payload (see schema below) and write to `/tmp/cv-{candidate}-{company}.json`
12. Run: `node build-cv-latex.mjs /tmp/cv-{candidate}-{company}.json output/cv-{candidate}-{company}-{YYYY-MM-DD}.tex`
13. **Compile + verify (loop — see below).** Run `generate-latex.mjs`, then inspect the PDF and iterate until it passes.
14. Report: .tex path, .pdf path, file sizes, page count, section count, keyword coverage %

**Requires:** `tectonic` (preferred — `brew install tectonic`, auto-downloads packages) or `pdflatex` (MiKTeX / TeX Live) on PATH.

## Compile + Verify Loop (MANDATORY — step 13)

A `.tex` file that *looks* fine routinely produces a broken PDF: LaTeX page-break decisions are unpredictable, so entry titles get orphaned at the bottom of a page, the CV spills to a third page, or a section sits alone with one line under it. Never present the PDF without inspecting it.

### 13a — Compile

```bash
node generate-latex.mjs output/cv-{candidate}-{company}-{YYYY-MM-DD}.tex output/cv-{candidate}-{company}-{YYYY-MM-DD}.pdf
```

Parse the JSON output. If `valid` is false, fix the reported `issues` in the `.tex` and recompile. If `compiled` is false, read `compileError` and fix it. The report includes `pdf.pages` — use it as the first gate.

### 13b — Inspect layout

Check `pdf.pages` from the JSON first:
- **Target: exactly 2 pages** (1 is acceptable for a short, early-career CV; 3+ always needs trimming).

Then **Read the generated PDF** with the Read tool and verify visually:
- [ ] No orphaned entry title — a job/education/project heading must never sit alone at the bottom of a page with its bullets on the next. This is the most common failure.
- [ ] No section heading isolated at the top of a page with only 1-2 lines beneath it.
- [ ] No large awkward whitespace gaps.
- [ ] Contact line, all sections, and skills are present and not cut off.

### 13c — Iterate until clean

If the layout fails, edit the `.tex` (or adjust the JSON payload and rebuild via `build-cv-latex.mjs`) and recompile. Common fixes:

- **Spills to 3 pages / substantial content on page 3:** trim using **relevance-weighted cutting**. Score each candidate line by (a) relevance to *this* posting's keywords and responsibilities, (b) uniqueness (is it duplicated elsewhere?), (c) whether the cover letter depends on it. Cut the lowest-total-score line first, regardless of which section it is in — an older-role bullet that hits posting keywords outranks a recent-role bullet that does not. Do not mechanically cut by section order.
- **Orphaned entry title:** the template uses `enumitem`/standard spacing; add `\needspace{4\baselineskip}` immediately before the affected `\resumeSubheading` (add `\usepackage{needspace}` to the preamble if absent), then recompile.
- **One trailing section pushes to a new page with lots of empty space above:** trim a low-relevance bullet earlier in the document rather than forcing the break.

Re-run 13a-13b after each change. Do not proceed to the report until `pdf.pages` ≤ 2 and the visual checks pass. If after a few iterations it still won't fit cleanly, present the best version and tell the user exactly what's tight so they can decide.

`generate-latex.mjs` cleans up its own aux files (`.aux`, `.log`, `.out`, …) after a successful compile.

## JSON Input Schema

Write a JSON file with this structure. `build-cv-latex.mjs` handles template merge and LaTeX escaping — no need to escape special characters yourself.

**Section order in the rendered CV:** Professional Summary (optional) → Work Experience → Projects (optional) → Education → Certifications (optional) → Technical Skills. This Experience-first order suits experienced and senior candidates. The Professional Summary, Projects, and Certifications sections are omitted entirely when their fields are absent or empty (no empty headings). `github` is optional — when absent, no GitHub icon is rendered in the header.

```json
{
  "name": "Jane Smith",
  "contact_line": "San Francisco, CA | +1 415 555 0100",
  "summary": "Optional 2-4 sentence professional summary with JD keywords. Omit the field to drop the section.",
  "email": { "url": "jane@example.com", "display": "jane@example.com" },
  "linkedin": { "url": "https://linkedin.com/in/janesmith", "display": "linkedin.com/in/janesmith" },
  "github": { "url": "https://github.com/janesmith", "display": "github.com/janesmith" },
  "projects_section_title": "Projects",
  "education": [
    {
      "institution": "University Name",
      "location": "City, State",
      "degree": "Bachelor of Science in Computer Science",
      "dates": "2018 - 2022",
      "coursework": ["Data Structures", "Algorithms", "Machine Learning"]
    }
  ],
  "experience": [
    {
      "company": "Company Name",
      "role": "Job Title",
      "location": "Remote",
      "dates": "June 2022 - Present",
      "bullets": [
        "Achievement bullet with JD keywords injected",
        "Another bullet with quantified impact"
      ]
    }
  ],
  "projects": [
    {
      "name": "Project Name",
      "context": "Tech stack summary for the project line",
      "dates": "",
      "bullets": [
        "What you built and what it does"
      ]
    }
  ],
  "certifications": [
    "AWS Certified Solutions Architect - Professional",
    { "name": "Okta Certified Consultant", "year": "2023" }
  ],
  "skills": [
    { "category": "Languages", "items": "Python, JavaScript, C++" },
    { "category": "Frameworks", "items": "FastAPI, React, PyTorch" }
  ]
}
```

### Field reference

| Field | Type | Source |
|-------|------|--------|
| `name` | string | `profile.yml → candidate.full_name` |
| `contact_line` | string | Phone / City, State / Visa — built from profile.yml |
| `summary` | string | Optional. Professional summary (JD-tailored). Omit/empty → section dropped. Recommended for senior profiles. |
| `projects_section_title` | string | Optional. Heading for the projects section (default `"Projects"`). Use e.g. `"Selected Engagements"` for non-engineering / senior CVs. |
| `email.url` | string | Email for `\href{mailto:...}` (sanitized via sanitizeUrl, not LaTeX-escaped) |
| `email.display` | string | Display text for the email link |
| `linkedin.url` | string | Full URL with scheme for `\href{}` (sanitized via sanitizeUrl, not LaTeX-escaped) |
| `linkedin.display` | string | Display text only (no scheme) |
| `github.url` | string | Full URL with scheme for `\href{}` (sanitized via sanitizeUrl, not LaTeX-escaped) |
| `github.display` | string | Display text only (no scheme) |
| `education[].institution` | string | From cv.md Education |
| `education[].location` | string | Institution location |
| `education[].degree` | string | Degree name |
| `education[].dates` | string | Date range |
| `education[].coursework` | string[] | Optional — generates a coursework line if present |
| `experience[].company` | string | From cv.md Experience |
| `experience[].role` | string | Job title |
| `experience[].location` | string | Work location |
| `experience[].dates` | string | Date range |
| `experience[].bullets` | string[] | Reordered and keyword-injected achievement bullets |
| `projects[].name` | string | From cv.md Projects |
| `projects[].context` | string | Tech stack — appears next to project name |
| `projects[].dates` | string | Date range (or empty) |
| `projects[].bullets` | string[] | Selected project achievements |
| `certifications` | (string \| object)[] | Optional. Each entry is a plain string (e.g. `"Okta Certified Professional"`) or an object `{ name, year }` — `year` is appended in parentheses. Absent/empty → section dropped. Rendered as a compact comma-separated block. |
| `skills[].category` | string | Skill category name (e.g. "Languages", "Frameworks") |
| `skills[].items` | string | Comma-separated skills in that category |

## LaTeX Escaping (handled by the script)

`build-cv-latex.mjs` automatically escapes all user-supplied text before insertion:

| Character | Escape |
|-----------|--------|
| `&` | `\&` |
| `%` | `\%` |
| `$` | `\$` |
| `#` | `\#` |
| `_` | `\_` |
| `{` | `\{` |
| `}` | `\}` |
| `~` | `\textasciitilde{}` |
| `^` | `\textasciicircum{}` |
| `\` | `\textbackslash{}` |
| `±` | `$\pm$` |
| `→` | `$\rightarrow$` |

**Exception:** URLs inside `\href{}` are NOT escaped by the LaTeX escaper, but `sanitizeUrl()` still validates the scheme (mailto/http/https) and removes dangerous characters to prevent injection.

## ATS Rules (same as pdf mode)

- Single-column layout (enforced by template)
- Standard section headers: Professional Summary, Work Experience, Projects, Education, Certifications, Technical Skills
- UTF-8, machine-readable via `\pdfgentounicode=1`
- Keywords distributed: first bullet of each role, skills section
- No images, no graphics, no color in body text

## Keyword Injection Strategy

Same ethical rules as `modes/pdf.md`:
- NEVER add skills the candidate doesn't have
- Only reformulate existing experience using JD vocabulary
- Examples:
  - JD says "RAG pipelines" → reword "LLM workflows with retrieval" to "RAG pipeline design"
  - JD says "MLOps" → reword "observability, evals" to "MLOps and observability"

## Overleaf Compatibility

The generated `.tex` file uses only standard CTAN packages (no custom or bundled dependencies):

- `latexsym`, `fullpage`, `titlesec`, `marvosym`, `color`, `verbatim`, `enumitem`
- `hyperref`, `fancyhdr`, `babel`, `tabularx`, `fontawesome5`, `multicol`, `glyphtounicode`

Upload the `.tex` file directly to Overleaf — compiles with no extra configuration.
