"""Project the pack sprite with Blockbench's bound-attachable first-person preset.
This is an editor preview, not a Minecraft renderer. Coordinates mirror X as
Blockbench's Bedrock importer does; Euler rotations negate Bedrock X and Y.
"""
from pathlib import Path
import json, math
import numpy as np
from PIL import Image, ImageDraw, ImageFont
ROOT=Path(__file__).resolve().parents[2]
OUT=Path(__file__).parent
TEXTURE=ROOT/'jagsbys-underworld/resource_pack/textures/items/lava_fishing/obsidian_fishing_rod.png'
if not TEXTURE.exists(): TEXTURE=OUT/'obsidian_fishing_rod.png'
W,H=960,540

def rotation(angles):
 x,y,z=np.radians(angles)
 rx=np.array([[1,0,0],[0,np.cos(x),-np.sin(x)],[0,np.sin(x),np.cos(x)]])
 ry=np.array([[np.cos(y),0,np.sin(y)],[0,1,0],[-np.sin(y),0,np.cos(y)]])
 rz=np.array([[np.cos(z),-np.sin(z),0],[np.sin(z),np.cos(z),0],[0,0,1]])
 return rz@ry@rx
BASE=rotation([-95,45,115])
CAM=np.array([0,19,-40]);FWD=np.array([0,-3,40]);FWD=FWD/np.linalg.norm(FWD)
RIGHT=np.cross(FWD,[0,1,0]);RIGHT/=np.linalg.norm(RIGHT);UP=np.cross(RIGHT,FWD)
PIVOT=np.array([0,24,0])
CURRENT=json.loads((OUT/'preview-settings.json').read_text())['current']
PROPOSED={'rotation': [142.49, 26.09, 34.72], 'position': [3.613, -0.843, 9.103]}

def world(pixel,pose):
 x,y=pixel;v=np.array([-(x/4-2),22+(64-y)/4,0])
 rot=pose['rotation'];r=rotation([-rot[0],-rot[1],rot[2]])
 return BASE@(PIVOT+np.array(pose['position'])+r@(v-PIVOT))+np.array([-20,21,0])

def project(pixel,pose):
 d=world(pixel,pose)-CAM;depth=d@FWD
 return np.array([W*(.5+(d@RIGHT/depth)*18/35),H*(.5-(d@UP/depth)*18/(35/(W/H)))])

def render(pose,label):
 im=Image.new('RGBA',(W,H),(28,32,41,255));dr=ImageDraw.Draw(im)
 for x in range(0,W,60):dr.line((x,0,x,H),fill=(40,45,55,255))
 for y in range(0,H,60):dr.line((0,y,W,y),fill=(40,45,55,255))
 dr.line((W/2-10,H/2,W/2+10,H/2),fill=(175,182,194,255),width=2)
 dr.line((W/2,H/2-10,W/2,H/2+10),fill=(175,182,194,255),width=2)
 dr.rectangle((W*.355,H*.93,W*.642,H-1),fill=(48,51,59,255),outline=(120,126,138,255),width=2)
 dr.text((W*.36,H*.94),'Hotbar reference',fill=(180,186,195,255),font=FONT)
 tex=Image.open(TEXTURE).convert('RGBA')
 src=np.array([[0,0],[64,0],[64,64],[0,64]])
 dst=np.array([project(p,pose) for p in src])
 # Pillow maps output screen coordinates back to the original texture.
 A=[];b=[]
 for (u,v),(x,y) in zip(src,dst):
  A.extend([[x,y,1,0,0,0,-u*x,-u*y],[0,0,0,x,y,1,-v*x,-v*y]]);b.extend([u,v])
 coeff=np.linalg.solve(np.array(A),np.array(b))
 layer=tex.transform((W,H),Image.Transform.PERSPECTIVE,tuple(coeff),resample=Image.Resampling.NEAREST)
 im=Image.alpha_composite(im,layer)
 dr=ImageDraw.Draw(im)
 handle=project((8,56),pose);hx,hy=handle
 dr.ellipse((hx-5,hy-5,hx+5,hy+5),outline=(84,226,159,255),width=2)
 dr.text((hx-82,hy+12),'Handle / grip pivot',fill=(84,226,159,255),font=FONT)
 dr.rectangle((0,0,W,58),fill=(16,20,27,255));dr.text((20,17),label,fill='white',font=TITLE)
 return im
FONT=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',16)
TITLE=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',23)
render(CURRENT,'Current v0.2.20').save(OUT/'current-first-person.png')
render(PROPOSED,'Shifted right — orientation unchanged').save(OUT/'proposed-first-person.png')
comparison=Image.new('RGB',(W*2,H+62),(16,20,27));comparison.paste(render(CURRENT,'Current v0.2.20'),(0,0));comparison.paste(render(PROPOSED,'Shifted right — orientation unchanged'),(W,0))
d=ImageDraw.Draw(comparison);d.text((20,H+20),'Blockbench attachable-camera approximation. This is an editor preview, not an in-game screenshot.',font=FONT,fill=(210,217,230))
comparison.save(OUT/'comparison.png')
json.dump({'current':CURRENT,'proposed':PROPOSED,'camera':{'position':CAM.tolist(),'target':[0,16,0],'focal_length':18,'aspect':16/9},'base':{'position':[-20,21,0],'rotation_degrees':[-95,45,115],'rotation_order':'ZYX'},'grip_pixel':[8,56],'sources':{'blockbench':'https://github.com/JannisX11/blockbench/blob/7c92e27d237e365110030d73e92c5d1605f0d311/js/formats/bedrock/attachable_preview.js','bedrock_import':'https://github.com/JannisX11/blockbench/blob/7c92e27d237e365110030d73e92c5d1605f0d311/js/formats/bedrock/bedrock.js'}},open(OUT/'preview-settings.json','w'),indent=2)
print('Rendered before/after projections using the same camera and geometry.')
