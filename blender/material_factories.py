# Exported read-only mirror of the `material_factories.py` Text datablock stored
# inside ninety-nine_pilots.blend (exported 2026-09-17). The .blend copy is
# authoritative -- this file exists so the pipeline code has an on-disk,
# reviewable, version-able copy instead of living only inside a Text datablock.
# If you edit inside Blender, re-export to keep this in sync.
#
# The two-tier shading pipeline referenced throughout PLAN_remaining_scenes.md:
# PhotorealArch_* materials via make_photoreal_material(), LowPolyProp_* via
# make_lowpoly_material().

import bpy, mathutils

def make_photoreal_material(name, base_color, roughness=0.5, metallic=0.0,
                             use_normal_proc=True, noise_scale=40.0, bump_strength=0.15,
                             transmission=0.0, ior=1.45):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    output = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Base Color"].default_value = (*base_color, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if "Transmission Weight" in bsdf.inputs:
        bsdf.inputs["Transmission Weight"].default_value = transmission
    elif "Transmission" in bsdf.inputs:
        bsdf.inputs["Transmission"].default_value = transmission
    if "IOR" in bsdf.inputs:
        bsdf.inputs["IOR"].default_value = ior
    if use_normal_proc:
        noise = nt.nodes.new("ShaderNodeTexNoise")
        noise.inputs["Scale"].default_value = noise_scale
        bump = nt.nodes.new("ShaderNodeBump")
        bump.inputs["Strength"].default_value = bump_strength
        nt.links.new(noise.outputs["Fac"], bump.inputs["Height"])
        nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    nt.links.new(bsdf.outputs["BSDF"], output.inputs["Surface"])
    return mat

def make_lowpoly_material(name, base_color, light_dir=(0.3, -0.5, 0.8), n_bands=3, ambient=0.35):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    output = nt.nodes.new("ShaderNodeOutputMaterial")
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    light_vec = nt.nodes.new("ShaderNodeCombineXYZ")
    ld = mathutils.Vector(light_dir).normalized()
    light_vec.inputs[0].default_value = ld.x
    light_vec.inputs[1].default_value = ld.y
    light_vec.inputs[2].default_value = ld.z
    dot = nt.nodes.new("ShaderNodeVectorMath")
    dot.operation = "DOT_PRODUCT"
    nt.links.new(geo.outputs["Normal"], dot.inputs[0])
    nt.links.new(light_vec.outputs["Vector"], dot.inputs[1])
    maprange = nt.nodes.new("ShaderNodeMapRange")
    maprange.inputs["From Min"].default_value = -1.0
    maprange.inputs["From Max"].default_value = 1.0
    maprange.inputs["To Min"].default_value = ambient
    maprange.inputs["To Max"].default_value = 1.0
    maprange.clamp = True
    nt.links.new(dot.outputs["Value"], maprange.inputs["Value"])
    ramp_node = nt.nodes.new("ShaderNodeValToRGB")
    ramp = ramp_node.color_ramp
    ramp.interpolation = "CONSTANT"
    band_shades = [0.35 + 0.65 * i / max(n_bands - 1, 1) for i in range(n_bands)]
    while len(ramp.elements) < n_bands:
        ramp.elements.new(0.5)
    while len(ramp.elements) > n_bands:
        ramp.elements.remove(ramp.elements[-1])
    for i, el in enumerate(ramp.elements):
        el.position = i / max(n_bands - 1, 1)
        shade = band_shades[i]
        el.color = (base_color[0]*shade, base_color[1]*shade, base_color[2]*shade, 1.0)
    nt.links.new(maprange.outputs["Result"], ramp_node.inputs["Fac"])
    emission = nt.nodes.new("ShaderNodeEmission")
    nt.links.new(ramp_node.outputs["Color"], emission.inputs["Color"])
    nt.links.new(emission.outputs["Emission"], output.inputs["Surface"])
    return mat

def apply_vertex_snap(obj, grid_size=0.02):
    import bmesh
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    for v in bm.verts:
        v.co.x = round(v.co.x / grid_size) * grid_size
        v.co.y = round(v.co.y / grid_size) * grid_size
        v.co.z = round(v.co.z / grid_size) * grid_size
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()
