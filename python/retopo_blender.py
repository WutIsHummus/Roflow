"""Blender QuadriFlow retopology script.

Usage (run by the Electron main process):
    blender --background --python retopo_blender.py -- <input_glb> <output_glb> [target_faces]

Progress lines are written to stdout as:  PROGRESS:<0-100>
Error lines are written to stdout as:     ERROR:<message>
"""

import sys
import os


def main():
    argv = sys.argv

    # Blender passes script args after '--'
    if '--' not in argv:
        print('ERROR: Expected -- <input_glb> <output_glb> [target_faces]', flush=True)
        sys.exit(1)

    args = argv[argv.index('--') + 1:]
    if len(args) < 2:
        print('ERROR: Need at least <input_glb> and <output_glb> arguments', flush=True)
        sys.exit(1)

    input_path = args[0]
    output_path = args[1]
    target_faces = int(args[2]) if len(args) > 2 else 2000

    if not os.path.isfile(input_path):
        print(f'ERROR: Input file not found: {input_path}', flush=True)
        sys.exit(1)

    # Import bpy only inside Blender's Python environment
    try:
        import bpy
    except ImportError:
        print('ERROR: bpy not available — this script must be run inside Blender', flush=True)
        sys.exit(1)

    print('PROGRESS:10', flush=True)

    # Clear the default scene
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()

    print('PROGRESS:20', flush=True)

    # Import the GLB file
    try:
        bpy.ops.import_scene.gltf(filepath=input_path)
    except Exception as exc:
        print(f'ERROR: Failed to import GLB: {exc}', flush=True)
        sys.exit(1)

    print('PROGRESS:35', flush=True)

    mesh_objects = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
    if not mesh_objects:
        print('ERROR: No mesh objects found in the input file', flush=True)
        sys.exit(1)

    print('PROGRESS:40', flush=True)

    # Remesh each mesh object using QuadriFlow
    for i, obj in enumerate(mesh_objects):
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)

        # Ensure we are in Object mode before remeshing
        if bpy.context.object.mode != 'OBJECT':
            bpy.ops.object.mode_set(mode='OBJECT')

        # Apply QuadriFlow remesh
        # target_faces is distributed proportionally if multiple meshes exist
        per_mesh_faces = max(100, target_faces // max(1, len(mesh_objects)))
        try:
            bpy.ops.object.quadriflow_remesh(
                target_faces=per_mesh_faces,
                use_mesh_curvature=False,
                use_preserve_sharp=True,
                use_preserve_boundary=True,
            )
        except Exception as exc:
            print(f'ERROR: QuadriFlow remesh failed on {obj.name}: {exc}', flush=True)
            sys.exit(1)

        pct = 40 + int(50 * (i + 1) / len(mesh_objects))
        print(f'PROGRESS:{pct}', flush=True)

    print('PROGRESS:92', flush=True)

    # Ensure the output directory exists
    out_dir = os.path.dirname(output_path)
    if out_dir and not os.path.isdir(out_dir):
        os.makedirs(out_dir, exist_ok=True)

    # Export the remeshed scene as GLB
    try:
        bpy.ops.export_scene.gltf(filepath=output_path, export_format='GLB')
    except Exception as exc:
        print(f'ERROR: Failed to export GLB: {exc}', flush=True)
        sys.exit(1)

    print('PROGRESS:100', flush=True)


if __name__ == '__main__':
    main()
