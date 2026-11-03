"""Non-green bar comparisons on one identical frozen v3 test."""
import argparse,json,shutil
from pathlib import Path
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Patch
from plot_v3_results import NAMES,TITLES,COLOURS,INK,GRID


def style(ax,top=112):
 ax.set_ylim(0,top);ax.set_yticks(range(0,101,20));ax.set_axisbelow(True)
 ax.yaxis.grid(True,color=GRID,linewidth=.7);ax.tick_params(length=0,labelsize=11,pad=8,labelcolor=INK)
 ax.set_ylabel('Whole-message accuracy (%)',color=INK,fontsize=11)
 for k,s in ax.spines.items():s.set_visible(k=='bottom');s.set_color(GRID)

def values(d,bucket):
 vv=[100*d['deterministic']['combined'][bucket]['whole_message_accuracy']]
 for m in NAMES:vv += [100*d['previous'][m]['combined'][bucket]['whole_message_accuracy'],100*d['current'][m]['combined'][bucket]['whole_message_accuracy']]
 return vv

def draw(ax,d,bucket,detail=False):
 xs=[0,1.8,2.7,4.5,5.4,7.2,8.1];vv=values(d,bucket)
 cc=['#64748B','#D5DAE3',COLOURS[0],'#D5DAE3',COLOURS[1],'#D5DAE3',COLOURS[2]]
 bars=ax.bar(xs,vv,width=.68,color=cc,zorder=3)
 for i in [1,3,5]:bars[i].set_hatch('//');bars[i].set_edgecolor('#8793A6');bars[i].set_linewidth(.6)
 ax.bar_label(bars,labels=[f'{x:.1f}%' for x in vv],padding=4,fontsize=10 if detail else 12,color=INK)
 if detail:
  ax.set_xticks([0,2.25,4.95,7.65],['Rules','MiniLM','BGE-base','MPNet']);style(ax,108)
 else:
  ax.set_xticks(xs,['Deterministic\nwording rules','MiniLM\nprevious','MiniLM\nretrained','BGE-base\nprevious','BGE-base\nretrained','MPNet\nprevious','MPNet\nretrained'])
  style(ax)
  for i,m in enumerate(NAMES):
   a,b=xs[1+2*i],xs[2+2*i];delta=d['deltas'][m][bucket]['new_minus_old_percentage_points']
   ax.plot([a,a,b,b],[103,105,105,103],color=COLOURS[i],linewidth=1.2)
   ax.text((a+b)/2,106.2,f'{delta:+.1f} pp',ha='center',va='bottom',fontsize=11,color=INK,fontweight='bold')

def main():
 ap=argparse.ArgumentParser();ap.add_argument('directory',type=Path);args=ap.parse_args();out=args.directory
 d=json.loads((out/'upgrade-comparison.json').read_text());assert json.loads((out/'baseline-verification.json').read_text())['passed']
 plt.rcParams.update({'font.family':'DejaVu Sans','axes.titlecolor':INK,'figure.facecolor':'white','axes.facecolor':'white'})
 fig,ax=plt.subplots(figsize=(14.7,6.8));fig.subplots_adjust(left=.065,right=.985,top=.76,bottom=.24)
 draw(ax,d,'all')
 fig.text(.065,.94,'Previous vs retrained models — same v3 test',fontsize=21,fontweight='bold',color=INK)
 fig.text(.065,.89,'960 synthetic messages · every label must match · pp = percentage points',fontsize=12,color='#536174')
 fig.text(.065,.10,'Previous models retain their original thresholds; retrained models use v3-dev thresholds. No test-set threshold tuning.',fontsize=10,color='#536174')
 fig.text(.065,.055,'Deterministic = current repository wording rules only. History-dependent final deployment flags are outside this comparison.',fontsize=10,color='#536174')
 fig.savefig(out/'v3-upgrade-bars.png',dpi=180,facecolor='white');plt.close(fig)
 fig,axes=plt.subplots(2,2,figsize=(14.8,10.5));fig.subplots_adjust(left=.065,right=.985,top=.80,bottom=.13,wspace=.17,hspace=.38)
 for ax,bucket,title in zip(axes.ravel(),['all','none','single','multi'],['All messages · n = 960','No signals · n = 320','One signal · n = 320','Multiple signals · n = 320']):
  draw(ax,d,bucket,detail=True);ax.set_title(title,loc='left',fontweight='bold',fontsize=13,pad=14)
 fig.text(.065,.95,'Where the upgrade gains — and where it loses',fontsize=21,fontweight='bold',color=INK)
 fig.text(.065,.91,'Identical frozen v3 messages and message-level labels for every method',fontsize=12,color='#536174')
 fig.legend(handles=[Patch(facecolor='#64748B',label='Current wording rules'),Patch(facecolor='#D5DAE3',edgecolor='#8793A6',hatch='//',label='Previous model'),Patch(facecolor=COLOURS[0],label='Retrained model (architecture colour)')],loc='upper left',bbox_to_anchor=(.06,.885),ncol=3,frameon=False,fontsize=11)
 fig.text(.065,.055,'The retrained models gain most on multiple signals. On no-signal messages, every retrained model has more false positives.',fontsize=10,color='#536174')
 fig.text(.065,.025,'Synthetic assistant-reviewed test · fixed previous thresholds · single trained instance per architecture · no production accuracy claim',fontsize=9.5,color='#536174')
 fig.savefig(out/'v3-upgrade-breakdown.png',dpi=180,facecolor='white');plt.close(fig)
 print('Saved overall and subgroup upgrade bar charts.')

if __name__=='__main__':main()
