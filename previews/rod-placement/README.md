# Obsidian rod first-person placement preview

`comparison.png` shows the current v0.2.16 pose and a proposed pose with the
same geometry, handle location, texture, camera and projection. `cast-poses.png`
shows the proposed rest pose through the existing cast rotation offsets.
`Rod_First_Person_Preview.blend` is an editable Blender file with the original
PNG packed inside, the camera and both current/proposed sprite objects.
The Current object is hidden initially; toggle its visibility to compare.

This is an editor approximation, not Minecraft gameplay or a captured
Blockbench window. It uses Blockbench's actual bound-attachable preview
translation, ZYX rotation, camera position, target, 18 mm focal length and
16:9 aspect ratio. It mirrors Bedrock X and negates Bedrock X/Y rotations
as Blockbench's importer does. The green marker is the handle pivot,
not a rendered player hand. Skin geometry, engine-only hand animation,
user FOV and camera bob are not simulated.

The current projection reproduces the shaft extending below the frame.
The proposed first-person rotation is [147,30,21] with position [0,-4,0].
It was calculated against projected tip/line-end targets and checked in
both a software perspective projection and a Blender render. Third-person
settings and addon source have not been changed by this preview.

Sources are pinned in preview-settings.json. Original rod PNG supplied by
the user, byte-for-byte. Projection and Blender scripts are original.

Regenerate the PNGs: `python render_preview.py` (NumPy and Pillow).
Regenerate the Blender file/render: `blender -b --python build_blend.py`.

The addon remains v0.2.16 until the proposed visual placement is reviewed.
