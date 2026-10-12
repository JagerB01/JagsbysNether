import bpy,json,math
from pathlib import Path
from mathutils import Matrix,Vector,Euler
out=Path(__file__).resolve().parent
s=json.loads((out/'preview-settings.json').read_text())
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene
scene.render.engine='BLENDER_EEVEE_NEXT';scene.render.resolution_x=960;scene.render.resolution_y=540;scene.render.resolution_percentage=100
scene.world.color=(.05,.05,.05)
# Coordinate mapping from Blockbench (Y up) to Blender (Z up).
mapmat=Matrix(((1,0,0,0),(0,0,-1,0),(0,1,0,0),(0,0,0,1)))
base=Euler(tuple(math.radians(a) for a in s['base']['rotation_degrees']),'XYZ').to_matrix().to_4x4()
# Explicit ZYX multiplication matches THREE.Euler(...,'ZYX').
def rot(a):
 x,y,z=[math.radians(v) for v in a]
 return Matrix.Rotation(z,4,'Z')@Matrix.Rotation(y,4,'Y')@Matrix.Rotation(x,4,'X')
base=Matrix.Translation(Vector(s['base']['position']))@rot(s['base']['rotation_degrees'])
mat=bpy.data.materials.new('Original user PNG — alpha sprite');mat.use_nodes=True
nt=mat.node_tree;nt.nodes.clear();o=nt.nodes.new('ShaderNodeOutputMaterial');e=nt.nodes.new('ShaderNodeEmission');tr=nt.nodes.new('ShaderNodeBsdfTransparent');mix=nt.nodes.new('ShaderNodeMixShader');im=nt.nodes.new('ShaderNodeTexImage');im.image=bpy.data.images.load(str(out/'obsidian_fishing_rod.png'));im.image.pack();im.interpolation='Closest'
nt.links.new(im.outputs['Color'],e.inputs['Color']);nt.links.new(im.outputs['Alpha'],mix.inputs[0]);nt.links.new(tr.outputs[0],mix.inputs[1]);nt.links.new(e.outputs[0],mix.inputs[2]);nt.links.new(mix.outputs[0],o.inputs[0])
verts=[(2,-2,0),(-14,-2,0),(-14,14,0),(2,14,0)]
for name,pose in [('Current',s['current']),('Proposed',s['proposed'])]:
 mesh=bpy.data.meshes.new(name+' rod sprite');mesh.from_pydata(verts,[],[(0,1,2,3)]);mesh.update();uv=mesh.uv_layers.new(name='User PNG UV')
 for loop,coord in zip(mesh.loops,[(0,0),(1,0),(1,1),(0,1)]):uv.data[loop.index].uv=coord
 obj=bpy.data.objects.new(name+' first-person rod',mesh);scene.collection.objects.link(obj);obj.data.materials.append(mat)
 a=pose['rotation'];local=Matrix.Translation(Vector([0,24,0])+Vector(pose['position']))@rot([-a[0],-a[1],a[2]])
 obj.matrix_world=mapmat@base@local
 obj['bedrock_rotation']=a;obj['bedrock_position']=pose['position'];obj['grip_pixel']='8,56';obj['source']='preview-settings.json';obj.hide_render=name=='Current';obj.hide_set(name=='Current')
cam=bpy.data.cameras.new('Blockbench attachable camera');cam.lens=18;cam.sensor_width=35;cam.sensor_fit='HORIZONTAL'
c=bpy.data.objects.new('Preview camera',cam);scene.collection.objects.link(c);c.location=mapmat@Vector(s['camera']['position']);target=mapmat@Vector(s['camera']['target']);c.rotation_euler=(target-c.location).to_track_quat('-Z','Y').to_euler();scene.camera=c
scene['notice']='Editor approximation using Blockbench camera/base transforms, not Minecraft gameplay.'
scene['preview_sources']=json.dumps(s['sources'])
for area in bpy.context.screen.areas:
 if area.type=='VIEW_3D':area.spaces.active.region_3d.view_perspective='CAMERA'
scene.render.filepath=str(out/'blender-proposed.png')
bpy.ops.wm.save_as_mainfile(filepath=str(out/'Rod_First_Person_Preview.blend'))
bpy.ops.render.render(write_still=True)
