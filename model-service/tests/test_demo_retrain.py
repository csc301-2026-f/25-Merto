"""The local demo's head refit: the optimizer and request checks (no model weights needed)."""
from pathlib import Path
import sys
import unittest

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from demo_retrain import MODEL, checked, fit_logistic, sigmoid


class FitLogisticTests(unittest.TestCase):
    def test_reaches_the_regularized_optimum_with_a_free_intercept(self):
        rng = np.random.default_rng(0)
        X = rng.normal(size=(300, 5))
        y = (X @ [1.5, -2, 0, 0.5, 1] + 0.3 + rng.normal(size=300) > 0).astype(float)
        weights = rng.uniform(0.5, 2, size=300)
        w, b = fit_logistic(X, y, weights)
        p = sigmoid(X @ w + b)
        # Stationary point of 0.5*||w||^2 + sum(weight*logloss): no penalty on the intercept.
        np.testing.assert_allclose(X.T @ (weights * (p - y)) + w, 0, atol=1e-8)
        self.assertAlmostEqual(float((weights * (p - y)).sum()), 0, places=8)

    def test_an_added_negative_lowers_its_own_score(self):
        rng = np.random.default_rng(1)
        X = rng.normal(size=(200, 3))
        y = (X[:, 0] > 0).astype(float)
        probe = np.array([[2.0, 0, 0]])
        w0, b0 = fit_logistic(X, y)
        w1, b1 = fit_logistic(np.vstack([X, probe, probe]), np.concatenate([y, [0, 0]]))
        self.assertLess(sigmoid(probe @ w1 + b1)[0], sigmoid(probe @ w0 + b0)[0])


class RequestChecks(unittest.TestCase):
    def test_accepts_signal_labels_and_rejects_malformed_rows(self):
        good = [{'side': 'ai', 'signal': 'off_tone', 'label': 0, 'text': 'Thanks!'},
                {'side': 'buyer', 'signal': 'asks_for_person', 'label': True, 'text': 'call me'}]
        self.assertEqual(checked(good, 10, 'labels'), good)
        for bad in [{'side': 'ai', 'signal': 'asks_for_person', 'label': 1, 'text': 'x'},
                    {'side': 'ai', 'signal': 'off_tone', 'label': 2, 'text': 'x'},
                    {'side': 'ai', 'signal': 'off_tone', 'label': 1, 'text': '  '},
                    {'side': 'robot', 'signal': 'off_tone', 'label': 1, 'text': 'x'}]:
            with self.assertRaises(ValueError):
                checked([bad], 10, 'labels')
        with self.assertRaises(ValueError):
            checked(good, 1, 'labels')

    def test_reports_the_retrained_version_on_model_responses(self):
        MODEL.version = 'v3-test+gm1'
        try:
            reported = MODEL.with_version({'engine': {'id': 'mpnet', 'version': 'v3-test'}, 'ready': True})
            self.assertEqual(reported['engine'], {'id': 'mpnet', 'version': 'v3-test+gm1'})
        finally:
            MODEL.version = None


if __name__ == '__main__':
    unittest.main()
