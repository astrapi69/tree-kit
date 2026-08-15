# Security Policy

## Supported Versions

tree-kit is pre-1.0 software. Only the latest minor version
receives security fixes; users on older versions should upgrade
to the latest release on npm.

## Reporting a Vulnerability

Please report security vulnerabilities through GitHub's
**Private Vulnerability Reporting** feature:

1. Navigate to https://github.com/astrapi69/tree-kit/security
2. Click "Report a vulnerability"
3. Provide a clear description, reproduction steps, and an
   impact assessment

We aim to acknowledge reports within 7 days and provide a fix
or mitigation timeline within 14 days for confirmed
vulnerabilities.

Please do **not** open a public GitHub Issue for security
reports. Public Issues for non-security bugs remain the right
channel.

## Scope notes

tree-kit is a zero-dependency data-structure library: no I/O,
no network, no eval, no DOM. The realistic vulnerability surface
is therefore narrow, but not empty - reports in these areas are
in scope:

- **Algorithmic complexity**: input shapes that push a documented
  O(n) / O(depth) operation into pathological behaviour
  (denial-of-service via crafted flat rows or deep chains).
- **Prototype pollution**: any path by which crafted row payloads
  or ids could pollute `Object.prototype` or otherwise escape the
  data they describe.
- **Supply chain**: integrity of the published npm package
  (unexpected files, install scripts - the package ships none).

Bugs that corrupt a tree without crossing a trust boundary
(wrong sort order, an incorrect promotion) are ordinary bugs:
please open a public Issue for those.
