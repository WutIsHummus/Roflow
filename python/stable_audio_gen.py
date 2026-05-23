#!/usr/bin/env python3
"""
Stable Audio 3 local SFX generation wrapper for Roflow.

Setup (one-time):
  Option A — recommended (CPU-friendly SFX, no GPU):
    git clone https://github.com/Stability-AI/stable-audio-3.git
    cd stable-audio-3
    uv sync
    # Activate that env, or install into the Python Roflow uses:
    uv pip install -e .

  Option B — pip install from GitHub (same Python as `python` on PATH):
    pip install git+https://github.com/Stability-AI/stable-audio-3.git

  Models download from Hugging Face on first run (~433M for small-sfx).
  Accept the Stability AI Community License on Hugging Face if prompted.

  Models:
    small-sfx   — SFX-only, CPU, up to 120s (recommended for Roflow)
    small-music — music-only, CPU
    medium      — highest quality, requires CUDA GPU + flash-attn

Usage:
  python stable_audio_gen.py --prompt "metal sword clang" --duration 5 --output out.wav
  python stable_audio_gen.py --mode check
"""

import argparse
import json
import os
import sys


def progress(step, pct):
    print(json.dumps({"type": "progress", "step": step, "pct": pct}), flush=True)


def emit_result(data):
    print(json.dumps({"type": "result", **data}), flush=True)


def save_waveform(output_path, audio, sample_rate):
    import torch
    import torchaudio

    waveform = audio
    if isinstance(waveform, (list, tuple)):
        waveform = waveform[0] if len(waveform) == 1 else waveform

    if not isinstance(waveform, torch.Tensor):
        waveform = torch.as_tensor(waveform)

    if waveform.dim() == 3:
        waveform = waveform[0]
    if waveform.dim() == 1:
        waveform = waveform.unsqueeze(0)

    waveform = waveform.detach().cpu().float()
    peak = torch.max(torch.abs(waveform))
    if peak > 0:
        waveform = waveform / peak

    torchaudio.save(output_path, waveform, int(sample_rate))


def run(args):
    if args.mode == "check":
        try:
            progress("Checking Stable Audio 3 import…", 15)
            from stable_audio_3 import StableAudioModel  # noqa: F401

            emit_result({"success": True, "message": "stable_audio_3 is installed."})
        except ImportError:
            emit_result(
                {
                    "success": False,
                    "error": (
                        "stable_audio_3 is not installed. "
                        "Clone https://github.com/Stability-AI/stable-audio-3, run `uv sync`, "
                        "then install into this Python env (see python/stable_audio_gen.py header)."
                    ),
                }
            )
        except Exception as exc:
            emit_result({"success": False, "error": str(exc)})
        return

    if not args.prompt:
        emit_result({"success": False, "error": "--prompt is required for generation."})
        return

    try:
        from stable_audio_3 import StableAudioModel
    except ImportError:
        emit_result(
            {
                "success": False,
                "error": (
                    "stable_audio_3 not installed. "
                    "Run: pip install git+https://github.com/Stability-AI/stable-audio-3.git "
                    "or clone the repo and `uv sync` (see python/stable_audio_gen.py)."
                ),
            }
        )
        return

    model_id = args.model or "small-sfx"
    duration = float(args.duration or 5.0)
    output_path = os.path.abspath(args.output)
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    try:
        progress(f"Loading Stable Audio 3 ({model_id})…", 10)
        model = StableAudioModel.from_pretrained(model_id)

        gen_kwargs = {
            "prompt": args.prompt,
            "duration": duration,
        }
        if args.negative_prompt:
            gen_kwargs["negative_prompt"] = args.negative_prompt
        if args.steps is not None:
            gen_kwargs["steps"] = int(args.steps)
        if args.seed is not None and int(args.seed) >= 0:
            gen_kwargs["seed"] = int(args.seed)

        progress("Generating audio locally…", 35)
        audio = model.generate(**gen_kwargs)

        progress("Saving WAV output…", 90)
        sample_rate = getattr(model, "sample_rate", 44100)
        save_waveform(output_path, audio, sample_rate)

        progress("Audio ready!", 100)
        emit_result(
            {
                "success": True,
                "outputPath": output_path,
                "provider": "stable-audio-3",
                "model": model_id,
            }
        )
    except Exception as exc:
        message = str(exc)
        if "flash" in message.lower() or "cuda" in message.lower():
            message = (
                f"{message} — For CPU-only SFX, use --model small-sfx. "
                "The medium model requires CUDA and flash-attn."
            )
        emit_result({"success": False, "error": message})


def main():
    parser = argparse.ArgumentParser(description="Stable Audio 3 local SFX wrapper")
    parser.add_argument("--mode", default="generate", choices=["generate", "check"])
    parser.add_argument("--prompt", default="")
    parser.add_argument("--negative-prompt", default="", dest="negative_prompt")
    parser.add_argument("--output", default="output.wav")
    parser.add_argument(
        "--model",
        default="small-sfx",
        help="Model id: small-sfx (CPU), small-music, medium (CUDA)",
    )
    parser.add_argument("--duration", type=float, default=5.0)
    parser.add_argument("--steps", type=int, default=None)
    parser.add_argument("--seed", type=int, default=-1)
    args = parser.parse_args()
    run(args)


if __name__ == "__main__":
    main()
