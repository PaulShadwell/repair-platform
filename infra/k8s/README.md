# Kubernetes (repair-platform)

## Automated image builds (GitHub Actions)

This repo includes `.github/workflows/docker-publish.yml`. On every push to `main` or `master`, it builds and pushes:

- `ghcr.io/<owner>/repair-platform/api:latest` (and SHA tags)
- `ghcr.io/<owner>/repair-platform/web:latest` (and SHA tags)

You still need cluster access to roll out (below).

### If the workflow fails with **403 Forbidden** pushing to GHCR

1. **Repository → Settings → Actions → General → Workflow permissions**  
   Set **Read and write permissions** (not read-only). Save. Without this, `GITHUB_TOKEN` cannot push packages.

2. **Organization** (if the repo is under an org): org **Settings → Actions → General** may also restrict workflow permissions — allow read/write for workflows.

3. **Optional fallback:** Create a [Personal Access Token (classic)](https://github.com/settings/tokens) with scopes **`write:packages`** and **`read:packages`**. Add it as a repository secret named **`GHCR_TOKEN`**. The workflow uses `GHCR_TOKEN` when set, otherwise `GITHUB_TOKEN`.

4. **Package already exists elsewhere:** On GitHub → **Packages** → open the package → **Package settings** → **Manage Actions access** → ensure this repository has **Write** (or delete the orphaned package and let CI create a fresh one).

After a green workflow run, point Kubernetes at `latest` or a specific SHA:

```bash
kubectl set image deployment/repair-platform-api -n repair-platform \
  api=ghcr.io/OWNER/repair-platform/api:latest
kubectl set image deployment/repair-platform-web -n repair-platform \
  web=ghcr.io/OWNER/repair-platform/web:latest
```

Replace `OWNER` with your GitHub username or org.

---

Manifests deploy to namespace `repair-platform`. Typical order:

```bash
kubectl apply -f namespace.yaml
kubectl apply -f secrets.yaml          # your real secrets, not the example
kubectl apply -f postgres.yaml
# wait until postgres pod is Running and PVC is Bound
kubectl apply -f api.yaml
kubectl apply -f web.yaml
kubectl apply -f ingress.yaml
# optional: cloudflared.yaml
```

## GHCR image pull secret

Deployments reference `imagePullSecrets: ghcr-pull`. If that secret **does not exist** in the namespace, fix it **before** relying on the workloads:

```bash
kubectl create secret docker-registry ghcr-pull \
  --namespace repair-platform \
  --docker-server=ghcr.io \
  --docker-username=YOUR_GITHUB_USERNAME \
  --docker-password=YOUR_GHCR_PAT \
  --docker-email=unused@example.com
```

Use a GitHub **PAT** with `read:packages` (and `write:packages` if you push images). If the images are **public**, you can remove the `imagePullSecrets` block from `api.yaml` and `web.yaml` instead.

## ImagePullBackOff / `not found` (wrong or missing image tag)

If events show `ErrImagePull` / `ImagePullBackOff` with:

`failed to resolve reference ".../api:TAG": ... not found`

the cluster is asking GHCR for a **tag that does not exist** (build failed, push never ran, or the deploy was updated before the workflow finished).

**Fix (immediate):** Point the deployments at a tag you know exists (e.g. the last good build) or at `latest` after a successful push:

```bash
kubectl set image deployment/repair-platform-api -n repair-platform \
  api=ghcr.io/paulshadwell/repair-platform/api:20260327-171346
kubectl set image deployment/repair-platform-web -n repair-platform \
  web=ghcr.io/paulshadwell/repair-platform/web:20260327-171346
```

Replace the tag with whatever appears under **Packages** in GitHub for your repo. Then:

```bash
kubectl rollout status deployment/repair-platform-api -n repair-platform
kubectl rollout status deployment/repair-platform-web -n repair-platform
```

**Prevent:** In CI, push images **before** updating Kubernetes to the new tag (or only bump the deploy after the push job succeeds). The YAML in this repo uses `:latest`; if you use timestamp tags from pipelines, keep deploy and registry in sync.

## Pods stuck in **Pending**

`Pending` means the scheduler has not placed the pod on a node yet (different from `ImagePullBackOff` / `CrashLoopBackOff`).

### 1. PersistentVolumeClaim not Bound (very common for `repair-platform-api`)

The API pod mounts `repair-platform-api-data-pvc`. If that PVC stays **Pending**, the API pod often stays **Pending** too.

```bash
kubectl get pvc -n repair-platform
kubectl describe pvc repair-platform-api-data-pvc -n repair-platform
kubectl describe pvc repair-platform-postgres-pvc -n repair-platform
```

**Fix:** Your cluster needs a **default StorageClass** or you must set `storageClassName` on the PVC to a class that can provision volumes (e.g. your provider’s `standard`, `longhorn`, etc.):

```bash
kubectl get storageclass
```

Edit the PVC manifests (or patch) to add under `spec`:

```yaml
storageClassName: <name-from-get-storageclass>
```

Re-apply the PVC; wait until `STATUS` is **Bound**, then the API pod can schedule.

### 2. Insufficient CPU / memory on nodes

```bash
kubectl describe pod -n repair-platform <pending-pod-name>
```

Look for events like `0/1 nodes are available: insufficient cpu` or `insufficient memory`.

**Fix:** Resize the node pool / VM, remove other workloads, or lower resource **requests** on other pods in the namespace.

### 3. Taints / node selectors

If nodes are tainted and the pod has no matching toleration, the pod stays Pending. Check:

```bash
kubectl get nodes -o custom-columns=NAME:.metadata.name,TAINTS:.spec.taints
kubectl describe pod -n repair-platform <pending-pod-name>
```

### 4. Namespace ResourceQuota / LimitRange

```bash
kubectl describe resourcequota -n repair-platform
kubectl describe limitrange -n repair-platform
```

If quotas require CPU/memory requests on every pod, ensure `api` / `web` / `postgres` define `resources.requests` (the manifests include modest defaults).

## Quick event log

```bash
kubectl get events -n repair-platform --sort-by='.lastTimestamp' | tail -40
```

## Database migrations

After deploying a new API image that includes Prisma migrations, run migrations **once** (Job or one-off pod using the same image and `DATABASE_URL`):

```bash
kubectl run repair-migrate -n repair-platform --rm -it --restart=Never \
  --image=ghcr.io/paulshadwell/repair-platform/api:latest \
  --env="DATABASE_URL=$(kubectl get secret repair-platform-secrets -n repair-platform -o jsonpath='{.data.DATABASE_URL}' | base64 -d)" \
  -- npx prisma migrate deploy --schema apps/api/prisma/schema.prisma
```

(Adjust image name and how you pass `DATABASE_URL` to match your setup.)
