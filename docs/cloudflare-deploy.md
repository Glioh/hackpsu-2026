# Automatic GitHub → Cloudflare deployment

The `Deploy game to Cloudflare` GitHub Actions workflow deploys the newest commit on `main` after tests pass. It also has a **Run workflow** button. Deployments run one at a time and always check out `main`, including manual runs. Local uncommitted changes are not deployed.

## One-time setup

1. Use a Cloudflare account with Workers Paid and Containers enabled. Containers are a paid product; this configuration does not activate billing or upgrade an account. Review [Cloudflare pricing](https://developers.cloudflare.com/containers/platform/pricing/) before enabling it.
2. Create an account-scoped Cloudflare API token using the **Edit Cloudflare Workers** template, adding **Workers Containers Write** (shown as **Containers Edit/Write** in some dashboard versions) for the intended account. The token must permit Worker deployment, Durable Object configuration, and container image/application deployment. Use the current labels in [Cloudflare's permission reference](https://developers.cloudflare.com/fundamentals/api/reference/permissions/). No DNS permissions are needed for the default workers.dev URL.
3. In [this repository's Actions secrets](https://github.com/Glioh/hackpsu-2026/settings/secrets/actions), add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. Enter secrets directly in GitHub; never commit them or paste them into chat.
4. Commit and push the workflow, Dockerfile, Cloudflare Worker/config, dependency files, and application changes to `main`.
5. Open **Actions → Deploy game to Cloudflare → Run workflow**, or push a new commit to `main`.

The deployment log prints a stable URL such as `https://two-body-brawl.YOUR-SUBDOMAIN.workers.dev`. Open that URL on the host and scan its room QR with each phone. `/health` returns the deployed Git commit so you can confirm which version is running. Initial container provisioning can take several minutes.

## How it runs

`cloudflare/worker.js` forwards all HTTP routes and WebSocket upgrades to one named container running the existing Express/Socket.IO server. This keeps every host and phone in the same in-memory room registry. `wrangler.jsonc` limits the deployment to one lite instance. The Docker image includes only production dependencies and game files, and runs as the `node` user.

The container sleeps after 30 minutes without HTTP activity. Active or paused visible host screens send a keepalive once per minute. Deployments and restarts close active rooms; hosts must reload and phones must join the new QR. Room state is not durable across deployment.

The earlier `trycloudflare.com` quick tunnel runs on the laptop. It is independent of this GitHub deployment, and GitHub cannot update that laptop process. The workflow creates a cloud-hosted service that does not depend on the laptop server. Cloudflare Pages alone cannot run this persistent Node server.

## Local validation

```sh
npm ci
npm test
npx wrangler deploy --dry-run --containers-rollout=none --outdir .deployment/cloudflare
```

This dry run validates the Worker bundle and bindings without building or deploying its container. To validate the Docker image, start Docker and run:

```sh
docker build -t two-body-brawl .
docker run --rm -p 3000:3000 two-body-brawl
```

To deploy from an authenticated machine with Docker running, use `npm run deploy:cloudflare`. The GitHub runner already supplies Docker. Full deployment and container-image validation remain pending until credentials and a Docker engine are available.

References: [Cloudflare Containers setup](https://developers.cloudflare.com/containers/get-started/), [Container HTTP/WebSocket forwarding](https://developers.cloudflare.com/containers/api/container-class/), [GitHub Actions authentication](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/).
