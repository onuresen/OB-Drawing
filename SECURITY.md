# Security Policy

## Supported version

Only the current `main` branch is supported while Object-Centric Drawing remains an experimental prototype.

## Reporting a vulnerability

Do not disclose suspected vulnerabilities, sensitive PDFs, exported project data, local file paths, or credentials in a public issue. Use GitHub's private vulnerability reporting for this repository after it is enabled. If private reporting is unavailable, open a public issue containing only a request for a private contact channel and no sensitive details.

## Local-data boundary

Object-Centric Drawing is designed to process selected PDFs in the browser and bind its supplied server to loopback. A security report should call out any behavior that uploads document content, exposes the loopback server beyond the local machine, persists source data unexpectedly, or allows imported project data to execute code.
