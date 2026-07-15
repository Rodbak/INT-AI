# Contributing to INT AI

## Branch Strategy

- `main` - production branch
- Feature branches: `feature/description`
- Bug fixes: `fix/description`
- Create PRs against `main`

## Commit Conventions

Use conventional commits:
- `feat: add OAuth connection flow`
- `fix: handle token refresh errors`
- `docs: update deployment guide`

## PR Checklist

- [ ] Code compiles without errors
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] Environment variables documented
- [ ] No secrets committed
- [ ] CI passes

## Setup

```bash
npm install
cp server/.env.example server/.env
cp app/.env.example app/.env
npm run db:push --workspace=server
npm run db:seed --workspace=server
npm run dev
```
