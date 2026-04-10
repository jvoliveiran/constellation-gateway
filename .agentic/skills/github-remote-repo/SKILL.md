---
name: github-remote-repo
description: How to read from or write to remote GitHub repositories
---

# GitHub CLI — Remote Repository Access Skill

## Scope

Apply this skill whenever a task requires accessing, cloning, pushing to, or creating pull requests against remote GitHub repositories using the `gh` CLI. This skill covers:

- Identifying correct GitHub account to use for accessing remote repositories
- Switching accounts with `gh auth switch --user jvoliveiran` before running any remote operation
- Cloning private repos, pushing branches, and creating PRs
- Verifying authentication state before acting

This skill does **not** cover local-only git operations (commits, branching, merging). Those require no account switching.

---

## Verifying Authentication State

Before any remote operation, verify which accounts are authenticated and which is currently active:

```bash
gh auth status
```

This outputs the active account and all authenticated accounts for each host. Read the output before proceeding. The active account for `github.com` is marked with a `✓` or labelled as the logged-in user.

To see just the currently active username:

```bash
gh api user --jq '.login'
```

---

### Switch-Then-Act Pattern

Every remote operation follows this exact sequence:

```bash
# Step 1 — switch to the correct account
gh auth switch --user jvoliveiran

# Step 2 — verify the switch succeeded
gh api user --jq '.login'

# Step 3 — execute the intended operation
gh repo clone OWNER/REPO
```

Never skip step 2. A failed switch produces no error by default — verifying the active user confirms the switch was successful before the operation runs against the wrong account.

---

## Core Operations

### Cloning a Private Repository

```bash
# Resolve account → switch → verify → clone
gh auth switch --user jvoliveiran
gh api user --jq '.login'
gh repo clone OWNER/REPO
```

Clone to a specific directory:

```bash
gh repo clone OWNER/REPO path/to/local/directory
```

`gh repo clone` configures the remote using the authenticated account's credentials automatically — no manual token handling required.

### Viewing a Remote Repository

```bash
# Switch to the right account
gh auth switch --user jvoliveiran

# Confirm current account
gh api user --jq '.login'

# Read metadata without cloning
gh repo view OWNER/REPO

# Open in browser
gh repo view OWNER/REPO --web
```

### Listing Repos for an Account

```bash
# List repos for the currently active account
gh repo list

# List repos for a specific org
gh repo list OWNER --limit 50
```

---

### Pushing Changes

Pushing uses `git push` directly — `gh` manages authentication for the remote via the credential helper set up by `gh auth setup-git`. The account switch must happen before the push so the correct credentials are active.

```bash
# Switch to correct account first
gh auth switch --user jvoliveiran

# Then push normally via git — gh credential helper handles auth
git push origin BRANCH_NAME
```

If the credential helper is not configured, run this once per account (after switching to that account):

```bash
gh auth setup-git
```

---

### Creating a Pull Request

Always run from inside the cloned repo directory. The `gh` CLI detects the remote context automatically.

```bash
# Ensure correct account is active first
gh auth switch --user jvoliveiran

# Create PR interactively
gh pr create

# Create PR non-interactively with all fields specified
gh pr create \
  --title "feat: add invoice pagination" \
  --body "Adds cursor-based pagination to the invoice list endpoint." \
  --base main \
  --head BRANCH_NAME
```

Create as a draft:

```bash
gh pr create --draft --title "WIP: invoice pagination" --base main
```

### Listing and Viewing Pull Requests

```bash
# List open PRs in current repo
gh pr list

# List PRs you authored
gh pr list --author "@me"

# View a specific PR
gh pr view PR_NUMBER

# View PR in browser
gh pr view PR_NUMBER --web

# Check PR CI status
gh pr checks PR_NUMBER
```

### Checking Out a PR Branch Locally

```bash
gh pr checkout PR_NUMBER
```

---

## Full Workflow Examples

### Working on a Personal Repo

```bash
# 1. Switch to personal account
gh auth switch --user jvoliveiran

# 2. Verify
gh api user --jq '.login'   # should print jvoliveiran

# 3. Clone the private repo
gh repo clone jvoliveiran/my-side-project

# 4. Work, commit, push
cd my-side-project
git checkout -b feat/new-feature
# ... make changes ...
git add . && git commit -m "feat: add new feature"
git push origin feat/new-feature

# 5. Open a PR
gh pr create --title "feat: add new feature" --base main
```

---

## Troubleshooting

### Verify both accounts are authenticated

```bash
gh auth status
```

Both accounts should appear under `github.com`. If only one appears, the other needs to be added:

```bash
gh auth login --hostname github.com
# Follow prompts — authenticate the missing account
```

### Permission denied on clone or push

This typically means the wrong account is active. Run:

```bash
gh api user --jq '.login'
```

If it shows the wrong username, switch and retry:

```bash
gh auth switch --hostname github.com --user <correct-username>
git push origin BRANCH_NAME  # retry the failed operation
```

### `gh auth switch` — account not found

If the switch fails because the username is not recognised, the account is not authenticated. Re-authenticate:

```bash
gh auth login --hostname github.com
```

Then verify with `gh auth status` and retry the switch.

---

## Hard Rules

- **Always switch accounts before any remote operation** — never assume the active account is correct
- **Always verify the switch** with `gh api user --jq '.login'` before the intended command
- **Always** use user `jvoliveiran`
- **Never hardcode tokens or credentials** — `gh` manages authentication; never pass tokens manually
- **Never run `gh repo clone`, `git push`, or `gh pr create` before confirming the active account** — the wrong account silently uses the wrong credentials or fails with a cryptic permission error