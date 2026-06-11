# Mode: upskill — Skill-Gap Analysis & Learning Plan

Analyzes the gap between the candidate's profile and the roles they target, then produces a prioritized learning plan with web-searched study resources and a recommended study order.

Adapted for career-ops: the profile comes from `cv.md` + `article-digest.md` + `config/profile.yml`; the aggregate source is the `data/applications.md` tracker; reports are written to `reports/upskill/`.

## Invocation

- **`/career-ops upskill`** — aggregate mode: analyzes all evaluated roles in `data/applications.md`
- **`/career-ops upskill {URL or JD}`** — targeted mode: analyzes a single posting

---

## Step 1 — Detect mode

- No argument → **aggregate mode**
- URL or JD text argument → **targeted mode** (derive a slug from company + role for the filename)

## Step 2 — Load data

### Aggregate mode
1. Read `data/applications.md`. Each row has: `#, Date, Company, Role, Score, Status, PDF, Report, Notes`. The `Score` is `X.X/5`.
2. For each row, note `Role`, `Company`, `Score`, and the linked report (read the report's Block B "Match with CV" for the concrete gaps already identified — this is richer than the tracker row).
3. Read `cv.md`, `article-digest.md` (if present), and `config/profile.yml` for current skills and target archetypes.
4. Check `reports/upskill/` for the most recent `report-YYYY-MM-DD.md` — if one exists, load it for the diff in Step 8.

### Targeted mode
1. Fetch the posting (Playwright/WebFetch per the verification rules in AGENTS.md), or use the pasted JD.
2. Extract: title, company, required skills, preferred skills, responsibilities, domain.
3. Read `cv.md`, `article-digest.md`, `config/profile.yml` for current skills. No tracker data is used.

## Step 3 — Pass 1: hard-skill diff

Extract required and preferred technical skills from each source.

### Aggregate mode
Prefer the gaps already named in each report's Block B. Build a **skill frequency map** — for each gap skill, count how many roles surface it. Apply a **fit weight**: each role contributes `(5 - score) / 5` (a 2.0/5 role exposes more gaps than a 4.5/5 role, so it weighs more). Final score per skill = `sum of (fit_weight × occurrence)`.

### Targeted mode
Extract explicit required + preferred skills from the posting. Equal weight (single role). List required before preferred, alphabetical within each group.

### Diff against profile
Remove any skill already present in `cv.md` / `article-digest.md` in any form (be generous — "Python" covers "Python scripting"). What remains is the **hard-skill gap list**. Aggregate: rank by score descending. Targeted: required gaps before preferred, alphabetical within each.

## Step 4 — Pass 2: synthesis (gaps the diff misses)

Reason holistically. Tag each as `[domain]`, `[soft]`, `[tooling]`, or `[credential]`:
- **Domain knowledge** the target archetypes assume but the profile lacks (e.g. observability, fintech regulation)
- **Soft / ways-of-working** signals across postings the profile doesn't address
- **Tooling / process** (frameworks, cloud services, methodologies) recurring but absent
- **Credentials** listed as preferred across multiple postings

Do not duplicate Pass 1 findings.

## Step 5 — Gap heatmap

Combine both passes into one prioritized table. Print it to the terminal before building the plan.

| Priority | Skill / Area | Type | Gap Source |
|----------|-------------|------|------------|
| Critical | OpenTelemetry | Hard | 3/4 roles, score 2.4 |
| High | Distributed systems | Domain | synthesis |
| Medium | Kubernetes | Hard | 1/4 roles, score 0.8 |

- **Critical**: high-frequency/weight hard skills, or domain gaps across most roles
- **High**: moderate hard skills, or consistent soft/tooling gaps
- **Medium**: lower-frequency or fewer-role gaps
- **Low**: one-off mentions (listed for completeness, no learning entry)

Targeted mode: required → Critical/High, preferred → Medium, synthesized → Medium/Low.

## Step 6 — Learning plan

For every **Critical** and **High** gap (and **Medium** if fewer than 5 gaps total):

1. **WebSearch** for current, highly-rated resources — include the current year in the query to avoid stale results.
2. **Pick 2-3 resources.** Prefer hands-on labs over lecture-only; official docs for tooling; books for domain knowledge. Each: name, URL, one-line reason.
3. **Write a study direction** tailored to the candidate's existing background — be specific about what to skip and where to start (e.g. "You already know AWS — skip the cloud-basics module, start at the OTel collector and instrumentation sections").
4. **Estimate time to working proficiency** (e.g. "~20h"). Err toward more.

Group entries under theme headings (Cloud & Infrastructure, Observability, Domain Knowledge, Certifications, etc.).

## Step 7 — Suggested study order

Number topics in sequence:
1. **Dependencies first** — if B needs A, place A first and note it.
2. **Critical before High before Medium** within a dependency tier.
3. **Quick wins early** — a fast (~5h) Medium gap that builds confidence can come early.
4. **Domain knowledge last** — best studied alongside a real project.

| # | Topic | Type | Est. Time | Note |
|---|-------|------|-----------|------|
| 1 | OpenTelemetry | Hard | ~20h | Required before the observability domain work |

End with **Total estimated time**.

## Step 8 — Write and save report

Assemble in this order and save with the Write tool:

```markdown
# Upskill Report — YYYY-MM-DD
**Mode:** Aggregate (N roles analyzed) | Targeted: <Title> @ <Company>

## Since Last Report
<!-- Aggregate only; omit if no previous report -->
**Gaps closed** (added to profile since <date>): ...
**New gaps** (from roles tracked since <date>): ...

## Gap Heatmap
| Priority | Skill / Area | Type | Gap Source |
...

## Learning Plan
### <Theme>
**<Skill>** `[Type]` — ~Xh
- [Resource](url) — reason
Study direction: ...

## Suggested Study Order
| # | Topic | Type | Est. Time | Note |
...
**Total estimated time: ~Xh**
```

- **Aggregate:** `reports/upskill/report-YYYY-MM-DD.md`
- **Targeted:** `reports/upskill/report-YYYY-MM-DD-{company-slug}-{role-slug}.md`

Create `reports/upskill/` if it doesn't exist. After saving, tell the user the path.

## Rules

1. **Never fabricate resources.** Cite only what actual WebSearch results returned — no invented course names, URLs, or authors.
2. **Search with the current year** in every resource query.
3. **Targeted mode ignores the tracker** — analyze only the fetched posting.
4. **Be generous with profile matching** — if a skill appears in any form, don't flag it.
5. **Print the heatmap before the learning plan.**
6. **Omit Low-priority gaps from the plan** (keep them in the heatmap).
7. **Always save the report**, even if the terminal output looks complete.
