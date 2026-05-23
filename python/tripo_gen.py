#!/usr/bin/env python3
"""
Tripo3D generation wrapper — mirrors how ComfyUI-Tripo nodes use the tripo3d SDK.
Reads TRIPO_API_KEY from environment (set once, no key stored in the app).

Usage:
  python tripo_gen.py --mode text   --prompt "a gaming chair" --output /tmp/out.glb
  python tripo_gen.py --mode image  --image /path/ref.jpg     --output /tmp/out.glb
  python tripo_gen.py --mode balance
  python tripo_gen.py --mode check   (verify SDK + key works)
"""

import asyncio
import argparse
import json
import sys
import os

def progress(step, pct):
    """Emit a progress event as JSON on stdout (IPC protocol)."""
    print(json.dumps({"type": "progress", "step": step, "pct": pct}), flush=True)

def result(data):
    """Emit the final result as JSON on stdout."""
    print(json.dumps({"type": "result", **data}), flush=True)


async def run(args):
    try:
        from tripo3d import TripoClient
    except ImportError:
        result({"success": False, "error": "tripo3d SDK not installed. Run: pip install tripo3d"})
        return

    # TripoClient() reads TRIPO_API_KEY from environment automatically
    # or accepts api_key= kwarg if provided as override
    client_kwargs = {}
    if args.api_key:
        client_kwargs["api_key"] = args.api_key

    if args.mode == "balance":
        async with TripoClient(**client_kwargs) as client:
            balance = await client.get_balance()
            result({"success": True, "balance": balance.balance, "frozen": balance.frozen})
        return

    if args.mode == "check":
        async with TripoClient(**client_kwargs) as client:
            balance = await client.get_balance()
            result({"success": True, "message": f"Connected — balance: {balance.balance}"})
        return

    # ── Generation ─────────────────────────────────────────────────────────────
    from tripo3d import TaskStatus

    os.makedirs(os.path.dirname(os.path.abspath(args.output)), exist_ok=True)
    out_dir = os.path.dirname(os.path.abspath(args.output))

    # Build generation kwargs
    gen_kwargs = {}
    if args.model_version: gen_kwargs["model_version"] = args.model_version
    if args.style and args.style != "None":  gen_kwargs["style"] = args.style
    if args.texture is not None:    gen_kwargs["texture"] = args.texture
    if args.pbr is not None:        gen_kwargs["pbr"] = args.pbr
    if args.smart_low_poly:         gen_kwargs["smart_low_poly"] = True
    if args.face_limit and args.face_limit > 0: gen_kwargs["face_limit"] = args.face_limit

    async with TripoClient(**client_kwargs) as client:
        progress("Connecting to Tripo…", 5)

        if args.mode == "text":
            if not args.prompt:
                result({"success": False, "error": "--prompt required for text mode"})
                return
            progress("Creating text-to-3D task…", 12)
            task_id = await client.text_to_model(prompt=args.prompt, **gen_kwargs)

        elif args.mode == "image":
            if not args.image:
                result({"success": False, "error": "--image required for image mode"})
                return
            progress("Uploading reference image…", 12)
            task_id = await client.image_to_model(image=args.image, **gen_kwargs)

        elif args.mode == "multiview":
            images = [x for x in [args.image, args.image_back, args.image_left, args.image_right] if x]
            if not images:
                result({"success": False, "error": "--image required for multiview mode"})
                return
            progress("Creating multiview-to-3D task…", 12)
            task_id = await client.multiview_to_model(images=images, **gen_kwargs)
        else:
            result({"success": False, "error": f"Unknown mode: {args.mode}"})
            return

        progress(f"Task queued ({str(task_id)[:8]}…)", 20)

        # Poll with progress updates
        last_pct = 20
        while True:
            await asyncio.sleep(2)
            task = await client.get_task(task_id)

            if task.status == TaskStatus.SUCCESS:
                break
            elif task.status in (TaskStatus.FAILED, TaskStatus.CANCELLED):
                msg = getattr(task, "message", str(task.status))
                result({"success": False, "error": f"Task {task.status}: {msg}"})
                return

            # Estimate progress from task.progress if available
            raw_pct = getattr(task, "progress", 0) or 0
            pct = int(20 + raw_pct * 0.7)
            if pct > last_pct:
                last_pct = pct
                progress(f"Generating 3D model… {raw_pct}%", pct)

        progress("Downloading GLB model…", 93)
        downloaded = await client.download_task_models(task, out_dir)

        # Find the GLB / PBR model output
        out_path = (
            downloaded.get("pbr_model") or
            downloaded.get("model") or
            downloaded.get("base_model") or
            next(iter(downloaded.values()), None)
        )

        if not out_path:
            result({"success": False, "error": "No output file after download"})
            return

        # Rename to the requested output path if different
        if os.path.abspath(out_path) != os.path.abspath(args.output):
            import shutil
            shutil.copy2(out_path, args.output)
            out_path = args.output

        progress("Model ready!", 100)
        result({"success": True, "outputPath": out_path, "taskId": str(task_id), "provider": "tripo-sdk"})


def main():
    parser = argparse.ArgumentParser(description="Tripo3D SDK wrapper")
    parser.add_argument("--mode",          required=True, choices=["text", "image", "multiview", "balance", "check"])
    parser.add_argument("--prompt",        default="")
    parser.add_argument("--image",         default="")
    parser.add_argument("--image-back",    default="", dest="image_back")
    parser.add_argument("--image-left",    default="", dest="image_left")
    parser.add_argument("--image-right",   default="", dest="image_right")
    parser.add_argument("--output",        default="output.glb")
    parser.add_argument("--model-version", default="v3.1-20260211", dest="model_version")
    parser.add_argument("--style",         default="None")
    parser.add_argument("--texture",       action="store_true", default=True)
    parser.add_argument("--no-texture",    action="store_false", dest="texture")
    parser.add_argument("--pbr",           action="store_true", default=True)
    parser.add_argument("--no-pbr",        action="store_false", dest="pbr")
    parser.add_argument("--smart-low-poly",action="store_true", default=False, dest="smart_low_poly")
    parser.add_argument("--face-limit",    type=int, default=-1, dest="face_limit")
    parser.add_argument("--api-key",       default="", dest="api_key",
                        help="Override API key (leave blank to use TRIPO_API_KEY env var)")
    args = parser.parse_args()

    asyncio.run(run(args))


if __name__ == "__main__":
    main()
