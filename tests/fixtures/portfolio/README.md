# External Portfolio Test Fixtures

This directory contains deterministic test fixtures for the external portfolio presentation test suite:

- `Tiago_Marcal_Ferreira_CV_MarkOps_EN_2026.pdf`
- `Tiago_Marcal_Ferreira_CV_MarkOps_PT_2026.pdf`

### Purpose & Scope

These files serve exclusively as byte-comparison fixtures for [`tests/browser/portfolio.spec.js`](../../browser/portfolio.spec.js).

When testing bilingual language toggling on the external portfolio website (`https://tiagomf.com` or local preview on port 3100), the test suite downloads the CV linked on the page and asserts byte-for-byte identity against these reference fixtures.

They are **not** application runtime assets and are isolated under `tests/fixtures/portfolio/` to prevent coupling between the core Pipeline Pulse application and external hiring presentation materials.
