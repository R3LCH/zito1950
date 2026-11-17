"""Builds the ZITO 1950 Esploratore GMT 3D model and exports public/models/3d-watch.glb.

Run inside Blender (MCP execute or Text Editor):
    WATCH_DIR = r'<repo>\\scripts\\watch3d'
    exec(open(WATCH_DIR + r'\\build_watch.py', encoding='utf-8').read())
Needs scripts/watch3d/build/dial.png (python scripts/watch3d/dial_texture.py).

Units: millimetres (1 Blender unit = 1 mm). Face normal +Z, 12 o'clock +Y, 3 o'clock +X.
Dimensions measured on 3d_watch_referencess/24.jpg (front, 11.8 px/mm), 19.jpg (profile) and 13/15.jpg
(bracelet, clasp): case 45.4 mm, bezel opening 19.3 mm radius, lugs 24.8 mm from the centre, 21.2 mm
five-row bracelet narrowing to 20.1 mm at the clasp, loop 80 x 58 mm, clasp 25 mm offset 9 mm towards 6.
"""

import math
from pathlib import Path

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector

HERE = Path(globals().get('WATCH_DIR', r'E:\Projects\website-building\zito1950\scripts\watch3d'))
BUILD = HERE / 'build'
OUT = HERE.parent.parent / 'public' / 'models' / '3d-watch.glb'

DIAL_Z = -0.5  # dial surface
DIAL_R = 19.3  # bezel opening; the dial texture covers this radius
FLANGE_IN = 16.5
UV_MM = 12.0  # brushing texture repeat

TAU = math.tau


# ---------- scene and materials ----------

def reset() -> None:
    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob, do_unlink=True)
    for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.images, bpy.data.lights, bpy.data.cameras):
        for block in list(coll):
            coll.remove(block)


def srgb(hexstr):
    """Hex colour to linear RGB."""
    c = [int(hexstr[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in c)


def brushed_normal_image(size=512):
    """Tiling tangent-space normal map: fine streaks along V, varying across U."""
    rng = np.random.default_rng(1950)
    col = rng.normal(0, 1, size)
    col = (np.roll(col, 1) + 2 * col + np.roll(col, -1)) / 4 + 0.45 * rng.normal(0, 1, size)
    v = np.linspace(0, TAU, size, endpoint=False)
    mod = 0.7 + 0.3 * np.sin(3 * v[:, None] + rng.uniform(0, TAU, size)[None, :])
    h = col[None, :] * mod
    dh = (np.roll(h, -1, axis=1) - np.roll(h, 1, axis=1)) / 2
    nx, nz = -0.32 * dh, np.ones_like(dh)
    length = np.sqrt(nx**2 + nz**2)
    rgba = np.stack([nx / length * 0.5 + 0.5, np.full_like(dh, 0.5), nz / length * 0.5 + 0.5, np.ones_like(dh)], -1)
    BUILD.mkdir(parents=True, exist_ok=True)
    img = bpy.data.images.new('BrushedNormal', size, size, alpha=False)
    img.colorspace_settings.name = 'Non-Color'
    img.pixels.foreach_set(rgba.astype(np.float32).ravel())
    img.filepath_raw = str(BUILD / 'brushed_normal.png')
    img.file_format = 'PNG'
    img.save()
    return img


def material(name, color, metallic=0.0, roughness=0.5, alpha=1.0, image=None, normal=None):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nodes, links = m.node_tree.nodes, m.node_tree.links
    p = nodes['Principled BSDF']
    p.inputs['Base Color'].default_value = (*color, 1)
    p.inputs['Metallic'].default_value = metallic
    p.inputs['Roughness'].default_value = roughness
    if alpha < 1:
        p.inputs['Alpha'].default_value = alpha
        m.surface_render_method = 'BLENDED'
    if image:
        tex = nodes.new('ShaderNodeTexImage')
        tex.image = bpy.data.images.load(str(image))
        links.new(tex.outputs['Color'], p.inputs['Base Color'])
    if normal:
        tex = nodes.new('ShaderNodeTexImage')
        tex.image = normal
        nm = nodes.new('ShaderNodeNormalMap')
        links.new(tex.outputs['Color'], nm.inputs['Color'])
        links.new(nm.outputs['Normal'], p.inputs['Normal'])
    return m


# ---------- mesh helpers ----------

def finish(name, bm, mats, sharp_deg=32):
    """bmesh → object, smooth shading with sharp edges above sharp_deg."""
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for f in bm.faces:
        f.smooth = True
    limit = math.radians(sharp_deg)
    for e in bm.edges:
        if len(e.link_faces) != 2 or e.calc_face_angle(0) > limit:
            e.smooth = False
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for m in mats:
        me.materials.append(m)
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def append(dst, src, matrix=Matrix(), mat_index=None):
    """Copies src geometry into dst, transformed; src is freed. mat_index None keeps src indices."""
    lookup = {v: dst.verts.new(matrix @ v.co) for v in src.verts}
    uv_src = src.loops.layers.uv.active
    uv_dst = dst.loops.layers.uv.verify() if uv_src else None
    for f in src.faces:
        try:
            nf = dst.faces.new([lookup[v] for v in f.verts])
        except ValueError:
            continue
        nf.material_index = f.material_index if mat_index is None else mat_index
        if uv_src:
            for l_new, l_old in zip(nf.loops, f.loops):
                l_new[uv_dst].uv = l_old[uv_src].uv
    src.free()


def loft(rings, cap=True, uv_of=None):
    """Skins consecutive closed rings of Vectors (same point count); optional caps and per-vertex UVs."""
    bm = bmesh.new()
    vr = [[bm.verts.new(p) for p in ring] for ring in rings]
    k = len(rings[0])
    for a, b in zip(vr, vr[1:]):
        for i in range(k):
            j = (i + 1) % k
            bm.faces.new((a[i], a[j], b[j], b[i]))
    if cap:
        bm.faces.new(list(reversed(vr[0])))
        bm.faces.new(vr[-1])
    if uv_of:
        uv = bm.loops.layers.uv.new()
        for f in bm.faces:
            for loop in f.loops:
                loop[uv].uv = uv_of(loop.vert.co)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.normal_update()
    return bm


def lathe(profile, steps=256):
    """Spins a (radius, z) profile around Z, with circular brushing UVs."""
    bm = bmesh.new()
    verts = [bm.verts.new((r, 0, z)) for r, z in profile]
    edges = [bm.edges.new((a, b)) for a, b in zip(verts, verts[1:])]
    bmesh.ops.spin(bm, geom=verts + edges, cent=(0, 0, 0), axis=(0, 0, 1), angle=TAU, steps=steps, use_duplicate=False)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
    uv_circular(bm)
    return bm


def uv_circular(bm, turns=10):
    """U across the profile, V around the axis: streaks run concentric (bezel, case sides)."""
    uv = bm.loops.layers.uv.verify()
    for f in bm.faces:
        c = f.calc_center_median()
        ac = math.atan2(c.y, c.x)
        for loop in f.loops:
            co = loop.vert.co
            a = ac + (math.atan2(co.y, co.x) - ac + math.pi) % TAU - math.pi
            loop[uv].uv = ((math.hypot(co.x, co.y) + co.z) / UV_MM, a / TAU * turns)


def prism(points, z0, z1):
    """Extrudes a 2D outline between z0 and z1."""
    bm = bmesh.new()
    bottom = [bm.verts.new((x, y, z0)) for x, y in points]
    top = [bm.verts.new((x, y, z1)) for x, y in points]
    bm.faces.new(list(reversed(bottom)))
    bm.faces.new(top)
    n = len(points)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((bottom[i], bottom[j], top[j], top[i]))
    return bm


def disc(radius, z0, z1, steps=48):
    pts = [(radius * math.cos(a), radius * math.sin(a)) for a in (TAU * i / steps for i in range(steps))]
    return prism(pts, z0, z1)


def box(size, bevel=0.0, segments=2):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)
    if bevel:
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=bevel, segments=segments, profile=0.5, affect='EDGES')
    return bm


def rrect(x0, x1, n0, n1, radii, seg=3):
    """Rounded rectangle outline; radii for corners (x1,n0), (x1,n1), (x0,n1), (x0,n0)."""
    pts = []
    corners = ((x1, n0, -90, -1, 1), (x1, n1, 0, -1, -1), (x0, n1, 90, 1, -1), (x0, n0, 180, 1, 1))
    for (cx, cy, a0, sx, sy), r in zip(corners, radii):
        ox, oy = cx + sx * r, cy + sy * r
        for i in range(seg + 1):
            a = math.radians(a0 + 90 * i / seg)
            pts.append((ox + r * math.cos(a), oy + r * math.sin(a)))
    return pts


def arc(cx, cz, r, a0, a1, n=4):
    return [(cx + r * math.cos(math.radians(a0 + (a1 - a0) * i / n)), cz + r * math.sin(math.radians(a0 + (a1 - a0) * i / n))) for i in range(n + 1)]


def at(x=0.0, y=0.0, z=0.0, rot_z=0.0):
    return Matrix.Translation((x, y, z)) @ Matrix.Rotation(rot_z, 4, 'Z')


# ---------- case ----------

# Measured on 24.jpg: case edge 22.7 mm, flat satin bezel ~20.0-22.7 mm, flat case back.
CASE_R = 22.7

def case_profile():
    p = [(DIAL_R - 0.05, DIAL_Z + 0.7), (DIAL_R - 0.05, 1.7)]
    p += arc(DIAL_R + 0.35, 1.7, 0.35, 180, 90)[1:]  # rounded inner lip
    p += [(22.1, 2.05)]  # broad flat satin bezel
    p += arc(22.1, 1.45, 0.6, 90, 0)[1:]  # rounded outer edge into the side
    p += [(CASE_R, -6.4)]  # tall polished case side
    p += arc(CASE_R - 0.9, -6.4, 0.9, 0, -90)[1:]
    p += [(21.2, -7.6), (20.6, -8.8)]  # chamfer to the back
    p += arc(19.6, -8.8, 1.0, 0, -90)[1:]
    p += [(0.0, -9.8)]  # flat case back; 19.jpg ratios put the case ~0.6 mm thinner
    return p


def lug(sx, sy):
    """Lofted lug: blends into the case side, slopes and drops towards the wrist (ref 19)."""
    rings = []
    # Shoulder starts at y=14.9 mm and the lug ends 24.8 mm from the centre (24.jpg).
    ys = [14.9 + 9.9 * (i / 22) ** 0.9 for i in range(23)]
    for i, y in enumerate(ys):
        f = max(0.0, (y - 16.8) / 8.0)
        # Outer edge tapers linearly: 18.3 mm at y=14.9 to 14.0 mm at y=24.3 (24.jpg silhouette).
        x_out = 18.3 - 0.457 * (y - 14.9)
        top = 1.2 - 4.4 * f**1.7
        bot = -7.3 - 1.2 * f**1.3
        # 21.2 mm end link between the lugs; near the root the inner edge stays outside the dial opening.
        x_in = max(10.65, math.sqrt(max(0.0, 19.8**2 - y**2)))
        if i == len(ys) - 1:  # rounded tip
            x_in, x_out, top, bot = x_in + 0.35, x_out - 0.35, top - 0.35, bot + 0.35
        sec = rrect(x_in, x_out, bot, top, (0.6, 1.0, 0.4, 0.4), 3)
        rings.append([Vector((sx * x, sy * y, z)) for x, z in sec])
    bm = loft(rings, uv_of=lambda co: ((co.x + co.z) / UV_MM, co.y / UV_MM))
    for f in bm.faces:
        n = f.normal
        f.material_index = 0 if n.z > 0.85 or abs(n.x) > 0.85 else 1  # brushed top and flank, polished chamfer
    return bm


def build_case(brushed, polished):
    bm = lathe(case_profile())
    for f in bm.faces:
        c = f.calc_center_median()
        r = math.hypot(c.x, c.y)
        # Ref 24/19: bezel, case top and back satin; only the vertical case side is polished.
        side = r > CASE_R - 0.05 and -6.45 < c.z < 1.5
        f.material_index = 1 if side else 0
    for sx in (-1, 1):
        for sy in (-1, 1):
            append(bm, lug(sx, sy))
    ob = finish('Case', bm, [brushed, polished])
    # Rectangular notches in the lower case edge at 3 and 9 (18.jpg, 19.jpg); other positions not visible.
    # Cut by a boolean that the glTF export applies (export_apply=True); the cutter itself is not exported.
    cut = bmesh.new()
    for deg in (0, 180):
        a = math.radians(deg)
        append(cut, box((3.8, 1.6, 3.0)), Matrix.Translation((21.6 * math.cos(a), 21.6 * math.sin(a), -9.1)) @ Matrix.Rotation(a, 4, 'Z'))
    cutter = finish('CaseNotchCutter', cut, [])
    cutter.hide_render = True
    cutter.display_type = 'WIRE'
    mod = ob.modifiers.new('Notches', 'BOOLEAN')
    mod.operation, mod.object, mod.solver = 'DIFFERENCE', cutter, 'EXACT'
    return ob


def build_crowns(polished):
    bm = bmesh.new()

    def crown(angle_deg, r_out, length, teeth, z, depth, cap):
        """Fluted crown; cap=True puts a smooth domed cap over a short toothed base (GMT crown, 18.jpg)."""
        a0 = math.radians(angle_deg)
        m = Matrix.Translation(((CASE_R + 0.6) * math.cos(a0), (CASE_R + 0.6) * math.sin(a0), z)) @ Matrix.Rotation(a0, 4, 'Z') @ Matrix.Rotation(math.pi / 2, 4, 'Y')
        samples = teeth * 6
        ring = [(math.cos(TAU * i / samples), math.sin(TAU * i / samples), 1 - depth * (0.5 - 0.5 * math.cos(teeth * TAU * i / samples))) for i in range(samples)]
        body = length * 0.45 if cap else length
        rings = []
        for t, scale in ((0.0, 0.86), (0.25, 0.97), (0.5, 1.0), (body - 0.5, 1.0), (body - 0.2, 0.96), (body, 0.86)):
            rings.append([Vector((c * k * r_out * scale, s * k * r_out * scale, t)) for c, s, k in ring])
        append(bm, loft(rings), m, 0)
        if cap:
            dome = lathe([(0.0, length + 0.45), (r_out * 0.55, length + 0.38), (r_out * 0.85, length + 0.12), (r_out * 0.96, length - 0.4),
                          (r_out * 0.96, body - 0.1), (r_out * 0.6, body - 0.1)], 64)
        else:  # flat end (01.jpg)
            dome = lathe([(0.0, length + 0.06), (r_out * 0.8, length + 0.05), (r_out * 0.86, length - 0.05)], 64)
        append(bm, dome, m, 0)
        append(bm, disc(r_out * 0.5, -1.0, 0.05, 32), m, 0)  # tube

    crown(0.0, 3.6, 3.0, 36, -3.05, 0.14, False)  # winding crown at 3: deep flutes (01, 19.jpg)
    crown(150.5, 3.4, 3.4, 30, -3.05, 0.1, True)  # GMT crown near 10: domed cap over teeth (18.jpg)
    return finish('Crowns', bm, [polished], sharp_deg=50)


# ---------- dial side ----------

def build_dial(dial_mat):
    """Flat dial with the 24 h flange rising as a rehaut towards the bezel opening."""
    radii = [0.0, 1.5, 4, 7, 10, 13, 15, FLANGE_IN, 17.2, 18.0, 18.7, DIAL_R]
    height = lambda r: DIAL_Z + (0.0 if r <= FLANGE_IN else 0.9 * (r - FLANGE_IN) / (DIAL_R - FLANGE_IN))
    steps = 192
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new()
    rings = [[bm.verts.new((r * math.cos(TAU * i / steps), r * math.sin(TAU * i / steps), height(r))) for i in range(steps)] for r in radii[1:]]
    centre = bm.verts.new((0, 0, DIAL_Z))
    for i in range(steps):
        bm.faces.new((centre, rings[0][i], rings[0][(i + 1) % steps]))
    for a, b in zip(rings, rings[1:]):
        for i in range(steps):
            j = (i + 1) % steps
            bm.faces.new((a[i], b[i], b[j], a[j]))
    for f in bm.faces:
        for loop in f.loops:
            co = loop.vert.co
            loop[uv].uv = (0.5 + co.x / (2 * DIAL_R), 0.5 + co.y / (2 * DIAL_R))
    return finish('Dial', bm, [dial_mat], sharp_deg=90)


def build_indices(polished, lume):
    """Faceted applied bars with lume (ref 24); small squares at 12 and 6, none at 3 (date)."""
    bm = bmesh.new()
    for h in range(1, 13):
        if h == 3:
            continue
        angle = math.radians(90 - h * 30)
        rot = angle - math.pi / 2
        if h in (12, 6):
            r, w, length = 14.65, 0.95, 1.24  # measured on 24.jpg
        else:
            r, w, length = 13.4, 0.96, 3.84  # measured on 24.jpg
        x, y = r * math.cos(angle), r * math.sin(angle)
        append(bm, box((w, length, 0.5), bevel=0.16, segments=3), at(x, y, DIAL_Z + 0.25, rot), 0)
        append(bm, box((w - 0.42, length - 0.42, 0.05)), at(x, y, DIAL_Z + 0.51, rot), 1)
    return finish('Indices', bm, [polished, lume], sharp_deg=40)


def build_cyclops(glass):
    """Raised rounded magnifier over the date window (24, 01.jpg), standing on the crystal at r = 11.9 mm."""
    outline = rrect(-3.7, 3.7, -2.6, 2.6, (1.3, 1.3, 1.3, 1.3), 5)
    z0 = 2.6  # crystal top is ~2.79 at r = 8.2 and ~2.62 at r = 15.8; the base stays inside it
    rings = [[Vector((11.9 + x * s, y * s, z0 + dz)) for x, y in outline]
             for s, dz in ((1.0, 0.0), (1.0, 0.3), (0.97, 0.62), (0.9, 0.85), (0.78, 0.98), (0.6, 1.04))]
    return finish('Cyclops', loft(rings), [glass], sharp_deg=60)


def hand(bm, outline, z, clockwise_deg, mat_index, thick):
    append(bm, prism(outline, z, z + thick), Matrix.Rotation(-math.radians(clockwise_deg), 4, 'Z'), mat_index)


def build_hands(polished, lume, red):
    bm = bmesh.new()
    # 10:12:32 with the GMT hand on 22, as in ref 24.
    hour, minute, second, gmt = 305.0, 72.0, 194.0, 332.0
    z = DIAL_Z + 0.55
    hand(bm, [(-0.12, -4.0), (0.12, -4.0), (0.12, 12.9), (-0.12, 12.9)], z, gmt, 2, 0.1)
    # Plane-shaped GMT tip with swept-back wings, centred 13.7 mm out (24.jpg).
    hand(bm, [(0.0, 15.0), (0.25, 14.2), (1.1, 13.5), (1.0, 13.25), (0.2, 13.5), (0.15, 12.9), (0.5, 12.5), (0.45, 12.35), (0.0, 12.6),
              (-0.45, 12.35), (-0.5, 12.5), (-0.15, 12.9), (-0.2, 13.5), (-1.0, 13.25), (-1.1, 13.5), (-0.25, 14.2)], z, gmt, 2, 0.1)
    z += 0.2
    # Hour: wide framed sword, frame tip 9.2 mm; lume 2.4-8.8 mm, ~1.6 mm wide (24.jpg).
    hand(bm, [(-0.45, -2.2), (0.45, -2.2), (0.5, 1.5), (0.95, 3.5), (0.95, 5.0), (0.0, 9.2), (-0.95, 5.0), (-0.95, 3.5), (-0.5, 1.5)], z, hour, 0, 0.14)
    hand(bm, [(-0.3, 2.4), (0.3, 2.4), (0.8, 3.5), (0.8, 5.0), (0.0, 8.8), (-0.8, 5.0), (-0.8, 3.5)], z + 0.14, hour, 1, 0.04)
    z += 0.22
    # Minute: slim framed sword, frame tip 13.6 mm; lume 2.2-12.0 mm, ~1.2 mm wide (24.jpg).
    hand(bm, [(-0.4, -2.8), (0.4, -2.8), (0.45, 1.5), (0.75, 5.0), (0.7, 10.0), (0.0, 13.6), (-0.7, 10.0), (-0.75, 5.0), (-0.45, 1.5)], z, minute, 0, 0.14)
    hand(bm, [(-0.25, 2.2), (0.25, 2.2), (0.6, 5.0), (0.55, 10.0), (0.0, 12.0), (-0.55, 10.0), (-0.6, 5.0)], z + 0.14, minute, 1, 0.04)
    z += 0.22
    hand(bm, [(-0.08, -4.2), (0.08, -4.2), (0.05, 16.0), (-0.05, 16.0)], z, second, 2, 0.07)  # red needle
    append(bm, disc(0.6, z, z + 0.07, 24), Matrix.Rotation(-math.radians(second), 4, 'Z') @ Matrix.Translation((0, -2.9, 0)), 0)
    append(bm, disc(1.1, DIAL_Z + 0.5, z + 0.1, 40), Matrix(), 0)
    append(bm, lathe([(0.0, z + 0.32), (0.45, z + 0.28), (0.65, z + 0.1)], 32), Matrix(), 0)
    return finish('Hands', bm, [polished, lume, red], sharp_deg=50)


def build_crystal(glass):
    bm = lathe([(0.0, 2.85), (10.0, 2.78), (16.0, 2.62), (19.45, 2.4), (19.45, 1.5), (0.0, 1.5)], 128)
    return finish('Crystal', bm, [glass], sharp_deg=60)


# ---------- bracelet ----------

def build_bracelet(brushed, polished, dark):
    """Five-row bracelet on the measured loop (ref 19), brick-laid centre row (ref 15), folding clasp."""
    A, B, ZC = 40.0, 29.0, -30.0
    point = lambda t: Vector((0.0, A * math.sin(t), ZC + B * math.cos(t)))
    t_start = math.asin(20.8 / A)  # inside the lug gap, under the case edge
    t_end = TAU - t_start

    samples = 4000
    ts = [t_start + (t_end - t_start) * i / samples for i in range(samples + 1)]
    lengths = [0.0]
    for a, b in zip(ts, ts[1:]):
        lengths.append(lengths[-1] + (point(b) - point(a)).length)
    total = lengths[-1]
    mid = total / 2

    def t_at(s):
        lo, hi = 0, samples
        while hi - lo > 1:
            m = (lo + hi) // 2
            if lengths[m] < s:
                lo = m
            else:
                hi = m
        f = (s - lengths[lo]) / max(lengths[hi] - lengths[lo], 1e-9)
        return ts[lo] + (ts[hi] - ts[lo]) * f

    def frame(s):
        """x across (21.2 mm at the case, 20.1 mm at the clasp: 24, 13.jpg), y along the loop, z outward."""
        t = t_at(s)
        p = point(t)
        tangent = Vector((0.0, A * math.cos(t), -B * math.sin(t))).normalized()
        normal = Vector((0.0, p.y / A**2, (p.z - ZC) / B**2)).normalized()
        taper = 0.95 + 0.05 * min(1.0, abs(s - mid) / (mid * 0.85))
        m = Matrix.Identity(4)
        m.col[0] = (taper, 0, 0, 0)
        m.col[1] = (*tangent, 0)
        m.col[2] = (*normal, 0)
        m.col[3] = (*p, 1)
        return m

    def sweep(section, s0, s1, mat, mirror=False, round_end=0.0):
        """Lofts section along the loop between s0 and s1; round_end (mm) domes both ends down."""
        if mirror:
            section = [(-x, n) for x, n in reversed(section)]
        k = max(3, int((s1 - s0) / 0.9) + 2)
        ss = [s0 + (s1 - s0) * i / (k - 1) for i in range(k)]
        r = min(round_end, (s1 - s0) / 2)
        if r:
            ends = [r * (1 - math.cos(math.pi / 2 * i / 4)) for i in range(1, 4)]
            ss = sorted(set(ss + [s0 + e for e in ends] + [s1 - e for e in ends]))
        n_lo = min(n for _, n in section)
        x_mid = sum(x for x, _ in section) / len(section)
        rings, uvs = [], []
        for s in ss:
            m = frame(s)
            f = 1.0
            if r:
                d = min(1.0, min(s - s0, s1 - s) / r)
                f = math.sqrt(max(0.0, 1 - (1 - d) ** 2))
            sec = [(x_mid + (x - x_mid) * (0.9 + 0.1 * f), n_lo + (n - n_lo) * (0.45 + 0.55 * f)) for x, n in section]
            rings.append([m @ Vector((x, 0, n)) for x, n in sec])
            uvs.append([((x + n) / UV_MM, s / UV_MM) for x, n in sec])
        flat = {}
        bm_ = loft(rings)
        # Per-vertex UVs: loft creates vertices ring by ring in order.
        for v, uv in zip(bm_.verts, [u for ring in uvs for u in ring]):
            flat[v] = uv
        layer = bm_.loops.layers.uv.new()
        for f in bm_.faces:
            for loop in f.loops:
                loop[layer].uv = flat[loop.vert]
        append(bm, bm_, Matrix(), mat)

    def s_for_y(y):
        """Arc length on the 12 o'clock side where the loop reaches |y|."""
        for i, t in enumerate(ts):
            if A * math.sin(t) >= y:
                return lengths[i]
        return 0.0

    bm = bmesh.new()
    GAP = 0.3
    ROUND = 0.9
    OUTER = rrect(5.0, 10.6, -1.8, 1.8, (0.5, 0.95, 0.45, 0.5))  # 21.2 mm bracelet (24.jpg)
    SIDE = rrect(1.72, 5.08, -1.65, 1.74, (0.3, 0.3, 0.3, 0.3))
    CENTRE = rrect(-1.62, 1.62, -1.65, 1.74, (0.3, 0.3, 0.3, 0.3))

    def rows(a, b, centre=True, side=True):
        """Brushed outer rows, polished side rows and polished centre row between a and b."""
        for mirror in (False, True):
            sweep(OUTER, a + GAP, b - GAP, 0, mirror, ROUND)
            if side:
                sweep(SIDE, a + GAP, b - GAP, 1, mirror, ROUND)
        if centre:
            sweep(CENTRE, a + GAP, b - GAP, 1, round_end=ROUND)  # polished centre pieces (13.jpg)

    def pin(s):
        m = frame(s)
        for sx in (-1, 1):
            append(bm, disc(0.32, -0.04, 0.06, 12), m @ Matrix.Translation((sx * 10.6, 0, 0.0)) @ Matrix.Rotation(sx * math.pi / 2, 4, 'Y'), 1)

    s_end = s_for_y(25.3)
    clasp_c, clasp_half = mid + 9.0, 12.5
    rows(0.0, s_end)
    rows(total - s_end, total)
    for r0, r1 in ((s_end, clasp_c - clasp_half), (clasp_c + clasp_half, total - s_end)):
        n = max(1, round((r1 - r0) / 7.6))
        pitch = (r1 - r0) / n
        for i in range(n):
            a, b = r0 + i * pitch, r0 + (i + 1) * pitch
            rows(a, b, side=False)
            pin(a)
        pin(r1)
        # Polished rows offset by half a link: H pattern (ref 15).
        cuts = [r0] + [r0 + pitch / 2 + i * pitch for i in range(n)] + [r1]
        for a, b in zip(cuts, cuts[1:]):
            for mirror in (False, True):
                sweep(SIDE, a + GAP, b - GAP, 1, mirror, ROUND)

    # Folding clasp as wide as the bracelet at the clasp (13.jpg), swept so it follows the loop.
    c0, c1 = clasp_c - clasp_half, clasp_c + clasp_half
    sweep(rrect(-10.6, 10.6, -1.6, 2.4, (0.6, 1.0, 1.0, 0.6)), c0, c1, 0)
    sweep(rrect(-9.0, 9.0, 2.3, 2.9, (0.2, 0.3, 0.3, 0.2)), clasp_c - 2.0, c1 - 0.8, 0)  # safety lid
    sweep(rrect(-2.0, 2.0, 2.3, 2.55, (0.1, 0.12, 0.12, 0.1), 2), c0 + 2.0, clasp_c - 3.0, 1)  # polished strip
    sweep(rrect(-3.0, 3.0, 2.3, 3.3, (0.2, 0.45, 0.45, 0.2)), c1 - 2.4, c1 + 0.4, 1)  # lift tab
    for k in range(5):  # ribs across the lift tab (13.jpg)
        s = c1 - 2.1 + 0.5 * k
        sweep(rrect(-2.7, 2.7, 3.25, 3.5, (0.08, 0.08, 0.08, 0.08), 2), s, s + 0.22, 1)
    # Side: hinge pins at both ends and three micro-adjust holes (15.jpg).
    for sx in (-1, 1):
        for s, r, mat in ((c0 + 1.2, 0.45, 1), (c1 - 1.2, 0.45, 1), (c0 + 3.4, 0.3, 2), (c0 + 4.6, 0.3, 2), (c0 + 5.8, 0.3, 2)):
            append(bm, disc(r, -0.03, 0.04, 16), frame(s) @ Matrix.Translation((sx * 10.6, 0, 0.4)) @ Matrix.Rotation(sx * math.pi / 2, 4, 'Y'), mat)
    return finish('Bracelet', bm, [brushed, polished, dark], sharp_deg=40)


def main():
    reset()
    normal = brushed_normal_image()
    steel = srgb('c8cbd0')
    brushed = material('SteelBrushed', steel, 1.0, 0.3, normal=normal)
    polished = material('SteelPolished', steel, 1.0, 0.07)
    hand_frame = material('HandFrame', srgb('1b1d1f'), 0.8, 0.25)
    lume = material('Lume', srgb('eef0e8'), 0.0, 0.4)
    red = material('GmtRed', srgb('cf2420'), 0.0, 0.3)
    glass = material('Crystal', (1, 1, 1), 0.0, 0.02, alpha=0.06)
    cyclops = material('Cyclops', (1, 1, 1), 0.0, 0.0)
    lens = cyclops.node_tree.nodes['Principled BSDF']
    lens.inputs['Transmission Weight'].default_value = 1.0
    lens.inputs['IOR'].default_value = 1.77  # sapphire
    dial = material('Dial', (1, 1, 1), 0.0, 0.38, image=BUILD / 'dial.png')

    parts = [
        build_case(brushed, polished),
        build_crowns(polished),
        build_dial(dial),
        build_cyclops(cyclops),
        build_indices(polished, lume),
        build_hands(hand_frame, lume, red),
        build_crystal(glass),
        build_bracelet(brushed, polished, hand_frame),
    ]
    total = 0
    for ob in parts:
        tris = sum(len(p.vertices) - 2 for p in ob.data.polygons)
        total += tris
        print(ob.name, tris)
    print('triangles', total)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action='DESELECT')
    for ob in parts:
        ob.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=str(OUT),
        export_format='GLB',
        use_selection=True,
        export_image_format='WEBP',
        export_image_quality=90,
        export_yup=True,
        export_apply=True,
        export_animations=False,
        export_cameras=False,
        export_lights=False,
        export_meshopt_compression_enable=True,
    )
    print('exported', OUT, OUT.stat().st_size)


main()
