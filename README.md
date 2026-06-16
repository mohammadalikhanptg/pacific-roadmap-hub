# Pacific Roadmap Hub

Single pane of glass showing the roadmap progress of every Pacific project.

- Data: one `projectRoadmap` document per project in Sanity (project 74704nsd, dataset production). Each project's agent writes only its own record.
- This app reads all `projectRoadmap` documents server-side and renders each as a card with a progress bar and an expandable milestone drill-down.
- Auth: intended to sit behind Microsoft (Entra) login. Interim: Vercel deployment protection.

## Env
- SANITY_PROJECT_ID (default 74704nsd)
- SANITY_DATASET (default production)
- SANITY_API_VERSION (default 2021-06-07)
- SANITY_READ_TOKEN (server-side read token)
