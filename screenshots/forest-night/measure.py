from PIL import Image, ImageStat
from pathlib import Path
import json
root=Path(__file__).resolve().parent
weights=(.2126,.7152,.0722)
regions={'sky':(710,20,800,125),'foliage':(1010,85,1190,155),'near_path':(630,745,850,880),'distant_path':(708,471,754,492)}
def stats(im):
 m=ImageStat.Stat(im).mean
 return {'rgb':[round(v,2) for v in m],'display_luma_percent':round(sum(v*w for v,w in zip(m,weights))/255*100,2)}
report={'method':'Mean Rec.709 weighted display RGB luma / 255; this is screenshot brightness, not linear-light relative luminance. Full viewport includes UI. Dialog measured separately and excluded from scene target.','target_display_luma_percent':[12,25],'images':{}}
for p in sorted(root.glob('*.png')):
 im=Image.open(p).convert('RGB');r=stats(im)
 linear=[]
 for channel in im.split():
  hist=channel.histogram()
  linear.append(sum(count*((value/255)/12.92 if value/255<=.04045 else ((value/255+.055)/1.055)**2.4) for value,count in enumerate(hist))/(im.width*im.height))
 r['linear_luminance_percent']=round(sum(v*w for v,w in zip(linear,weights))*100,2)
 if p.stem in ['night-start','night-middle','night-projects']:
  r['regions']={name:stats(im.crop(box))|{'bounds':list(box)} for name,box in regions.items()}
  r['brightness_pass']=12<=r['display_luma_percent']<=25
  r['foliage_green_dominant']=r['regions']['foliage']['rgb'][1]>max(r['regions']['foliage']['rgb'][0],r['regions']['foliage']['rgb'][2])
  r['sky_blue_dominant']=r['regions']['sky']['rgb'][2]>max(r['regions']['sky']['rgb'][0],r['regions']['sky']['rgb'][1])
  near=r['regions']['near_path'];far=r['regions']['distant_path']
  r['near_path_brighter']=near['display_luma_percent']>far['display_luma_percent']
  r['near_path_warmer']=(near['rgb'][0]/max(near['rgb'][2],.01))>(far['rgb'][0]/max(far['rgb'][2],.01))
 report['images'][p.stem]=r
(root/'brightness.json').write_text(json.dumps(report,indent=2)+'\n')
for name,r in report['images'].items():print(name,r['display_luma_percent'], {k:v for k,v in r.items() if isinstance(v,bool)})
for name in ['night-start','night-middle','night-projects']:
 r=report['images'][name]
 assert all(r[k] for k in ['brightness_pass','foliage_green_dominant','sky_blue_dominant','near_path_brighter','near_path_warmer']),name
