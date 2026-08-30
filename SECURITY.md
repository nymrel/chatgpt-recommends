# Security policy

## Supported version

Security fixes target the current `main` branch. This source repository does not itself prove what is deployed at nymrel.com.

## Reporting a vulnerability

Email `contact@nymrel.com` with the affected path, reproduction steps, impact, and any suggested mitigation. Please do not open a public issue for an unpatched vulnerability or include real customer, checkout, or credential data in a report.

## Security boundary

The free checker processes business details and pasted assistant answers in the browser and persists them in local storage until reset. The hosted page loads aggregate Vercel Insights analytics; the tool must never attach entered or pasted values to analytics or other network requests. Checkout verification and paid artifact delivery are separate server-backed boundaries and must fail closed when their verifier is unavailable.

There is no public bug-bounty promise. We will acknowledge actionable reports and coordinate remediation proportionate to the issue.
