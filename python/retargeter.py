"""
retargeter.py  —  Generic BVH → Roblox R15 FBX exporter
Usage: python retargeter.py <input_bvh> <output_fbx>

Reads a BVH file, remaps joint names to Roblox R15, and writes
an FBX ASCII 7.4 file that Roblox Studio's Animation Editor can import.
"""

import sys
import re
import math
import time
from pathlib import Path


# ── Roblox R15 skeleton definition ──────────────────────────────────────────

R15_BONES = [
    ('Root',          None,           (0, 0, 0)),
    ('LowerTorso',    'Root',         (0, 9.5, 0)),
    ('UpperTorso',    'LowerTorso',   (0, 15, 0)),
    ('Head',          'UpperTorso',   (0, 20, 0)),
    ('LeftUpperArm',  'UpperTorso',   (-17, 0, 0)),
    ('LeftLowerArm',  'LeftUpperArm', (0, -14, 0)),
    ('LeftHand',      'LeftLowerArm', (0, -13, 0)),
    ('RightUpperArm', 'UpperTorso',   (17, 0, 0)),
    ('RightLowerArm', 'RightUpperArm',(0, -14, 0)),
    ('RightHand',     'RightLowerArm',(0, -13, 0)),
    ('LeftUpperLeg',  'LowerTorso',   (-9, 0, 0)),
    ('LeftLowerLeg',  'LeftUpperLeg', (0, -17, 0)),
    ('LeftFoot',      'LeftLowerLeg', (0, -17, 0)),
    ('RightUpperLeg', 'LowerTorso',   (9, 0, 0)),
    ('RightLowerLeg', 'RightUpperLeg',(0, -17, 0)),
    ('RightFoot',     'RightLowerLeg',(0, -17, 0)),
]

# Fuzzy mapping from common BVH joint names to R15 names
BVH_TO_R15 = {
    # Torso / spine
    'root':           'Root',
    'hips':           'Root',
    'pelvis':         'Root',
    'spine':          'LowerTorso',
    'spine1':         'LowerTorso',
    'spine2':         'LowerTorso',
    'spine3':         'UpperTorso',
    'chest':          'UpperTorso',
    'upperchest':     'UpperTorso',
    'neck':           'UpperTorso',
    'head':           'Head',
    # Left arm
    'leftcollar':     'LeftUpperArm',
    'leftshoulder':   'LeftUpperArm',
    'leftarm':        'LeftUpperArm',
    'leftforearm':    'LeftLowerArm',
    'lefthand':       'LeftHand',
    'leftwrist':      'LeftHand',
    # Right arm
    'rightcollar':    'RightUpperArm',
    'rightshoulder':  'RightUpperArm',
    'rightarm':       'RightUpperArm',
    'rightforearm':   'RightLowerArm',
    'righthand':      'RightHand',
    'rightwrist':     'RightHand',
    # Left leg
    'leftupleg':      'LeftUpperLeg',
    'lefthip':        'LeftUpperLeg',
    'leftleg':        'LeftLowerLeg',
    'leftknee':       'LeftLowerLeg',
    'leftfoot':       'LeftFoot',
    'leftankle':      'LeftFoot',
    'lefttoebase':    'LeftFoot',
    # Right leg
    'rightupleg':     'RightUpperLeg',
    'righthip':       'RightUpperLeg',
    'rightleg':       'RightLowerLeg',
    'rightknee':      'RightLowerLeg',
    'rightfoot':      'RightFoot',
    'rightankle':     'RightFoot',
    'righttoebase':   'RightFoot',
}


# ── BVH parser ───────────────────────────────────────────────────────────────

def parse_bvh(path):
    with open(path, 'r') as f:
        text = f.read()

    joints = []       # list of {name, parent_idx, offset, channels}
    joint_stack = []  # index stack for hierarchy

    lines = iter(text.splitlines())
    for line in lines:
        line = line.strip()
        if line.startswith('ROOT') or line.startswith('JOINT'):
            name = line.split()[1]
            parent = joint_stack[-1] if joint_stack else None
            joints.append({'name': name, 'parent': parent, 'offset': (0,0,0), 'channels': []})
            joint_stack.append(len(joints) - 1)
        elif line == '{':
            pass
        elif line == '}':
            if joint_stack:
                joint_stack.pop()
        elif line.startswith('OFFSET'):
            vals = list(map(float, line.split()[1:]))
            joints[-1]['offset'] = tuple(vals)
        elif line.startswith('CHANNELS'):
            parts = line.split()
            n = int(parts[1])
            joints[-1]['channels'] = parts[2:2+n]
        elif line.startswith('MOTION'):
            break

    # Parse motion section
    n_frames = 0
    frame_time = 1/30
    frame_data = []

    for line in lines:
        line = line.strip()
        if line.startswith('Frames:'):
            n_frames = int(line.split(':')[1])
        elif line.startswith('Frame Time:'):
            frame_time = float(line.split(':')[1])
        elif re.match(r'^[-\d]', line):
            vals = list(map(float, line.split()))
            frame_data.append(vals)

    return joints, frame_data, frame_time


def get_r15_name(bvh_name):
    key = bvh_name.lower().replace('_', '').replace(' ', '')
    return BVH_TO_R15.get(key)


def euler_to_matrix(rx, ry, rz):
    """ZXY Euler rotation → 3x3 matrix (degrees)."""
    cx, sx = math.cos(math.radians(rx)), math.sin(math.radians(rx))
    cy, sy = math.cos(math.radians(ry)), math.sin(math.radians(ry))
    cz, sz = math.cos(math.radians(rz)), math.sin(math.radians(rz))
    # ZXY = Rz * Rx * Ry
    return [
        [ cy*cz + sy*sx*sz,  cz*sy*sx - cy*sz,  sy*cx],
        [ cx*sz,             cx*cz,             -sx   ],
        [-sy*cz + cy*sx*sz,  sy*sz + cy*cz*sx,  cy*cx],
    ]


def matrix_to_euler_zxy(m):
    """Matrix → ZXY Euler angles in degrees."""
    rx = math.degrees(math.asin(-m[1][2]))
    if abs(m[1][2]) < 0.9999:
        rz = math.degrees(math.atan2(m[1][0], m[1][1]))
        ry = math.degrees(math.atan2(m[0][2], m[2][2]))
    else:
        rz = math.degrees(math.atan2(-m[0][1], m[0][0]))
        ry = 0.0
    return rx, ry, rz


# ── FBX ASCII writer ─────────────────────────────────────────────────────────

FBX_TIME_ONE_SECOND = 46186158000  # FBX ticks per second

def time_to_ticks(t):
    return int(t * FBX_TIME_ONE_SECOND)


def write_fbx(output_path, r15_frames, frame_time, r15_bones):
    """Write a minimal FBX 7.4 ASCII animation file for Roblox R15."""

    bone_ids = {b[0]: 100 + i for i, b in enumerate(r15_bones)}
    anim_layer_id = 500
    anim_stack_id = 501
    root_translate_cn_id = 900
    root_translate_curve_base = 1900
    curve_node_base = 1000
    curve_base = 2000

    total_ticks = time_to_ticks(len(r15_frames) * frame_time)

    with open(output_path, 'w') as f:

        # ── Header ──────────────────────────────────────────
        f.write('; FBX 7.4.0 project file\n')
        f.write('; Generated by RoFlow\n\n')
        f.write('FBXHeaderExtension:  {\n')
        f.write('\tFBXHeaderVersion: 1003\n\tFBXVersion: 7400\n')
        t = time.localtime()
        f.write(f'\tCreationTimeStamp:  {{\n')
        f.write(f'\t\tVersion: 1000\n\t\tYear: {t.tm_year}\n\t\tMonth: {t.tm_mon}\n')
        f.write(f'\t\tDay: {t.tm_mday}\n\t\tHour: {t.tm_hour}\n\t\tMinute: {t.tm_min}\n')
        f.write(f'\t\tSecond: {t.tm_sec}\n\t\tMillisecond: 0\n\t}}\n')
        f.write('\tCreator: "RoFlow"\n}\n\n')

        f.write('GlobalSettings:  {\n\tVersion: 1000\n')
        f.write('\tProperties70:  {\n')
        f.write('\t\tP: "UpAxis", "int", "Integer", "",1\n')
        f.write('\t\tP: "UpAxisSign", "int", "Integer", "",1\n')
        f.write('\t\tP: "FrontAxis", "int", "Integer", "",2\n')
        f.write('\t\tP: "FrontAxisSign", "int", "Integer", "",1\n')
        f.write('\t\tP: "CoordAxis", "int", "Integer", "",0\n')
        f.write('\t\tP: "CoordAxisSign", "int", "Integer", "",1\n')
        f.write('\t\tP: "UnitScaleFactor", "double", "Number", "",1\n')
        f.write('\t\tP: "TimeMode", "enum", "", "",6\n')
        f.write(f'\t\tP: "TimeSpanStop", "KTime", "Time", "",{total_ticks}\n')
        f.write('\t}\n}\n\n')

        # ── Objects ─────────────────────────────────────────
        f.write('Objects:  {\n\n')

        # Skeleton nodes
        for bone_name, parent, offset in r15_bones:
            bid = bone_ids[bone_name]
            f.write(f'\tModel: {bid}, "Model::{bone_name}", "LimbNode" {{\n')
            f.write('\t\tVersion: 232\n')
            f.write('\t\tProperties70:  {\n')
            f.write(f'\t\t\tP: "Lcl Translation", "Lcl Translation", "", "A",{offset[0]},{offset[1]},{offset[2]}\n')
            f.write('\t\t\tP: "Lcl Rotation", "Lcl Rotation", "", "A",0,0,0\n')
            f.write('\t\t\tP: "Lcl Scaling", "Lcl Scaling", "", "A",1,1,1\n')
            f.write('\t\t}\n\t}\n\n')

        # Animation stack
        f.write(f'\tAnimationStack: {anim_stack_id}, "AnimStack::Take 001", "" {{\n')
        f.write('\t\tProperties70:  {\n')
        f.write('\t\t\tP: "LocalStart", "KTime", "Time", "",0\n')
        f.write(f'\t\t\tP: "LocalStop", "KTime", "Time", "",{total_ticks}\n')
        f.write('\t\t}\n\t}\n\n')

        # Animation layer
        f.write(f'\tAnimationLayer: {anim_layer_id}, "AnimLayer::BaseLayer", "" {{\n\t}}\n\n')

        root_translations = [frame.get('__root_translation__', (0.0, 0.0, 0.0)) for frame in r15_frames]

        f.write(f'\tAnimationCurveNode: {root_translate_cn_id}, "AnimCurveNode::Lcl Translation", "" {{\n')
        f.write('\t\tProperties70:  {\n')
        f.write('\t\t\tP: "d|X", "Number", "", "A",0\n')
        f.write('\t\t\tP: "d|Y", "Number", "", "A",0\n')
        f.write('\t\t\tP: "d|Z", "Number", "", "A",0\n')
        f.write('\t\t}\n\t}\n\n')

        for axis_id, axis_idx in [
            (root_translate_curve_base, 0),
            (root_translate_curve_base + 1, 1),
            (root_translate_curve_base + 2, 2),
        ]:
            times = [time_to_ticks(fi * frame_time) for fi in range(len(r15_frames))]
            values = [root_translations[fi][axis_idx] for fi in range(len(r15_frames))]
            attr_str = ','.join(['L'] * len(times))

            f.write(f'\tAnimationCurve: {axis_id}, "AnimCurve::", "" {{\n')
            f.write(f'\t\tDefault: 0\n')
            f.write(f'\t\tKeyVer: 4008\n')
            f.write(f'\t\tKeyCount: {len(times)}\n')
            f.write(f'\t\tKey: {",".join(str(t) for t in times)}\n')
            f.write(f'\t\t     {",".join(f"{v:.6f}" for v in values)}\n')
            f.write(f'\t\t     {attr_str}\n')
            f.write('\t}\n\n')

        # Curve nodes and curves per bone
        for i, (bone_name, _, _) in enumerate(r15_bones):
            cn_id = curve_node_base + i * 10
            cx_id = curve_base + i * 30
            cy_id = curve_base + i * 30 + 1
            cz_id = curve_base + i * 30 + 2

            rotations = [frame.get(bone_name, (0.0, 0.0, 0.0)) for frame in r15_frames]

            f.write(f'\tAnimationCurveNode: {cn_id}, "AnimCurveNode::Lcl Rotation", "" {{\n')
            f.write('\t\tProperties70:  {\n')
            f.write('\t\t\tP: "d|X", "Number", "", "A",0\n')
            f.write('\t\t\tP: "d|Y", "Number", "", "A",0\n')
            f.write('\t\t\tP: "d|Z", "Number", "", "A",0\n')
            f.write('\t\t}\n\t}\n\n')

            for axis_id, axis_idx in [(cx_id, 0), (cy_id, 1), (cz_id, 2)]:
                times = [time_to_ticks(fi * frame_time) for fi in range(len(r15_frames))]
                values = [rotations[fi][axis_idx] for fi in range(len(r15_frames))]

                f.write(f'\tAnimationCurve: {axis_id}, "AnimCurve::", "" {{\n')
                f.write(f'\t\tDefault: 0\n')
                f.write(f'\t\tKeyVer: 4008\n')
                f.write(f'\t\tKeyCount: {len(times)}\n')

                time_str = ','.join(str(t) for t in times)
                val_str  = ','.join(f'{v:.6f}' for v in values)
                attr_str = ','.join(['L'] * len(times))  # Linear interpolation

                f.write(f'\t\tKey: {time_str}\n')
                f.write(f'\t\t     {val_str}\n')
                f.write(f'\t\t     {attr_str}\n')
                f.write('\t}\n\n')

        f.write('}\n\n')

        # ── Connections ─────────────────────────────────────
        f.write('Connections:  {\n\n')

        # Bone hierarchy
        for bone_name, parent, _ in r15_bones:
            bid = bone_ids[bone_name]
            if parent is None:
                f.write(f'\tC: "OO",{bid},0\n')
            else:
                pid = bone_ids[parent]
                f.write(f'\tC: "OO",{bid},{pid}\n')

        # Anim layer → stack
        f.write(f'\tC: "OO",{anim_layer_id},{anim_stack_id}\n')

        root_id = bone_ids['Root']
        f.write(f'\tC: "OO",{root_translate_cn_id},{anim_layer_id}\n')
        f.write(f'\tC: "OP",{root_translate_cn_id},{root_id},"Lcl Translation"\n')
        f.write(f'\tC: "OP",{root_translate_curve_base},{root_translate_cn_id},"d|X"\n')
        f.write(f'\tC: "OP",{root_translate_curve_base + 1},{root_translate_cn_id},"d|Y"\n')
        f.write(f'\tC: "OP",{root_translate_curve_base + 2},{root_translate_cn_id},"d|Z"\n')

        # Curve nodes → layer + bone
        for i, (bone_name, _, _) in enumerate(r15_bones):
            bid  = bone_ids[bone_name]
            cn_id = curve_node_base + i * 10
            cx_id = curve_base + i * 30
            cy_id = curve_base + i * 30 + 1
            cz_id = curve_base + i * 30 + 2

            f.write(f'\tC: "OO",{cn_id},{anim_layer_id}\n')
            f.write(f'\tC: "OP",{cn_id},{bid},"Lcl Rotation"\n')
            f.write(f'\tC: "OP",{cx_id},{cn_id},"d|X"\n')
            f.write(f'\tC: "OP",{cy_id},{cn_id},"d|Y"\n')
            f.write(f'\tC: "OP",{cz_id},{cn_id},"d|Z"\n')

        f.write('\n}\n')


# ── Main ─────────────────────────────────────────────────────────────────────

def retarget(bvh_path, fbx_path):
    print('PROGRESS:10', flush=True)
    joints, frame_data, frame_time = parse_bvh(bvh_path)
    if not joints:
        raise ValueError('No joints found in BVH file')
    if not frame_data:
        raise ValueError('No animation frames found in BVH file')
    print(f'Parsed BVH: {len(joints)} joints, {len(frame_data)} frames', flush=True)

    # Build channel index map
    channel_offset = 0
    joint_channel_map = {}
    for j in joints:
        joint_channel_map[j['name']] = (channel_offset, j['channels'])
        channel_offset += len(j['channels'])

    print('PROGRESS:30', flush=True)

    # Collect per-frame rotations mapped to R15
    r15_frames = []
    mapped_joints = set()
    for fi, frame_vals in enumerate(frame_data):
        frame_rot = {}
        root_translation = [0.0, 0.0, 0.0]
        for j in joints:
            r15_name = get_r15_name(j['name'])
            if not r15_name:
                continue
            mapped_joints.add(r15_name)
            offset, channels = joint_channel_map[j['name']]
            rot = [0.0, 0.0, 0.0]  # x, y, z degrees
            for k, ch in enumerate(channels):
                value = frame_vals[offset + k]
                if ch == 'Xposition' and r15_name == 'Root':
                    root_translation[0] = value
                elif ch == 'Yposition' and r15_name == 'Root':
                    root_translation[1] = value
                elif ch == 'Zposition' and r15_name == 'Root':
                    root_translation[2] = value
                elif ch == 'Xrotation':
                    rot[0] = value
                elif ch == 'Yrotation':
                    rot[1] = value
                elif ch == 'Zrotation':
                    rot[2] = value

            # Accumulate (last write wins — good enough for retarget)
            frame_rot[r15_name] = tuple(rot)

        # Fill missing bones with zero rotation
        for bone_name, _, _ in R15_BONES:
            frame_rot.setdefault(bone_name, (0.0, 0.0, 0.0))
        frame_rot['__root_translation__'] = tuple(root_translation)

        r15_frames.append(frame_rot)

        if fi % 10 == 0:
            pct = 30 + int(fi / len(frame_data) * 50)
            print(f'PROGRESS:{pct}', flush=True)

    if not mapped_joints:
        raise ValueError('No recognizable humanoid joints were found in the BVH file')

    print('PROGRESS:85', flush=True)
    write_fbx(fbx_path, r15_frames, frame_time, R15_BONES)
    print('PROGRESS:100', flush=True)
    print(f'FBX written: {fbx_path}', flush=True)


if __name__ == '__main__':
    if len(sys.argv) < 3:
        print('Usage: retargeter.py <input.bvh> <output.fbx>')
        sys.exit(1)
    retarget(sys.argv[1], sys.argv[2])
