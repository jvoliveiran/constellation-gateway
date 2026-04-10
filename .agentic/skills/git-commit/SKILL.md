---
name: git-commit
description: Create a single conventional commit for all staged changes using gh CLI, deriving the message from the plan file name or user request.
---

# Git Commit Skill

## Purpose

Create a single, well-structured commit for all changes produced during a workflow run. The commit message follows the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) specification.

---

## Conventional Commits Format

```
<type>: <description>
```

### Type Mapping

Derive the commit type from the nature of the work:

| Work Nature | Commit Type |
|---|---|
| New feature, new endpoint, new module | `feat` |
| Bug fix, correction | `fix` |
| Refactoring, restructuring (no behavior change) | `refactor` |
| Performance improvement | `perf` |
| Adding or updating tests only | `test` |
| Documentation only | `docs` |
| Build, CI, tooling | `chore` |
| Code style, formatting (no logic change) | `style` |

### Deriving the Description

**For planned work:**
- Use the plan file name as the base for the description.
- Strip the numeric prefix (`XXX-`) and convert hyphens to spaces.
- Example: `010-create-role-mutation.md` → `feat: create role mutation`
- Example: `005-seed-roles-permissions-and-authorization-guard.md` → `feat: seed roles permissions and authorization guard`

**For tweaks:**
- Summarize the original user request in a short, lowercase phrase.
- Example: user asked "fix the login validation bug" → `fix: login validation bug`

---

## Commit Procedure

1. **Stage all changes**: Run `git add -A` to stage all modified, added, and deleted files.
2. **Verify staged changes**: Run `git diff --cached --stat` to review what will be committed.
3. **Create the commit**: Run `git commit -m "<type>: <description>"` with the derived message.
4. **Verify success**: Run `git log --oneline -1` to confirm the commit was created.

---

## Rules

- **Single commit**: All changes from the workflow MUST be in a single commit. Do NOT create multiple commits.
- **No push**: Do NOT push to remote. The commit stays local.
- **No amend**: Do NOT amend previous commits. Always create a new commit.
- **Lowercase description**: The description part of the commit message must be lowercase.
- **No period at the end**: The commit message must NOT end with a period.
- **Max 72 characters**: The full commit message (type + description) must not exceed 72 characters. Truncate the description if needed.
- **Verify before commit**: Ensure `npm run lint`, `npm run build`, and `npm run test` all pass before committing. If any fail, fix the issue first.
