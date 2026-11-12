#!/usr/bin/env python3
"""Build a small, deterministic forest kit with the standalone bpy module.

Run from the project root: python build_assets.py
Requires bpy with Cycles and the glTF exporter, including its Draco library.
Outputs are relative to this file. No Blender application process is launched.
Use --only oak_01 to build one asset (including its LOD1), or --texture-size 1024.
An unsuccessful build returns a nonzero exit status after attempting every asset.
"""

from __future__ import annotations

import argparse
import json
import logging
import math
from pathlib import Path
import random
import struct
import sys

ROOT = Path(__file__).resolve().parent
SEED = 73421
LOG = logging.getLogger("forest")


def activate(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def reset(seed):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    # read_factory_settings does not necessarily discard unused datablocks.
    for blocks in (bpy.data.meshes, bpy.data.materials, bpy.data.images,
                   bpy.data.textures, bpy.data.curves, bpy.data.cameras,
                   bpy.data.lights):
        for block in list(blocks):
            if block.users == 0:
                blocks.remove(block)
    random.seed(seed)
    noise.seed_set(seed)
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 32
    scene.cycles.seed = seed
    scene.cycles.use_animated_seed = False
    scene.render.image_settings.file_format = "PNG"
    scene.render.resolution_x = scene.render.resolution_y = 640
    scene.render.resolution_percentage = 100
    scene.world = bpy.data.worlds.new("Forest studio")
    scene.world.use_nodes = True
    scene.world.node_tree.nodes["Background"].inputs["Color"].default_value = (
        0.18, 0.22, 0.28, 1)
    scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.4
    scene.render.bake.margin = 8
    scene.render.bake.use_clear = True
    scene.render.bake.use_selected_to_active = False
    scene.view_settings.view_transform = "Standard"
    # A wheel can bundle the exporter without enabling its Python operators.
    try:
        bpy.ops.export_scene.gltf.get_rna_type()
    except (AttributeError, RuntimeError):
        result = bpy.ops.preferences.addon_enable(module="io_scene_gltf2")
        if "FINISHED" not in result:
            raise RuntimeError("Could not enable the bundled glTF exporter")


def mesh(name, verts, faces, material, uvs=None):
    data = bpy.data.meshes.new(name)
    data.from_pydata(verts, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    if uvs is not None:
        layer = data.uv_layers.new(name="UVMap")
        for poly, coords in zip(data.polygons, uvs):
            for loop, uv in zip(poly.loop_indices, coords):
                layer.data[loop].uv = uv
    return obj


def tube(name, points, radii, material, sides=8, bark=False, jagged=False):
    """A ring mesh, with a continuous frame, tapered radii and optional splinters."""
    points = [Vector(p) for p in points]
    verts, faces = [], []
    for i, (p, radius) in enumerate(zip(points, radii)):
        direction = points[min(i + 1, len(points) - 1)] - points[max(0, i - 1)]
        direction.normalize()
        ref = Vector((0, 1, 0)) if abs(direction.y) < 0.9 else Vector((1, 0, 0))
        u = direction.cross(ref).normalized()
        v = direction.cross(u).normalized()
        for j in range(sides):
            angle = math.tau * j / sides
            radial = u * math.cos(angle) + v * math.sin(angle)
            wave = noise.noise_vector(p * 3.7 + radial * 5.3).x if bark else 0
            q = p + radial * radius * (1 + 0.12 * wave)
            if jagged and i in (0, len(points) - 1):
                q += direction * random.uniform(-0.22, 0.22)
            verts.append(q)
    for i in range(len(points) - 1):
        for j in range(sides):
            a = i * sides + j
            b = i * sides + (j + 1) % sides
            faces.append((a, b, b + sides, a + sides))
    faces += [tuple(reversed(range(sides))),
              tuple((len(points) - 1) * sides + j for j in range(sides))]
    obj = mesh(name, verts, faces, material)
    for p in obj.data.polygons[:-2]:
        p.use_smooth = True
    return obj


def ellipsoid(name, center, scale, material, subdivisions=2, irregular=False):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdivisions, radius=1,
                                         location=center)
    obj = bpy.context.object
    obj.name = name
    for v in obj.data.vertices:
        p = v.co.copy()
        factor = 1 + 0.22 * noise.noise_vector(p * 2.8).x if irregular else 1
        v.co = Vector((p.x * scale[0], p.y * scale[1], p.z * scale[2])) * factor
    obj.data.materials.append(material)
    for poly in obj.data.polygons:
        poly.use_smooth = True
    return obj


def box(name, center, scale, material, bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=center)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    activate(obj)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(material)
    if bevel:
        mod = obj.modifiers.new("Worn edges", "BEVEL")
        mod.width, mod.segments = bevel, 2
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return obj


def source_material(name, kind):
    """Procedural source shaders; replaced entirely after baking."""
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = nodes.get("Principled BSDF")
    coord = nodes.new("ShaderNodeTexCoord")
    mapping = nodes.new("ShaderNodeVectorMath")
    mapping.operation = "MULTIPLY"
    links.new(coord.outputs["Object"], mapping.inputs[0])
    mapping.inputs[1].default_value = (7, 7, 0.8) if kind == "bark" else (3, 3, 3)
    tex = nodes.new("ShaderNodeTexNoise")
    tex.inputs["Scale"].default_value = 4
    tex.inputs["Detail"].default_value = 4
    links.new(mapping.outputs["Vector"], tex.inputs["Vector"])
    palette = {
        "bark": ((0.045, 0.022, 0.012, 1), (0.26, 0.14, 0.065, 1)),
        "stone": ((0.12, 0.14, 0.14, 1), (0.43, 0.44, 0.38, 1)),
        "moss": ((0.018, 0.045, 0.008, 1), (0.20, 0.30, 0.045, 1)),
        "leaf": ((0.012, 0.055, 0.008, 1), (0.17, 0.36, 0.038, 1)),
        "needle": ((0.008, 0.035, 0.02, 1), (0.065, 0.19, 0.075, 1)),
        "wood": ((0.20, 0.095, 0.035, 1), (0.65, 0.42, 0.18, 1)),
        "metal": ((0.025, 0.032, 0.034, 1), (0.20, 0.12, 0.055, 1)),
        "glass": ((0.55, 0.68, 0.58, 1), (0.77, 0.86, 0.76, 1)),
        "core": ((1.0, 0.28, 0.025, 1), (1.0, 0.75, 0.22, 1)),
    }
    ramp = nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color, ramp.color_ramp.elements[1].color = palette[kind]
    links.new(tex.outputs["Fac"], ramp.inputs["Fac"])
    links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
    rough = nodes.new("ShaderNodeMapRange")
    rough.inputs["To Min"].default_value = 0.025 if kind == "glass" else 0.65
    rough.inputs["To Max"].default_value = 0.08 if kind == "glass" else 0.98
    links.new(tex.outputs["Fac"], rough.inputs["Value"])
    links.new(rough.outputs["Result"], bsdf.inputs["Roughness"])
    height = tex.outputs["Fac"]
    if kind == "bark":
        cracks = nodes.new("ShaderNodeTexVoronoi")
        cracks.feature = "DISTANCE_TO_EDGE"
        links.new(mapping.outputs["Vector"], cracks.inputs["Vector"])
        cracks.inputs["Scale"].default_value = 5
        height = cracks.outputs["Distance"]
        links.new(height, ramp.inputs["Fac"])
        ramp.color_ramp.elements[1].position = 0.18
    elif kind == "wood":
        rings = nodes.new("ShaderNodeTexWave")
        rings.wave_type, rings.rings_direction = "RINGS", "X"
        rings.inputs["Scale"].default_value = 12
        rings.inputs["Distortion"].default_value = 3
        links.new(coord.outputs["Object"], rings.inputs["Vector"])
        links.new(rings.outputs["Color"], ramp.inputs["Fac"])
        height = rings.outputs["Fac"]
    if kind == "stone":
        # World-facing normal means the moss stays on top after UV baking.
        geom = nodes.new("ShaderNodeNewGeometry")
        xyz = nodes.new("ShaderNodeSeparateXYZ")
        links.new(geom.outputs["Normal"], xyz.inputs["Vector"])
        threshold = nodes.new("ShaderNodeMath")
        threshold.operation = "GREATER_THAN"
        links.new(xyz.outputs["Z"], threshold.inputs[0])
        threshold.inputs[1].default_value = 0.35
        patch = nodes.new("ShaderNodeMath")
        patch.operation = "MULTIPLY"
        links.new(threshold.outputs[0], patch.inputs[0])
        links.new(tex.outputs["Fac"], patch.inputs[1])
        mix = nodes.new("ShaderNodeMixRGB")
        links.new(patch.outputs[0], mix.inputs[0])
        links.new(ramp.outputs["Color"], mix.inputs[1])
        mix.inputs[2].default_value = (0.07, 0.19, 0.018, 1)
        links.new(mix.outputs[0], bsdf.inputs["Base Color"])
    bump = nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.5
    bump.inputs["Distance"].default_value = 0.07 if kind in ("bark", "stone") else 0.018
    links.new(height, bump.inputs["Height"])
    links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    if kind in ("leaf", "needle"):
        # A deterministic alpha tile, baked with the other channels below.
        # Each card uses the same UV square; the bake uses one proxy square.
        size = 128
        mask = bpy.data.images.new(name + "_source_mask", width=size, height=size,
                                   alpha=True)
        pixels = []
        for y in range(size):
            v = (y + 0.5) / size
            width = (math.sin(math.pi * v) ** 0.85) * 0.43
            for x in range(size):
                u = (x + 0.5) / size - 0.5
                if kind == "leaf":
                    edge = width * (0.94 + 0.06 * math.cos(20 * math.pi * v))
                    inside = abs(u) < edge and 0.035 < v < 0.965
                else:
                    # A twig and paired, tapered needles with open space between.
                    t = (v * 12) % 1
                    edge = (1 - v * 0.7) * 0.46
                    inside = (abs(u) < 0.018 or
                              (abs(u) < edge and abs(t - abs(u) / edge) < 0.12))
                pixels.extend((1.0 if inside else 0.0,) * 3 + (1.0,))
        mask.pixels.foreach_set(pixels)
        mask.colorspace_settings.name = "Non-Color"
        image = nodes.new("ShaderNodeTexImage")
        image.image, image.interpolation = mask, "Closest"
        links.new(coord.outputs["UV"], image.inputs["Vector"])
        links.new(image.outputs["Color"], bsdf.inputs["Alpha"])
        # Leaf color and bump must also repeat with the shared card UVs.
        links.new(coord.outputs["UV"], mapping.inputs[0])
    mat["kind"] = kind
    return mat


def cards(name, centers, material, size):
    verts, faces, uvs = [], [], []
    for center in centers:
        # Random card orientations expose silhouettes and gaps from all sides.
        normal = Vector((random.uniform(-1, 1), random.uniform(-1, 1),
                         random.uniform(-0.6, 1))).normalized()
        u = normal.cross(Vector((0, 0, 1)))
        if u.length < 0.01:
            u = Vector((1, 0, 0))
        u.normalize()
        v = normal.cross(u).normalized()
        s = size * random.uniform(0.7, 1.25)
        p, k = Vector(center), len(verts)
        verts += [p + u * x * s + v * y * s for x, y in
                  ((-0.5, -0.7), (0.5, -0.7), (0.5, 0.7), (-0.5, 0.7))]
        faces.append((k, k + 1, k + 2, k + 3))
        uvs.append(((0, 0), (1, 0), (1, 1), (0, 1)))
    return mesh(name, verts, faces, material, uvs)


def oak(variant, lod):
    bark = source_material("bark", "bark")
    leaf = source_material("leaves", "leaf")
    height = 6.5 + variant * 0.65
    lean = Vector((0.35 + variant * 0.08, -0.18, 0))
    points = [Vector((0, 0, height * i / 8)) + lean * (i / 8) ** 1.5
              for i in range(9)]
    tube("trunk", points, [0.48 * (1 - i / 10) ** 1.3 for i in range(9)],
         bark, 10 if not lod else 6, bark=True)
    for i in range(6):
        a = i * math.tau / 6 + random.uniform(-0.2, 0.2)
        direction = Vector((math.cos(a), math.sin(a), 0))
        tube("root_flare", [(0, 0, 0.55), direction * 0.6 + Vector((0, 0, 0.13)),
                            direction * random.uniform(1, 1.4)],
             [0.28, 0.16, 0.018], bark, 6, bark=True)
    centers = []
    count = 11 if not lod else 7
    for i in range(count):
        a = i * 2.39996 + random.uniform(-0.35, 0.35)
        start = points[min(7, 3 + i % 5)]
        direction = Vector((math.cos(a), math.sin(a), random.uniform(0.45, 0.95)))
        reach = random.uniform(1.7, 2.9) * (1 - (start.z / height) * 0.3)
        end = start + direction * reach
        mid = start.lerp(end, 0.48) - Vector((0, 0, 0.15))
        tube("bough", [start, mid, end], [0.19, 0.11, 0.025], bark, 7 if not lod else 5)
        for j in range(3 if not lod else 2):
            fork = end + Vector((random.uniform(-0.95, 0.95),
                                 random.uniform(-0.95, 0.95), random.uniform(0.3, 1)))
            tube("fork", [mid.lerp(end, 0.65), fork], [0.065, 0.008], bark, 5)
            for _ in range(34 if not lod else 20):
                offset = Vector((random.gauss(0, 0.48), random.gauss(0, 0.48),
                                 random.gauss(0, 0.38)))
                centers.append(fork + offset)
    cards("oak_leaf_cards", centers, leaf, 0.46 if not lod else 0.74)


def pine(variant):
    bark = source_material("bark", "bark")
    needles = source_material("needles", "needle")
    height = 9.0 + variant * 0.9
    tube("trunk", [(0.04 * math.sin(i), 0, height * i / 10) for i in range(11)],
         [0.28 * (1 - i / 11) for i in range(11)], bark, 9, bark=True)
    centers = []
    for tier in range(9):
        z = 1.4 + tier * (height - 2.1) / 9
        length = 2.35 * (1 - tier / 10)
        for j in range(6):
            a = j * math.tau / 6 + tier * 0.71 + random.uniform(-0.12, 0.12)
            direction = Vector((math.cos(a), math.sin(a), 0))
            start = Vector((0, 0, z))
            end = start + direction * length + Vector((0, 0, -0.55 + tier * 0.09))
            mid = start.lerp(end, 0.6) - Vector((0, 0, 0.18))
            tube("whorled_limb", [start, mid, end], [0.075, 0.035, 0.008], bark, 6)
            for k in range(5):
                at = start.lerp(end, 0.3 + k * 0.14)
                side = Vector((-direction.y, direction.x, 0))
                for sign in (-1, 1):
                    tip = at + side * sign * length * 0.25 + direction * 0.2
                    tube("twig", [at, tip], [0.022, 0.003], bark, 4)
                    for _ in range(5):
                        centers.append(at.lerp(tip, random.random()) + Vector((
                            random.uniform(-0.12, 0.12), random.uniform(-0.12, 0.12),
                            random.uniform(-0.09, 0.09))))
    cards("needle_sprays", centers, needles, 0.42)


def log_asset(variant):
    bark = source_material("bark", "bark")
    wood = source_material("end_grain", "wood")
    moss = source_material("moss", "moss")
    length, radius = 3.1 + variant * 0.6, 0.40 + variant * 0.06
    points = [Vector((-length / 2 + length * i / 9,
                      0.04 * math.sin(i), radius + 0.045 * math.cos(i))) for i in range(10)]
    obj = tube("fallen_log", points, [radius * (1 - i * 0.012) for i in range(10)],
               bark, sides=20, bark=True, jagged=True)
    # Exposed cut faces follow the actual jagged bark rim.
    obj.data.materials.append(wood)
    for poly in obj.data.polygons[-2:]:
        poly.material_index = 1
    for end, sign in ((points[0], -1), (points[-1], 1)):
        for _ in range(9):
            a = random.uniform(0, math.tau)
            at = end + Vector((0, math.cos(a) * radius * 0.82,
                               math.sin(a) * radius * 0.82))
            tube("splinter", [at, at + Vector((sign * random.uniform(0.12, 0.5),
                                                random.uniform(-0.08, 0.08), 0.03))],
                 [0.065, 0.002], wood, 3)
    for _ in range(18):
        x = random.uniform(-length * 0.44, length * 0.44)
        a = random.uniform(0.25, 1.65)  # One upper side, not a uniform coating.
        ellipsoid("moss_patch", (x, math.cos(a) * radius, radius + math.sin(a) * radius),
                  (random.uniform(0.15, 0.35), 0.16, 0.065), moss, 1, True)
    tube("broken_branch", [(0.5, 0, radius), (0.6, 0.25, radius + 0.65)],
         [0.14, 0.065], bark, 7, bark=True, jagged=True)


def boulder(variant):
    stone = source_material("mossy_stone", "stone")
    size = (0.65, 1.05, 1.55)[variant - 1]
    ellipsoid("boulder", (0, 0, size * 0.5), (size, size * 0.78, size * 0.72),
              stone, 3, True)


def marker():
    stone = source_material("weathered_stone", "stone")
    obj = box("carved_waystone", (0, 0, 0.95), (0.85, 0.46, 1.9), stone, 0.09)
    # An inset arrow built from Boolean grooves in the visible front face.
    for center, scale, angle in [((0, -0.225, 1.15), (0.065, 0.12, 0.68), 0),
                                  ((-0.12, -0.225, 1.41), (0.065, 0.12, 0.37), -0.75),
                                  ((0.12, -0.225, 1.41), (0.065, 0.12, 0.37), 0.75)]:
        cutter = box("carving_tool", center, scale, stone)
        cutter.rotation_euler.y = angle
        activate(obj)
        mod = obj.modifiers.new("Recessed arrow", "BOOLEAN")
        mod.operation, mod.solver, mod.object = "DIFFERENCE", "EXACT", cutter
        bpy.ops.object.modifier_apply(modifier=mod.name)
        bpy.data.objects.remove(cutter, do_unlink=True)
    activate(obj)
    mod = obj.modifiers.new("Weathering resolution", "SUBSURF")
    mod.subdivision_type, mod.levels = "SIMPLE", 2
    bpy.ops.object.modifier_apply(modifier=mod.name)
    for v in obj.data.vertices:
        v.co += noise.noise_vector(v.co * 18) * 0.013
    ellipsoid("buried_foot", (0, 0, 0.08), (0.59, 0.42, 0.17), stone, 2, True)


def lantern():
    metal = source_material("aged_iron", "metal")
    glass = source_material("glass", "glass")
    core = source_material("emissive_core", "core")
    for z in (0.12, 1.0):
        box("frame_plate", (0, 0, z), (0.66, 0.66, 0.10), metal, 0.035)
    for x in (-0.27, 0.27):
        for y in (-0.27, 0.27):
            tube("corner_post", [(x, y, 0.15), (x, y, 1)], [0.035, 0.035], metal, 6)
    for axis in (0, 1):
        for sign in (-1, 1):
            scale = (0.47, 0.018, 0.73) if axis else (0.018, 0.47, 0.73)
            center = (0, sign * 0.27, 0.56) if axis else (sign * 0.27, 0, 0.56)
            box("glass_panel", center, scale, glass)
    tube("pitched_roof", [(0, 0, 1.05), (0, 0, 1.33)], [0.47, 0.08], metal, 4)
    ellipsoid("warm_core", (0, 0, 0.53), (0.10, 0.10, 0.25), core, 2)
    tube("burner", [(0, 0, 0.18), (0, 0, 0.29)], [0.13, 0.10], metal, 12)
    for i in range(6):
        bpy.ops.mesh.primitive_torus_add(major_segments=12, minor_segments=5,
                                         major_radius=0.075, minor_radius=0.014,
                                         location=(0, 0, 1.4 + i * 0.12))
        obj = bpy.context.object
        obj.name = "hanging_chain"
        obj.rotation_euler = (math.pi / 2, 0, (i % 2) * math.pi / 2)
        obj.data.materials.append(metal)


def prepare_groups():
    """Join by material so each non-overlapping UV atlas is baked only once."""
    # Separate the log's end-grain material before grouping.
    for obj in list(bpy.context.scene.objects):
        if obj.type == "MESH" and len(obj.data.materials) > 1:
            activate(obj)
            bpy.ops.object.mode_set(mode="EDIT")
            bpy.ops.mesh.select_all(action="SELECT")
            bpy.ops.mesh.separate(type="MATERIAL")
            bpy.ops.object.mode_set(mode="OBJECT")
    groups = {}
    for obj in list(bpy.context.scene.objects):
        if obj.type != "MESH":
            continue
        used = {p.material_index for p in obj.data.polygons}
        if len(used) != 1:
            raise RuntimeError(f"Expected one material on {obj.name}")
        mat = obj.data.materials[next(iter(used))]
        groups.setdefault(mat.name, (mat, []))[1].append(obj)
    result = []
    for mat, objects in groups.values():
        bpy.ops.object.select_all(action="DESELECT")
        for obj in objects:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = objects[0]
        bpy.ops.object.join()
        obj = bpy.context.object
        obj.name = mat.name + "_mesh"
        obj.data.materials.clear()
        obj.data.materials.append(mat)
        for poly in obj.data.polygons:
            poly.material_index = 0
        # Real triangles both for exported topology and reliable budget checks.
        mod = obj.modifiers.new("Export triangles", "TRIANGULATE")
        bpy.ops.object.modifier_apply(modifier=mod.name)
        if mat["kind"] not in ("leaf", "needle"):
            bpy.ops.object.mode_set(mode="EDIT")
            bpy.ops.mesh.select_all(action="SELECT")
            bpy.ops.uv.smart_project(angle_limit=1.15192, island_margin=0.025)
            bpy.ops.object.mode_set(mode="OBJECT")
        result.append(obj)
    return result


def bake_material(asset, obj, resolution):
    """Bake source color/roughness as emission, and bump as a tangent normal."""
    source = obj.data.materials[0]
    kind = source["kind"]
    proxy = None
    target = obj
    if kind in ("leaf", "needle"):
        proxy = mesh("leaf_bake_proxy", [(0, 0, 0), (1, 0, 0), (1, 1, 0), (0, 1, 0)],
                     [(0, 1, 2, 3)], source, [((0, 0), (1, 0), (1, 1), (0, 1))])
        target = proxy
    activate(target)
    nodes, links = source.node_tree.nodes, source.node_tree.links
    bsdf = nodes.get("Principled BSDF")
    output = next(n for n in nodes if n.type == "OUTPUT_MATERIAL")
    emission = nodes.new("ShaderNodeEmission")
    images = {}
    for channel, socket_name in (("basecolor", "Base Color"),
                                  ("roughness", "Roughness"),
                                  ("normal", "Normal"), ("alpha", "Alpha")):
        if channel == "alpha" and kind not in ("leaf", "needle"):
            continue
        image = bpy.data.images.new(f"{asset}_{source.name}_{channel}",
                                    width=resolution, height=resolution, alpha=True)
        image.colorspace_settings.name = "sRGB" if channel == "basecolor" else "Non-Color"
        texture = nodes.new("ShaderNodeTexImage")
        texture.image = image
        for n in nodes:
            n.select = False
        texture.select = True
        nodes.active = texture
        if channel == "normal":
            links.new(bsdf.outputs["BSDF"], output.inputs["Surface"])
            outcome = bpy.ops.object.bake(type="NORMAL", normal_space="TANGENT")
        else:
            socket = bsdf.inputs[socket_name]
            if emission.inputs["Color"].is_linked:
                links.remove(emission.inputs["Color"].links[0])
            if socket.is_linked:
                links.new(socket.links[0].from_socket, emission.inputs["Color"])
            else:
                value = socket.default_value
                emission.inputs["Color"].default_value = (
                    (value, value, value, 1) if isinstance(value, (float, int)) else value)
            links.new(emission.outputs[0], output.inputs["Surface"])
            outcome = bpy.ops.object.bake(type="EMIT")
        if "FINISHED" not in outcome:
            raise RuntimeError(f"Bake cancelled: {asset} / {source.name} / {channel}")
        images[channel] = image
    if "alpha" in images:
        # glTF takes the alpha mask from the base-color texture's alpha channel.
        color = list(images["basecolor"].pixels[:])
        alpha = images["alpha"].pixels[:]
        for i in range(3, len(color), 4):
            color[i] = 1.0 if alpha[i - 3] >= 0.5 else 0.0
        images["basecolor"].pixels.foreach_set(color)
        images["basecolor"].update()
    for channel, image in images.items():
        image.filepath_raw = str(ROOT / "textures" / f"{asset}_{source.name}_{channel}.png")
        image.file_format = "PNG"
        image.save()
    mat = bpy.data.materials.new(source.name + "_baked")
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    bsdf = nodes.new("ShaderNodeBsdfPrincipled")
    links.new(bsdf.outputs[0], output.inputs["Surface"])
    for channel in ("basecolor", "roughness", "normal"):
        tex = nodes.new("ShaderNodeTexImage")
        tex.image = images[channel]
        if channel == "normal":
            normal = nodes.new("ShaderNodeNormalMap")
            links.new(tex.outputs["Color"], normal.inputs["Color"])
            links.new(normal.outputs["Normal"], bsdf.inputs["Normal"])
        else:
            links.new(tex.outputs["Color"], bsdf.inputs[
                "Base Color" if channel == "basecolor" else "Roughness"])
        if channel == "basecolor" and kind in ("leaf", "needle"):
            if hasattr(mat, "blend_method"):
                links.new(tex.outputs["Alpha"], bsdf.inputs["Alpha"])
            else:
                # Blender 4.2+ infers glTF MASK from a rounding node, not
                # surface_render_method. This only thresholds the baked PNG;
                # it generates no procedural texture data.
                cutoff = nodes.new("ShaderNodeMath")
                cutoff.operation = "ROUND"
                links.new(tex.outputs["Alpha"], cutoff.inputs[0])
                links.new(cutoff.outputs[0], bsdf.inputs["Alpha"])
        if channel == "basecolor" and kind == "core":
            links.new(tex.outputs["Color"], bsdf.inputs["Emission Color"])
    if kind in ("leaf", "needle"):
        if hasattr(mat, "blend_method"):  # Blender 4.0/4.1
            mat.blend_method = "CLIP"
            mat.alpha_threshold = 0.5
        else:  # Blender 4.2+ uses the ROUND node above to export MASK.
            mat.surface_render_method = "DITHERED"
        mat.use_backface_culling = False
    if kind == "metal":
        bsdf.inputs["Metallic"].default_value = 0.82
    elif kind == "glass":
        bsdf.inputs["Transmission Weight"].default_value = 1
        bsdf.inputs["IOR"].default_value = 1.45
    elif kind == "core":
        bsdf.inputs["Emission Strength"].default_value = 5
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    if proxy:
        bpy.data.objects.remove(proxy, do_unlink=True)
    # Source graphs have no users now; only this image-only graph is exported.
    allowed = {"OUTPUT_MATERIAL", "BSDF_PRINCIPLED", "TEX_IMAGE", "NORMAL_MAP", "MATH"}
    if any(n.type not in allowed for n in mat.node_tree.nodes):
        raise RuntimeError(f"Unbaked nodes remain in {mat.name}")
    if any(n.type == "MATH" and n.operation != "ROUND" for n in mat.node_tree.nodes):
        raise RuntimeError(f"Unexpected math node in {mat.name}")


def glb_json(path):
    with path.open("rb") as file:
        magic, version, total = struct.unpack("<4sII", file.read(12))
        if magic != b"glTF" or version != 2 or total != path.stat().st_size:
            raise RuntimeError(f"Invalid GLB header: {path}")
        length, kind = struct.unpack("<II", file.read(8))
        if kind != 0x4E4F534A:
            raise RuntimeError("GLB has no JSON chunk")
        return json.loads(file.read(length))


def export_asset(asset, objects):
    triangles = sum(len(obj.data.polygons) for obj in objects)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    path = ROOT / "assets" / f"{asset}.glb"
    # Export to a temporary filename so a failed export never replaces a good file.
    temp = path.with_name(asset + ".pending.glb")
    try:
        result = bpy.ops.export_scene.gltf(
            filepath=str(temp), export_format="GLB", use_selection=True,
            export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6,
            export_animations=False, export_cameras=False, export_lights=False,
            export_tangents=True, export_image_format="PNG")
        if "FINISHED" not in result or not temp.is_file():
            raise RuntimeError("glTF exporter did not produce a file")
        document = glb_json(temp)
        primitives = [p for m in document.get("meshes", []) for p in m["primitives"]]
        if not primitives or any("KHR_draco_mesh_compression" not in p.get("extensions", {})
                                 for p in primitives):
            raise RuntimeError("Draco compression unavailable or skipped by exporter")
        exported_triangles = sum(document["accessors"][p["indices"]]["count"] // 3
                                 for p in primitives)
        if exported_triangles != triangles:
            raise RuntimeError(f"Triangle mismatch: {triangles} source, {exported_triangles} GLB")
        # Explicitly enforce MASK across Blender exporter versions.
        # Do not patch the binary: fail if the exporter did not preserve masks.
        for mat in document.get("materials", []):
            if any(token in mat.get("name", "") for token in ("leaves_baked", "needles_baked")):
                if mat.get("alphaMode") != "MASK":
                    raise RuntimeError("Exporter did not preserve alpha MASK on leaf cards")
        temp.replace(path)
    finally:
        temp.unlink(missing_ok=True)
    size = path.stat().st_size
    print(f"EXPORTED {asset:<18} {triangles:>7,} triangles  {size:>10,} bytes", flush=True)
    return triangles, size


def preview(asset, objects):
    corners = [obj.matrix_world @ Vector(corner) for obj in objects for corner in obj.bound_box]
    lo = Vector(tuple(min(p[i] for p in corners) for i in range(3)))
    hi = Vector(tuple(max(p[i] for p in corners) for i in range(3)))
    center = (lo + hi) / 2
    radius = max((p - center).length for p in corners)
    bpy.ops.object.camera_add()
    camera = bpy.context.object
    camera.location = center + Vector((1.2, -1.7, 0.9)).normalized() * radius * 3.5
    camera.rotation_euler = (center - camera.location).to_track_quat("-Z", "Y").to_euler()
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = radius * 2.35
    camera.data.clip_end = max(100, radius * 20)
    scene = bpy.context.scene
    scene.camera = camera
    for offset, energy, size in (((-1.5, -2.0, 3), 150, 1.8),
                                  ((2, 1, 1.8), 95, 1.3)):
        bpy.ops.object.light_add(type="AREA", location=center + Vector(offset) * radius)
        light = bpy.context.object
        light.data.energy = energy * radius ** 2
        light.data.shape, light.data.size = "DISK", size * radius
        light.rotation_euler = (center - light.location).to_track_quat("-Z", "Y").to_euler()
    if asset.startswith("lantern"):
        bpy.ops.object.light_add(type="POINT", location=(0, 0, 0.53))
        bpy.context.object.data.energy = 8
        bpy.context.object.data.color = (1, 0.45, 0.1)
    path = ROOT / "previews" / f"{asset}.png"
    temp = path.with_name(asset + ".pending.png")
    try:
        scene.render.filepath = str(temp)
        outcome = bpy.ops.render.render(write_still=True)
        if "FINISHED" not in outcome or not temp.is_file() or temp.stat().st_size == 0:
            raise RuntimeError("Preview render did not produce an image")
        temp.replace(path)
    finally:
        temp.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--only", nargs="+", help="Base asset names to build")
    parser.add_argument("--texture-size", type=int, default=512)
    args = parser.parse_args()
    if not 64 <= args.texture_size <= 4096:
        parser.error("--texture-size must be between 64 and 4096")
    jobs = []
    for i in range(1, 4):
        for lod in (0, 1):
            jobs.append((f"oak_{i:02}" + ("_lod1" if lod else ""),
                         lambda i=i, lod=lod: oak(i, lod), 3000 if lod else 15000,
                         SEED + i))
    jobs += [(f"pine_{i:02}", lambda i=i: pine(i), None, SEED + 10 + i) for i in (1, 2)]
    jobs += [(f"log_{i:02}", lambda i=i: log_asset(i), None, SEED + 20 + i) for i in (1, 2)]
    jobs += [(f"boulder_{i:02}", lambda i=i: boulder(i), None, SEED + 30 + i)
             for i in (1, 2, 3)]
    jobs += [("marker_01", marker, None, SEED + 40), ("lantern_01", lantern, None, SEED + 50)]
    if args.only:
        valid = {name.removesuffix("_lod1") for name, *_ in jobs}
        unknown = set(args.only) - valid
        if unknown:
            parser.error(f"Unknown assets: {', '.join(sorted(unknown))}")
        jobs = [job for job in jobs if job[0].removesuffix("_lod1") in args.only]
    for folder in ("assets", "textures", "previews"):
        (ROOT / folder).mkdir(exist_ok=True)
    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s",
                        handlers=[logging.StreamHandler(),
                                  logging.FileHandler(ROOT / "assets" / "build_assets.log", mode="w")])
    print(f"Blender {bpy.app.version_string}; Cycles CPU; seed {SEED}", flush=True)
    rows, exceeded, failures = [], [], []
    for asset, build, limit, seed in jobs:
        row = {"asset": asset, "triangles": None, "bytes": None, "limit": limit,
               "status": "FAILED"}
        try:
            reset(seed)
            build()
            bpy.context.view_layer.update()
            objects = prepare_groups()
            row["triangles"] = sum(len(obj.data.polygons) for obj in objects)
            if limit is not None and row["triangles"] >= limit:
                exceeded.append(asset)
                LOG.error("%s: %s triangles; must be below %s", asset, row["triangles"], limit)
            for obj in objects:
                bake_material(asset, obj, args.texture_size)
            row["triangles"], row["bytes"] = export_asset(asset, objects)
            preview(asset, objects)
            row["status"] = "OVER LIMIT" if asset in exceeded else "OK"
        except Exception as exc:
            row["error"] = str(exc)
            failures.append(asset)
            LOG.exception("%s failed; continuing with the next asset", asset)
        rows.append(row)
    print("\nAsset               Triangles       Bytes    Limit  Status")
    print("-" * 68)
    for row in rows:
        tri = f"{row['triangles']:,}" if row["triangles"] is not None else "-"
        size = f"{row['bytes']:,}" if row["bytes"] is not None else "-"
        limit = f"<{row['limit']:,}" if row["limit"] else "-"
        print(f"{row['asset']:<20}{tri:>9} {size:>11} {limit:>8}  {row['status']}")
    print("Exceeded triangle limits: " + (", ".join(exceeded) or "none"))
    print("Failed assets: " + (", ".join(failures) or "none"))
    (ROOT / "assets" / "build_summary.json").write_text(json.dumps(rows, indent=2) + "\n")
    return 1 if failures or exceeded else 0


if __name__ == "__main__":
    try:
        import bpy
        from mathutils import Vector, noise
    except ImportError as exc:
        print(f"Cannot load bpy: {exc}\nRun this script in the Python environment with bpy installed.",
              file=sys.stderr)
        sys.exit(2)
    sys.exit(main())
