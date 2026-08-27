# Branch protection and repository settings

Settings that live in GitHub rather than in the repository, written down here so
they can be reviewed, restored after an accident, and applied identically to any
future repo.

Apply at **Settings → Branches → Add branch ruleset**, targeting `main`.

---

## 1. Required rules on `main`

| Rule                                             | Value | Why                                                                                                                    |
| ------------------------------------------------ | ----- | ---------------------------------------------------------------------------------------------------------------------- |
| Require a pull request before merging            | on    | `main` is what deploys to staging. A direct push skips every check below.                                              |
| Required approvals                               | 1     | Currently a single-maintainer repo; raise when the team grows.                                                         |
| Dismiss stale approvals on new commits           | on    | An approval describes the diff that was read, not the branch name.                                                     |
| Require status checks to pass                    | on    | See §2.                                                                                                                |
| Require branches to be up to date before merging | on    | Two PRs can each be green and still break `main` together — this forces the merge to be tested as it will land.        |
| Require conversation resolution                  | on    | Stops an unanswered review comment from being merged past.                                                             |
| Require linear history                           | on    | The step log in `docs/CHANGELOG-STEPS.md` reads as a sequence; a tangled graph makes "what shipped when" unanswerable. |
| Block force pushes                               | on    | A force push to `main` destroys history other clones depend on.                                                        |
| Restrict deletions                               | on    | —                                                                                                                      |

## 2. Required status checks

From `.github/workflows/ci.yml`:

- `Lint, typecheck, test, build`
- `Build API image`

Both must be required. The image build catches a class of failure the test
suite cannot see: a Dockerfile that no longer produces a working container
because a dependency moved, a native addon stopped being built, or a generated
artifact is no longer where the runtime looks for it.

> Status checks only become selectable in the GitHub UI after the workflow has
> run at least once on a pull request. Open the first PR, let CI run, then add
> the checks.

## 3. What CI verifies

`pnpm format:check` · `pnpm lint` · `pnpm typecheck` · `pnpm test` · `pnpm build`,
against real Postgres and Redis service containers, after applying migrations
and the seed — the auth and RBAC suites assert against seeded roles and grants,
so they need a real database rather than mocks.

Then the API image is built and smoke-tested: it must start, answer
`/api/v1/health/live`, and **not run as root**.

## 4. Secrets and variables

Nothing secret is committed (`CLAUDE.md` §12). CI generates throwaway JWT
secrets per run rather than reading stored ones — they protect an ephemeral
database that is destroyed with the runner, and a committed literal would
eventually be copied into a real environment.

For deployment, set these under **Settings → Secrets and variables → Actions**.
They do not exist yet; the AWS infrastructure is created in **S40**.

| Name                  | Kind     | Notes                                                                                                                                   |
| --------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `AWS_DEPLOY_ROLE_ARN` | secret   | Role assumed via OIDC. **Not** an access key: a leaked static key stays valid until somebody notices; an OIDC token expires in minutes. |
| `AWS_REGION`          | variable |                                                                                                                                         |
| `ECR_REPOSITORY`      | variable |                                                                                                                                         |
| `ECS_CLUSTER`         | variable |                                                                                                                                         |
| `ECS_SERVICE`         | variable |                                                                                                                                         |

Application secrets — `DATABASE_URL`, `JWT_ACCESS_SECRET`, `REDIS_URL` and the
rest — are **not** GitHub secrets. They live in AWS Secrets Manager, referenced
by the ECS task definition and injected at container start, so no value passes
through GitHub at all.

## 5. Environments

Create a `staging` environment (**Settings → Environments**) and attach the
deployment secrets to it rather than to the repository. That scopes them to the
jobs that declare `environment: staging`, so an unrelated workflow — or a
malicious PR that adds one — cannot read them.

Add required reviewers on `production` when it exists (S40).

## 6. Deploy workflow

`deploy-staging.yml` is a **skeleton**: the steps are real, the AWS resources it
targets are not. It refuses to run until every variable above is set, and it is
`workflow_dispatch` only with a typed confirmation. Automatic deploys on merge
are a decision to make once staging exists and CI has earned trust — not a
default inherited from a skeleton.

Two ordering choices worth keeping when S40 fills it in:

- **Migrations run before the service update**, as a one-off ECS task inside the
  VPC. RDS is in a private subnet, so a GitHub-hosted runner cannot reach it —
  and should not be able to.
- **Images are tagged by commit SHA**, not `latest`. A rollback has to name an
  exact build, and `latest` cannot be rolled back to.

## 7. Also worth enabling

- **Dependabot** for npm and GitHub Actions — S41 adds dependency scanning.
- **Secret scanning** with push protection: it blocks a credential at push time
  rather than after it is already in history, where rotating is the only fix.
- **Auto-delete head branches on merge**, to keep the step branches from piling
  up.
