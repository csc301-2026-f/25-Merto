# MPNet model attribution

Base encoder: [sentence-transformers/all-mpnet-base-v2](https://huggingface.co/sentence-transformers/all-mpnet-base-v2), published by Sentence Transformers under Apache License 2.0.

This distribution contains two modified, domain-fine-tuned copies of that encoder,
trained for Merto AI and buyer signal classification with SetFit (v3 natural
synthetic corpus, seed 42). The original pretrained model is not represented as
the task-fine-tuned model. Trained logistic heads and development-calibrated
thresholds accompany the encoder weights. Deployment retains FP32 precision.

The accompanying `MPNET-APACHE-2.0.txt` contains the upstream license terms. This
notice concerns the distributed model artifacts and does not relicense the
entire Merto repository.
