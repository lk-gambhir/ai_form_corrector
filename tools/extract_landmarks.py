#!/usr/bin/env python3
"""Extract MediaPipe Pose landmarks from a video into a JSON fixture.

Reads a video frame-by-frame with OpenCV, runs it through MediaPipe's
legacy `mp.solutions.pose` Pose Landmarker (33 landmarks per frame, each
with normalized x/y in [0, 1], relative depth z, and a visibility score),
and writes out one JSON document describing the whole clip.

Usage:
    python tools/extract_landmarks.py <input_video> <output_json> \
        [--source URL] [--license LICENSE] [--fps TARGET_FPS]

If a frame yields no detected pose, it is still emitted with an empty
`landmarks: []` list so that detection dropout is representable in the
fixture (rather than silently shortening the frame sequence).

Output schema:
{
  "source": "<url>",
  "license": "<license>",
  "fps": <number>,
  "width": <px>,
  "height": <px>,
  "frames": [
    {
      "t": <ms>,
      "landmarks": [ {"x":0-1, "y":0-1, "z":<float>, "visibility":0-1}, ... 33 items ... ]
    },
    ...
  ]
}
"""
import argparse
import json
import sys

import cv2
import mediapipe as mp


def extract(input_path, output_path, source, license_str, target_fps=None):
    cap = cv2.VideoCapture(input_path)
    if not cap.isOpened():
        print(f"ERROR: could not open video {input_path}", file=sys.stderr)
        sys.exit(1)

    native_fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    # Optionally downsample by skipping frames, to keep large fixtures small.
    if target_fps and target_fps < native_fps:
        frame_stride = max(1, round(native_fps / target_fps))
        effective_fps = native_fps / frame_stride
    else:
        frame_stride = 1
        effective_fps = native_fps

    mp_pose = mp.solutions.pose
    frames_out = []

    with mp_pose.Pose(
        static_image_mode=False,
        model_complexity=1,
        enable_segmentation=False,
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5,
    ) as pose:
        frame_index = 0
        kept_index = 0
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            if frame_index % frame_stride != 0:
                frame_index += 1
                continue

            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            result = pose.process(rgb)

            t_ms = (kept_index / effective_fps) * 1000.0

            if result.pose_landmarks:
                landmarks = [
                    {
                        "x": lm.x,
                        "y": lm.y,
                        "z": lm.z,
                        "visibility": lm.visibility,
                    }
                    for lm in result.pose_landmarks.landmark
                ]
            else:
                landmarks = []

            frames_out.append({"t": t_ms, "landmarks": landmarks})

            frame_index += 1
            kept_index += 1

    cap.release()

    doc = {
        "source": source,
        "license": license_str,
        "fps": effective_fps,
        "width": width,
        "height": height,
        "frames": frames_out,
    }

    with open(output_path, "w") as f:
        json.dump(doc, f)

    detected = sum(1 for fr in frames_out if fr["landmarks"])
    print(
        f"Wrote {output_path}: {len(frames_out)} frames "
        f"({detected} with a detected pose, {len(frames_out) - detected} dropped), "
        f"fps={effective_fps:.3f}, size={width}x{height}"
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input_video")
    parser.add_argument("output_json")
    parser.add_argument("--source", default="", help="Source URL of the video")
    parser.add_argument("--license", default="", help="License string, e.g. 'CC BY 3.0'")
    parser.add_argument(
        "--fps",
        type=float,
        default=None,
        help="Downsample to this target fps (omit to keep native fps)",
    )
    args = parser.parse_args()

    extract(args.input_video, args.output_json, args.source, args.license, args.fps)
