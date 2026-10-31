import bpy
import os
import sys

args = sys.argv[sys.argv.index("--") + 1:]
fbx_path, output_path = args[0], args[1]

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(
    filepath=fbx_path,
    use_anim=True,
    use_image_search=True,
    use_custom_normals=True,
)

# Rebuild the imported scan material as a compact PBR material.
for material in bpy.data.materials:
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    bsdf = next((n for n in nodes if n.type == "BSDF_PRINCIPLED"), None)
    if bsdf is None:
        bsdf = nodes.new("ShaderNodeBsdfPrincipled")
        output = next((n for n in nodes if n.type == "OUTPUT_MATERIAL"), None)
        if output is None:
            output = nodes.new("ShaderNodeOutputMaterial")
        links.new(bsdf.outputs["BSDF"], output.inputs["Surface"])

    images = list(bpy.data.images)
    diffuse = next((i for i in images if "dif" in i.name.lower() or "diffuse" in i.name.lower()), None)
    normal = next((i for i in images if "norm" in i.name.lower()), None)
    gloss = next((i for i in images if "gloss" in i.name.lower()), None)

    if diffuse:
        diffuse.colorspace_settings.name = "sRGB"
        tex = nodes.new("ShaderNodeTexImage")
        tex.image = diffuse
        links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    if normal:
        normal.colorspace_settings.name = "Non-Color"
        tex = nodes.new("ShaderNodeTexImage")
        tex.image = normal
        normal_map = nodes.new("ShaderNodeNormalMap")
        links.new(tex.outputs["Color"], normal_map.inputs["Color"])
        links.new(normal_map.outputs["Normal"], bsdf.inputs["Normal"])
    if gloss:
        gloss.colorspace_settings.name = "Non-Color"
        tex = nodes.new("ShaderNodeTexImage")
        tex.image = gloss
        invert = nodes.new("ShaderNodeInvert")
        links.new(tex.outputs["Color"], invert.inputs["Color"])
        links.new(invert.outputs["Color"], bsdf.inputs["Roughness"])
    bsdf.inputs["Metallic"].default_value = 0.0
    if not gloss:
        bsdf.inputs["Roughness"].default_value = 0.68

# Keep the scan crisp but suitable for a browser game.
for image in bpy.data.images:
    if image.source != "FILE":
        continue
    try:
        width, height = image.size
        if max(width, height) > 4096:
            scale = 4096 / max(width, height)
            image.scale(max(1, int(width * scale)), max(1, int(height * scale)))
        image.pack()
    except Exception as exc:
        print("Texture processing warning:", image.name, str(exc))

for obj in bpy.context.scene.objects:
    if obj.type == "MESH":
        obj.select_set(True)
        obj["renderpeople_scan_asset"] = True
    else:
        obj.select_set(False)

for obj in bpy.data.objects:
    if obj.type == "ARMATURE":
        print("RENDERPEOPLE_ARMATURE:", obj.name)
        print("RENDERPEOPLE_BONES:", ",".join(b.name for b in obj.data.bones))
for action in bpy.data.actions:
    print("RENDERPEOPLE_ACTION:", action.name, action.frame_range[:])

os.makedirs(os.path.dirname(output_path), exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=output_path,
    export_format="GLB",
    export_animations=True,
    export_skins=True,
    export_apply=True,
    export_image_format="AUTO",
    export_keep_originals=False,
)
print("RENDERPEOPLE_GLB_EXPORTED:", output_path, os.path.getsize(output_path))
