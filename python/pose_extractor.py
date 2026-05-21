"""
pose_extractor.py  —  Video → BVH skeleton animation (MediaPipe)
Usage: python pose_extractor.py <video_path> <output_bvh>
"""

import sys
import cv2
import numpy as np
import mediapipe as mp
from pathlib import Path

# MediaPipe landmark indices → bone name mapping
# We use the 33-landmark Pose model
MP_TO_BONE = {
    0:  'head',
    11: 'left_shoulder',
    12: 'right_shoulder',
    13: 'left_elbow',
    14: 'right_elbow',
    15: 'left_wrist',
    16: 'right_wrist',
    23: 'left_hip',
    24: 'right_hip',
    25: 'left_knee',
    26: 'right_knee',
    27: 'left_ankle',
    28: 'right_ankle',
}

# BVH joint hierarchy (parent → [children])
BVH_HIERARCHY = [
    ('Root',         None,           (0, 0, 0)),
    ('LowerTorso',   'Root',         (0, 9, 0)),
    ('UpperTorso',   'LowerTorso',   (0, 18, 0)),
    ('Head',         'UpperTorso',   (0, 24, 0)),
    ('LeftUpperArm', 'UpperTorso',   (-14, 0, 0)),
    ('LeftLowerArm', 'LeftUpperArm', (-13, 0, 0)),
    ('LeftHand',     'LeftLowerArm', (-11, 0, 0)),
    ('RightUpperArm','UpperTorso',   (14, 0, 0)),
    ('RightLowerArm','RightUpperArm',(13, 0, 0)),
    ('RightHand',    'RightLowerArm',(11, 0, 0)),
    ('LeftUpperLeg', 'LowerTorso',   (-9, 0, 0)),
    ('LeftLowerLeg', 'LeftUpperLeg', (0, -18, 0)),
    ('LeftFoot',     'LeftLowerLeg', (0, -18, 0)),
    ('RightUpperLeg','LowerTorso',   (9, 0, 0)),
    ('RightLowerLeg','RightUpperLeg',(0, -18, 0)),
    ('RightFoot',    'RightLowerLeg',(0, -18, 0)),
]

BONE_NAMES = [b[0] for b in BVH_HIERARCHY]

# MediaPipe landmark → Roblox R15 joint mapping
MP_LANDMARK_TO_R15 = {
    'Root':          (23, 24),  # average of hips
    'LowerTorso':    (23, 24),
    'UpperTorso':    (11, 12),  # average of shoulders
    'Head':          (0,),
    'LeftUpperArm':  (11,),
    'LeftLowerArm':  (13,),
    'LeftHand':      (15,),
    'RightUpperArm': (12,),
    'RightLowerArm': (14,),
    'RightHand':     (16,),
    'LeftUpperLeg':  (23,),
    'LeftLowerLeg':  (25,),
    'LeftFoot':      (27,),
    'RightUpperLeg': (24,),
    'RightLowerLeg': (26,),
    'RightFoot':     (28,),
}


def get_landmark_pos(landmarks, indices):
    """Average world position of given landmark indices."""
    pts = []
    for i in indices:
        lm = landmarks[i]
        pts.append(np.array([lm.x, lm.y, lm.z]))
    return np.mean(pts, axis=0)


def pos_to_euler(v):
    """Naive direction-to-Euler conversion (ZXY order, degrees)."""
    length = np.linalg.norm(v)
    if length < 1e-6:
        return 0.0, 0.0, 0.0
    v = v / length
    x = np.degrees(np.arcsin(-v[1]))
    y = np.degrees(np.arctan2(v[0], v[2]))
    return x, y, 0.0


def write_bvh(output_path, frames, fps=30):
    """Write a BVH file with R15 skeleton and per-frame rotation keyframes."""
    with open(output_path, 'w') as f:
        # ── HIERARCHY ──
        f.write('HIERARCHY\n')
        written = set()
        indent_map = {}

        def write_joint(name, is_root=False):
            parent = next(b[1] for b in BVH_HIERARCHY if b[0] == name)
            offset = next(b[2] for b in BVH_HIERARCHY if b[0] == name)
            indent = 0
            if parent:
                indent = indent_map.get(parent, 0) + 1
            indent_map[name] = indent
            pad = '\t' * indent

            if is_root:
                f.write(f'ROOT {name}\n{{\n')
                f.write(f'\tOFFSET {offset[0]:.4f} {offset[1]:.4f} {offset[2]:.4f}\n')
                f.write('\tCHANNELS 6 Xposition Yposition Zposition Zrotation Xrotation Yrotation\n')
            else:
                children = [b[0] for b in BVH_HIERARCHY if b[1] == name]
                tag = 'End Site' if not children else f'JOINT {name}'
                if tag == 'End Site':
                    f.write(f'{pad}End Site\n{pad}{{\n')
                    f.write(f'{pad}\tOFFSET {offset[0]:.4f} {offset[1]:.4f} {offset[2]:.4f}\n')
                    f.write(f'{pad}}}\n')
                    return
                f.write(f'{pad}JOINT {name}\n{pad}{{\n')
                f.write(f'{pad}\tOFFSET {offset[0]:.4f} {offset[1]:.4f} {offset[2]:.4f}\n')
                f.write(f'{pad}\tCHANNELS 3 Zrotation Xrotation Yrotation\n')

            written.add(name)
            children = [b[0] for b in BVH_HIERARCHY if b[1] == name]
            for child in children:
                write_joint(child)

            f.write(f'{pad}}}\n' if not is_root else '}\n')

        write_joint('Root', is_root=True)

        # ── MOTION ──
        f.write('MOTION\n')
        f.write(f'Frames: {len(frames)}\n')
        f.write(f'Frame Time: {1.0/fps:.6f}\n')

        for frame in frames:
            row = []
            # Root: position + rotation
            root_pos = frame.get('Root', np.zeros(3)) * 100  # scale to cm
            row.extend([f'{root_pos[0]:.4f}', f'{root_pos[1]:.4f}', f'{root_pos[2]:.4f}'])
            row.extend(['0.0000', '0.0000', '0.0000'])  # root rotation

            for bone_name, parent, _ in BVH_HIERARCHY[1:]:
                children = [b[0] for b in BVH_HIERARCHY if b[1] == bone_name]
                if not children:
                    continue  # end site, no channels
                rot = frame.get(bone_name, np.zeros(3))
                row.extend([f'{rot[2]:.4f}', f'{rot[0]:.4f}', f'{rot[1]:.4f}'])

            f.write(' '.join(row) + '\n')


def extract(video_path, output_bvh):
    mp_pose = mp.solutions.pose
    cap = cv2.VideoCapture(video_path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 1
    frames = []
    frame_idx = 0

    with mp_pose.Pose(
        static_image_mode=False,
        model_complexity=1,
        smooth_landmarks=True,
        enable_segmentation=False,
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5
    ) as pose:
        while cap.isOpened():
            ret, img = cap.read()
            if not ret:
                break

            img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            result = pose.process(img_rgb)

            frame_data = {}
            if result.pose_world_landmarks:
                lm = result.pose_world_landmarks.landmark
                for bone in BONE_NAMES:
                    indices = MP_LANDMARK_TO_R15.get(bone, (0,))
                    pos = get_landmark_pos(lm, indices)
                    frame_data[bone] = pos
            else:
                # No detection — use identity
                for bone in BONE_NAMES:
                    frame_data[bone] = np.zeros(3)

            frames.append(frame_data)
            frame_idx += 1
            pct = int(frame_idx / total * 90)
            print(f'PROGRESS:{pct}', flush=True)

    cap.release()

    # Convert positions to Euler rotations per bone
    euler_frames = []
    for frame in frames:
        ef = {}
        for bone_name, parent, _ in BVH_HIERARCHY:
            if parent is None:
                ef[bone_name] = frame.get(bone_name, np.zeros(3))
            else:
                child_pos = frame.get(bone_name, np.zeros(3))
                parent_pos = frame.get(parent, np.zeros(3))
                direction = child_pos - parent_pos
                ex, ey, ez = pos_to_euler(direction)
                ef[bone_name] = np.array([ex, ey, ez])
        euler_frames.append(ef)

    print('PROGRESS:95', flush=True)
    write_bvh(output_bvh, euler_frames, fps=fps)
    print('PROGRESS:100', flush=True)
    print(f'BVH written: {output_bvh}')


if __name__ == '__main__':
    if len(sys.argv) < 3:
        print('Usage: pose_extractor.py <video_path> <output_bvh>')
        sys.exit(1)
    extract(sys.argv[1], sys.argv[2])
