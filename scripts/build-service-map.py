"""Trace water contours from bundled OSM tiles into a clean, scalable service map."""
from PIL import Image
from collections import defaultdict
from pathlib import Path
im = Image.new('RGB', (768,768))
for y in range(3):
 for x in range(3): im.paste(Image.open(f'public/images/map/{1114+x}-{1732+y}.png').convert('RGB'),(x*256,y*256))
pixels=im.load()
water=set()
for y in range(768):
 for x in range(768):
  r,g,b=pixels[x,y]
  if b-r>24 and b>g+3 and g-r>20: water.add((x,y))
edges=defaultdict(list)
for x,y in water:
 if (x,y-1) not in water: edges[(x,y)].append((x+1,y))
 if (x+1,y) not in water: edges[(x+1,y)].append((x+1,y+1))
 if (x,y+1) not in water: edges[(x+1,y+1)].append((x,y+1))
 if (x-1,y) not in water: edges[(x,y+1)].append((x,y))
def simplify(points,epsilon=1.1):
 if len(points)<3:return points
 a,b=points[0],points[-1];dx=b[0]-a[0];dy=b[1]-a[1];den=(dx*dx+dy*dy)**.5
 ds=[abs(dy*p[0]-dx*p[1]+b[0]*a[1]-b[1]*a[0])/den if den else ((p[0]-a[0])**2+(p[1]-a[1])**2)**.5 for p in points]
 m=max(ds);i=ds.index(m)
 if m<=epsilon:return [a,b]
 return simplify(points[:i+1],epsilon)[:-1]+simplify(points[i:],epsilon)
paths=[]
while edges:
 start=next(iter(edges));point=start;polygon=[start]
 while point in edges:
  nxt=edges[point].pop()
  if not edges[point]:del edges[point]
  polygon.append(nxt);point=nxt
  if point==start:break
 area=abs(sum(a[0]*b[1]-b[0]*a[1] for a,b in zip(polygon,polygon[1:]))) / 2
 if area<24:continue
 polygon=simplify(polygon)
 paths.append('M'+'L'.join(f'{x},{y}' for x,y in polygon)+'Z')
svg=f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 768 768"><title>Southwest Florida waterways — Cape Coral, Matlacha and Fort Myers</title><rect width="768" height="768" fill="#f7f9f4"/><path d="{' '.join(paths)}" fill="#c7e3dd" fill-rule="evenodd" stroke="#b1d4cd" stroke-width=".7"/></svg>'''
Path('public/images/southwest-florida.svg').write_text(svg)
print(f'Wrote {len(paths)} contours, {len(svg)} bytes')
