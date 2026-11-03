# Deploy the trained MPNet evaluator

The CRM offers **Deterministic rules** and **MPNet v3**. MiniLM and BGE remain in
the offline experiment results but are not deployed or loaded by this service.

The original trained MPNet AI and buyer encoders are published in the repository's
[GitHub Release](https://github.com/csc301-2026-f/25-Merto/releases/tag/mpnet-v3-natural-s42).
`weights-release.json` pins the asset URL, size and SHA-256. At build time,
`download_weights.py` downloads it and verifies the archive and every extracted
file. A fresh Git clone does not require a copy from the experiment owner's Mac.
The 438 MB encoder files exceed ordinary Git's file limit; the **actual weights**
are Release attachments, not placeholder files or prediction fixtures.

The bundle contains the original FP32 weights and original sklearn heads, plus
plain JSON copies of the logistic coefficients and dev thresholds. Inference
uses the JSON heads, avoiding SetFit, scikit-learn and pickle at runtime. It keeps
the original tokenizer, mean pooling, normalization, maximum length 128 and
thresholds. No retraining or quantization is performed.

## Vercel setup

The model service is a **separate Vercel project/function** from the Express API
and Next.js frontend. Do not try to load Python weights inside the Node function.

1. Create a Vercel project from this GitHub repository, with Root Directory
   **`model-service`**, Framework Preset **Other**, and Python **3.12**. The checked-in
   `vercel.json` runs the weight downloader during the build.
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

Repository code and weights are ready for these steps; pushing a PR does not
configure Vercel projects, apply a hosted migration or change production secrets.

## Memory and validation

Only two MPNet encoders are loaded (AI/buyer), totaling about 876 MB of FP32
weights. Inference is CPU-only, with batches of at most four and a process-wide
lock around loading/inference to prevent concurrent duplicate models or
activation peaks. Prediction caches are bounded to 2,048 texts per side.

The real HTTP handler is checked against all **960 frozen v3 test messages**:
all 2,880 threshold decisions match, with **936/960 whole-message accuracy** and
maximum score difference below `0.000001`. Local macOS arm64 process peak RSS was
about **1.07 GB**, including a 64-message maximum-length stress request. That
number is a local measurement, not a production Vercel measurement. The
`MPNet deployment (2 GiB)` workflow builds the Linux CPU image and repeats the
same checks under a hard **2 GiB, one-CPU Docker limit**; inspect its artifact for
the Linux measurement. Verify Vercel Observability after deploying as well.

For a local check:

```sh
python3.12 -m venv model-service/.venv
model-service/.venv/bin/pip install -r model-service/requirements.txt
model-service/.venv/bin/python model-service/download_weights.py
# Set MERTO_MODEL_TOKEN in your shell, then:
model-service/.venv/bin/python model-service/run_local.py
model-service/.venv/bin/python model-service/verify_deployment.py --output /tmp/mpnet-verification.json
```

The verifier is development-only and reads frozen labels; the running inference
service does not. Synthetic message-label accuracy is different from CRM flag
rate and does not establish production conversation-level accuracy.
