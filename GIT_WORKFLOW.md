# Git workflow

Three branches, each with a different job:

| Branch    | Purpose                        | GitHub Actions                              | Local hooks |
| --------- | ------------------------------- | -------------------------------------------- | ----------- |
| `working` | Day-to-day development          | none                                         | Husky pre-commit (lint + typecheck) |
| `stg`     | Staging / review                | lint, typecheck, test → deploy to **Vercel preview** | — |
| `master`  | Production                      | lint, typecheck, test → deploy to **Vercel production** | — |

## The promotion flow

1. **Work on `working`.** Commit as usual; Husky's pre-commit hook (`.husky/pre-commit`)
   runs `npm run lint` and `npm run typecheck` before each commit so obvious breakage
   never even reaches `stg`. There is no CI on this branch and nothing deploys from it.

   ```bash
   git checkout working
   # ...make changes, commit...
   ```

2. **Push to `stg` to get a preview.** Merge (or fast-forward) `working` into `stg` and
   push. `.github/workflows/deploy-preview.yml` runs the full quality gate (lint,
   typecheck, `npm test`) and, if it passes, builds and deploys to a Vercel **preview**
   deployment. The deployed URL is printed in the workflow run's summary.

   ```bash
   git checkout stg
   git merge working
   git push origin stg
   ```

3. **Review the live preview.** Click through the actual deployed site before touching
   production.

4. **Push to `master` to ship.** Once the preview looks right, merge (or fast-forward)
   `stg` into `master` and push. `.github/workflows/deploy-production.yml` runs the same
   quality gate and then deploys to Vercel **production**.

   ```bash
   git checkout master
   git merge stg
   git push origin master
   ```

Nothing deploys anywhere except through these two pushes — `stg` can only ever reach
Vercel's preview environment, and only a push to `master` reaches production.

## Notes

- **Husky hooks are repo-local, not branch-local.** `git config core.hooksPath` applies
  to the whole working copy, so the pre-commit hook will also run if you commit directly
  on `stg` or `master`. In practice you shouldn't need to — those branches should only
  ever receive merges from `working`/`stg`.
- **Dependabot** opens its update PRs against `stg` (see `.github/dependabot.yml`), so
  dependency bumps go through the same preview step before reaching production instead
  of landing on `master` directly. (GitHub only reads `dependabot.yml` from the
  repository's default branch, so this takes effect once the current change reaches
  `master`.)
- **Branch protection** isn't configured by these files — it's a GitHub repo setting.
  If you want to stop anyone (including yourself, from another machine) from pushing
  straight to `master` or `stg` outside this flow, set that up under
  **Settings → Branches** on GitHub.
- The two workflow files intentionally don't run on pull requests — this project's flow
  is direct branch-to-branch pushes, not PR review. If you start opening PRs into `stg`
  or `master` (e.g. to review a Dependabot bump before merging), those PRs won't get a
  CI check until after they're merged; add a `pull_request` trigger to
  `deploy-preview.yml`'s `quality` job if you want pre-merge feedback.
