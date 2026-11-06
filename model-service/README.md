# Deploy the trained MPNet evaluator

The CRM offers **Deterministic rules** and **MPNet v3**. MiniLM and BGE remain in
the offline experiment results but are not deployed or loaded by this service.

The actual trained MPNet AI and buyer encoders are committed under
`weights/mpnet-v3/`. A normal Git clone includes the weights: no Git LFS setup,
Release download, model-hosting account or copy from the experiment owner's Mac
is required. Each original encoder is about 438 MB. The unchanged tensors are
stored as standard Hugging Face safetensors shards, all below GitHub's 100 MiB
per-file limit; the two encoders total about 876 MB. `manifest.json` records the
size and SHA-256 of every file and the original checkpoint hashes.

At build time, `verify_weights.py` checks the local files and shard indexes
without accessing the network. Missing or corrupt files fail the build. The
runtime reads the shards directly, so no merged copy or archive is needed.

The bundle contains the original FP32 tensor values, with the trained logistic
coefficients and dev thresholds stored as plain JSON. Inference avoids SetFit,
scikit-learn and pickle at runtime. It keeps
the original tokenizer, mean pooling, normalization, maximum length 128 and
thresholds. No retraining or quantization is performed.
The upstream model attribution and Apache 2.0 license are retained in `licenses/`.

## Vercel setup

The model service is a **separate Vercel project/function** from the Express API
and Next.js frontend. Do not try to load Python weights inside the Node function.

1. Create a Vercel project from this GitHub repository, with Root Directory
   **`model-service`**, Framework Preset **Other**, and Python **3.12**. The checked-in
   `vercel.json` verifies the committed weights during the build.
2. Set server-side `MERTO_MODEL_TOKEN` to a strong shared secret. Set
   `VERCEL_SUPPORT_LARGE_FUNCTIONS=1` and enable Fluid compute. The FP32 pair plus
   PyTorch exceeds the standard 500 MB Python bundle limit, so the project's
   **Large Functions** support is required even though runtime memory is 2 GB.
   See [Vercel limits](https://vercel.com/docs/functions/limitations) and
   [Large Functions](https://vercel.com/changelog/vercel-functions-can-now-be-up-to-5-gb-in-package-size-7yAwSyCig0IQDXUIDistvS/eadf06d6c3).
3. The service uses its own bearer token. Make its API reachable by the backend;
   if Vercel Deployment Protection is enabled, configure access for this
   server-to-server connection (the model endpoint still requires its token).
4. Apply `supabase/migrations/20261103000100_mpnet_evaluation.sql` to the hosted
   database through the team's normal migration process. It adds MPNet-only
   results/review tables and leaves existing deterministic records intact.
5. On the **Express backend** project, set `MERTO_MODEL_URL` to the model service's
   HTTPS origin (no path) and `MERTO_MODEL_TOKEN` to the same secret, then redeploy.
   Keep its existing `DATABASE_URL` and login settings. Neither value belongs in
   the browser or a `NEXT_PUBLIC_` variable.

The deployed AI Review page now advertises exactly two choices. Without
`MERTO_MODEL_URL`, the backend preserves its deterministic-only default. A
configured but unavailable MPNet service returns 503; it never substitutes rules
while presenting the result as MPNet. Deterministic evaluation remains usable
during a model outage. The selected evaluator is pinned by the page URL and API
header, and each evaluator keeps separate flags, reviews and summary metrics.

Once that model project is connected to the deployed Git branch, later merges
deploy its tracked weights together with its code. The existing frontend and
Express projects do not become a Python model service just because weights are
committed. Initial project setup, the hosted migration and server-side model
URL/token configuration are still required.

## Memory and validation

Only two MPNet encoders are loaded (AI/buyer), totaling about 876 MB of FP32
weights. Inference is CPU-only, with batches of at most four and a process-wide
lock around loading/inference to prevent concurrent duplicate models or
activation peaks. Prediction caches are bounded to 2,048 texts per side.

The real HTTP handler is checked against all **960 frozen v3 test messages**:
all 2,880 threshold decisions match, with **936/960 whole-message accuracy**.
Maximum score differences are `7.47e-7` on macOS arm64 and `3.51e-6` on Linux
x86_64, both below the `1e-5` tolerance, with no changed threshold decisions.

The Linux workflow passed under a hard **2 GiB, one-CPU Docker limit**, with no
extra swap and no OOM. Its process peak RSS was **1,216,061,440 bytes (1.22 GB)**,
including a 64-message maximum-length stress request. The earlier macOS peak was
about 1.07 GB. See the committed
[Linux verification report](../backend/ml/predictions/v3-natural-s42/mpnet-linux-deployment-verification.json)
and linked Actions run. These are controlled test measurements, not production
Vercel measurements; inspect Vercel Observability after deployment as well.

For a local check:

```sh
python3.12 -m venv model-service/.venv
model-service/.venv/bin/pip install -r model-service/requirements.txt
model-service/.venv/bin/python model-service/verify_weights.py
# Set MERTO_MODEL_TOKEN in your shell, then:
model-service/.venv/bin/python model-service/run_local.py
model-service/.venv/bin/python model-service/verify_deployment.py --output /tmp/mpnet-verification.json
```

The verifier is development-only and reads frozen labels; the running inference
service does not. Synthetic message-label accuracy is different from CRM flag
rate and does not establish production conversation-level accuracy.

## Reproduce the tracked shards

With the training dependencies installed, export trusted local checkpoints with
`python model-service/export_bundle.py --run-dir <training-run> --output-dir <new-directory>`.
The exporter produces `<new-directory>/mpnet-v3/`, checks every saved tensor for
exact equality with its source, and records the source hashes. Commit the
exported directory as `model-service/weights/mpnet-v3/` together with the code.
The exporter reads trusted training pickles only to extract the heads; pickles
are not shipped in the runtime bundle. Sharding changes storage, not precision,
thresholds, learned values or the evaluation protocol.
