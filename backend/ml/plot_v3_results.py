"""White-background bar charts for the verified v3 results; no green palette."""
import argparse,json
from pathlib import Path
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

NAMES=['minilm','bge','mpnet'];TITLES=['MiniLM','BGE-base','MPNet']
COLOURS=['#3B70B1','#E28C37','#8B6CB7'];INK='#243247';GRID='#E5E7EB'

def format_axis(ax):
 ax.set_ylim(0,108);ax.set_yticks(range(0,101,20));ax.set_ylabel('Percent',color=INK)
 ax.set_axisbelow(True);ax.yaxis.grid(True,color=GRID,linewidth=.7)
 ax.tick_params(axis='both',length=0,labelsize=11,labelcolor=INK,pad=8)
 for name,sp in ax.spines.items():sp.set_visible(name=='bottom');sp.set_color(GRID)

def grouped(ax,values,labels):
 xx=np.arange(len(labels));width=.22
 for i,(name,colour) in enumerate(zip(TITLES,COLOURS)):
  bars=ax.bar(xx+(i-1)*width,values[i],width,color=colour,label=name,zorder=3)
  ax.bar_label(bars,labels=[f'{v:.1f}%' for v in values[i]],padding=4,fontsize=10,color=INK)
 ax.set_xticks(xx,labels);format_axis(ax)

def main():
 ap=argparse.ArgumentParser();ap.add_argument('run_dir',type=Path);args=ap.parse_args();run=args.run_dir
 x=json.loads((run/'comparison.json').read_text());assert json.loads((run/'verification.json').read_text())['passed']
 plt.rcParams.update({'font.family':'DejaVu Sans','axes.titlesize':14,'axes.titleweight':'bold','axes.titlecolor':INK,'figure.facecolor':'white','axes.facecolor':'white'})
 groups=['all','none','single','multi'];labels=['All messages\nn = 960','No signals\nn = 320','One signal\nn = 320','Multiple signals\nn = 320']
 values=[[100*x['models'][m]['combined'][g]['whole_message_accuracy'] for g in groups] for m in NAMES]
 fig,ax=plt.subplots(figsize=(13.6,6.6));fig.subplots_adjust(left=.07,right=.985,top=.76,bottom=.22)
 grouped(ax,values,labels)
 fig.text(.07,.945,'Retrained models on the frozen v3 test',fontsize=21,fontweight='bold',color=INK)
 fig.text(.07,.895,'Whole-message accuracy: every label in a message must be correct',fontsize=12,color='#536174')
 ax.legend(loc='lower left',bbox_to_anchor=(0,1.035),ncol=3,frameon=False,fontsize=11)
 fig.text(.07,.075,'Same 960 messages for all models · thresholds selected on dev · one trained instance per architecture',fontsize=10,color='#536174')
 fig.text(.07,.035,'Synthetic, assistant-authored and reviewed labels. These are message-signal results, not production final-flag accuracy.',fontsize=9.5,color='#536174')
 for filename in ['comparison.png','v3-models-bars.png']:fig.savefig(run/filename,dpi=180,facecolor='white')
 plt.close(fig)
 # Preserve the detailed precision/recall view as a separate bar-chart page.
 fig,axes=plt.subplots(2,1,figsize=(14.5,10.7));fig.subplots_adjust(left=.065,right=.985,top=.86,bottom=.14,hspace=.6)
 labels=['AI\nBooking','AI\nAvailability','AI\nQuoted amount','AI\nOff-tone','Buyer\nHuman request','Buyer\nPrice request']
 for ax,key,title in zip(axes,['precision','recall'],['Precision: how often a raised signal is correct','Recall: how often a true signal is found']):
  values=[]
  for m in NAMES:
   row=[]
   for side in ['ai','buyer']:row.extend(100*np.array(x['models'][m]['by_side'][side]['groups']['all'][key]))
   values.append(row)
  grouped(ax,values,labels);ax.set_title(title,loc='left',pad=12)
 fig.text(.065,.955,'Per-signal precision and recall',fontsize=21,fontweight='bold',color=INK)
 fig.legend(TITLES,loc='upper left',bbox_to_anchor=(.06,.925),ncol=3,frameon=False,fontsize=11)
 fig.text(.065,.045,'AI signal support: 140 positives per label · Buyer signal support: 240 per label · frozen v3 test',fontsize=10,color='#536174')
 fig.savefig(run/'v3-signal-pr-bars.png',dpi=180,facecolor='white');plt.close(fig)
 print('Saved non-green model comparison and precision/recall bar charts.')

if __name__=='__main__':main()
