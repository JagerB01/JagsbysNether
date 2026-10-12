# Vanilla-comparison rod preview (v0.2.18)

The before pose is v0.2.17. The after pose is fitted to normalized shaft-tip
and grip landmarks measured from the user vanilla fishing-rod screenshot.
The grip is below the visible frame, as it is in that vanilla comparison.
The fit also constrains the sprite face to remain visible, rather than
turning it edge-on to match the landmarks. The original PNG is unchanged.

The renderer uses the pinned Blockbench attachable preview camera/base
transforms listed in preview-settings.json. This is an editor approximation,
not a captured Minecraft frame. Different FOV, bob and native camera
behavior may produce a small discrepancy.

Third person keeps the accepted rotation, with a half-model-unit raise of
the grip (-5 to -4.5). This is a small placement refinement based on the
comparison; it still requires checking on the user skin in Minecraft.

Run `python render_preview.py` to regenerate the two-view comparison.
Run `blender -b --python build_blend.py` for the editable scene and render.
The Blender file packs the original user texture and both poses.
