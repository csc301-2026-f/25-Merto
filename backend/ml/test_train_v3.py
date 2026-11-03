"""Small independent arithmetic checks for the scientific metric implementation."""
import unittest
import numpy as np
from train_v3 import metrics,thresholds

class MetricChecks(unittest.TestCase):
 def test_label_counts_and_exact_messages(self):
  y=np.array([[1,0],[0,1],[1,1]],dtype=bool)
  p=np.array([[.9,.1],[.7,.8],[.4,.6]])
  result=metrics(y,p,[.5,.5])
  self.assertEqual(result['label_decisions_correct'],4)
  self.assertEqual(result['label_decisions'],6)
  self.assertEqual(result['whole_message_correct'],1)
  self.assertEqual(result['messages'],3)
  self.assertEqual(result['tp'],[1,2]);self.assertEqual(result['fp'],[1,0]);self.assertEqual(result['fn'],[1,0])
  self.assertAlmostEqual(result['macro_f1'],.75)
  self.assertAlmostEqual(result['micro_f1'],.75)
 def test_dev_thresholds_prefer_nearest_half_on_ties(self):
  y=np.array([[1,1],[1,0],[0,1],[0,0]],dtype=bool)
  p=np.array([[.4,.9],[.6,.4],[.3,.8],[.1,.3]])
  self.assertEqual(thresholds(y,p),[.4,.5])
 def test_no_positive_subset_retains_accuracy(self):
  result=metrics(np.zeros((2,2),dtype=bool),np.array([[.2,.1],[.9,.1]]),[.5,.5])
  self.assertEqual(result['whole_message_correct'],1)
  self.assertEqual(result['label_decisions_correct'],3)
  self.assertEqual(result['positives'],[0,0])
  self.assertTrue(np.isfinite(result['macro_f1']))

if __name__=='__main__':unittest.main()
