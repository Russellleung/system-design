# Render deployment guidance

Read this only when a project selects Render.

## Access

Use Render's official hosted MCP server with OAuth for interactive Codex work. Set the intended workspace before reading or changing resources. Dashboard URLs are private browser surfaces and cannot substitute for MCP/API/CLI access.

Use the CLI or API key only for non-interactive automation. Keep credentials outside the repository. Treat environment-variable replacement, deploy triggering and resource creation as external mutations subject to the project contract.

## Blueprint and monorepo behaviour

Keep `render.yaml` versioned. For the current Closet Compass Blueprint, `rootDir` points to the application directory and these Docker paths are relative to that directory:

```yaml
rootDir: autonomous-code-factory/apps/wardrobe-advisor
dockerfilePath: ./Dockerfile
dockerContext: .
```

This shape is backed by a successful deployment. If another repository behaves differently, use its deploy log as evidence and keep the correction project-scoped until reproduced.

## Verification sequence

1. Validate the Blueprint syntax and inspect the exact branch/commit to deploy.
2. Build the Docker image locally.
3. Run the container without production secrets and execute its smoke test.
4. Push a feature branch explicitly; verify the remote ref.
5. Observe deploy status and logs through MCP.
6. Test the public health endpoint and primary journey.
7. Record service ID, public URL, plan, commit and cleanup action in `CHECKPOINT.md`.

Free services can sleep and cold-start. Do not interpret the first slow response as an application regression without separating cold-start time from steady-state latency.
