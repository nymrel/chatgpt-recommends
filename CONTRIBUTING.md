# Contributing

This repository is the reviewable source for the static ChatGPT Recommendation Check. Product behavior must stay deterministic, browser-local, and truthful about its evidence boundary.

## Development

1. Use Node 24.20.0 and npm 11.19.1. The quality gate also runs on Node 22.12.0.
2. Run `npm ci --ignore-scripts`.
3. Install the test browser once with `npx playwright install chromium`.
4. Run `npm run check` before opening a pull request.

The product itself remains dependency-free static HTML, CSS, JavaScript, and fonts. npm dependencies exist only for repeatable verification.

## Change boundaries

- Do not add network submission of business details or pasted assistant answers.
- Do not change scoring thresholds without tests and plain-language documentation.
- Do not embed live payment links, secrets, fabricated outcomes, or analytics claims.
- Keep the free result useful without checkout.
- Treat hosted CI, deployment, adoption, customer use, and revenue as separate evidence gates.

## Static asset verification

`npm run verify:static` checks HTML script/link references and CSS `url()`/`@import` references against regular files inside this repository, including quoted and relative paths. External URLs are not fetched. The hosted analytics script has one explicit path exception. A `<base href>` is rejected because it changes relative URL resolution. Fixture tests remove referenced files and rerun the actual source verifier in temporary copies to ensure missing assets cannot receive a passing result.

The test-server dependency graph uses a scoped `serve` override for `compression@1.8.2` because `serve@14.2.6` pins the vulnerable `1.8.1` release. Keep the override until the upstream pin is patched, and run `npm audit --audit-level=high` when refreshing the lockfile.
