"""Quick Eevee look-check renders of ENTITY 002 — UMBRA.

Run:  blender -b --factory-startup --python preview_umbra.py -- <out_dir> [cinematic|optimized]
"""
import math
import os
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_umbra as U  # noqa: E402

SHOTS = {
    # camera position, target, focal length
    "front": ((0.0, -4.6, 1.18), (0.0, 0.0, 1.22), 55),
    "three_quarter": ((-2.1, -4.2, 1.6), (0.0, 0.0, 1.22), 55),
    "profile": ((4.6, 0.0, 1.18), (0.0, 0.0, 1.22), 55),
    "face": ((-0.25, -2.0, 1.75), (0.0, 0.0, 1.60), 55),
}


def look_at(obj, target):
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def area(name, location, energy, color, size, target=(0, 0, 1.1)):
    data = bpy.data.lights.new(name, "AREA")
    data.energy, data.color, data.size = energy, color, size
    obj = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = location
    look_at(obj, target)


def stage():
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x, scene.render.resolution_y = 720, 900
    scene.eevee.taa_render_samples = 32
    world = bpy.data.worlds.new("void")
    world.use_nodes = True
    bg = next(n for n in world.node_tree.nodes if n.type == "BACKGROUND")
    bg.inputs["Color"].default_value = (0.003, 0.002, 0.004, 1)
    bg.inputs["Strength"].default_value = 1.0
    scene.world = world
    # Cold moon rim from behind-left, crimson under-glow, violet fill.
    area("moon", (-2.2, 2.5, 3.2), 900, (0.78, 0.8, 1.0), 1.2)
    area("rim", (2.4, 2.0, 1.6), 500, (0.75, 0.55, 1.0), 1.0)
    area("key", (-2.6, -2.4, 2.4), 260, (0.85, 0.82, 0.95), 1.5)
    area("ember", (0.4, -1.4, -0.3), 35, (1.0, 0.28, 0.5), 1.0)
    cam_data = bpy.data.cameras.new("cam")
    cam = bpy.data.objects.new("cam", cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam
    return cam


def main():
    args = sys.argv[sys.argv.index("--") + 1:]
    out = args[0]
    quality = args[1] if len(args) > 1 else "cinematic"
    os.makedirs(out, exist_ok=True)
    U.build(quality)
    cam = stage()
    for name, (pos, target, lens) in SHOTS.items():
        cam.location = pos
        cam.data.lens = lens
        look_at(cam, target)
        bpy.context.scene.render.filepath = os.path.join(out, f"{name}.png")
        bpy.ops.render.render(write_still=True)
        print("rendered", name)


main()
