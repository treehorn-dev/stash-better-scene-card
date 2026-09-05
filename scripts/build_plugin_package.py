#!/usr/bin/env python3
"""Build the Stash remote-package ZIP and its corresponding package index."""

from __future__ import annotations

import argparse
import hashlib
import re
from datetime import datetime, timezone
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile


REPOSITORY = "https://github.com/treehorn-dev/stash-better-scene-card"
PLUGIN_ROOT = Path("plugin/stashBetterSceneCard")
TUTORIAL = Path("docs/chip-slots-tutorial.md")


def archive_members() -> list[Path]:
    plugin_members = [member for member in sorted(PLUGIN_ROOT.rglob("*")) if member.is_file()]
    return [*plugin_members, TUTORIAL]


def build(version: str, output_dir: Path, released_at: datetime) -> tuple[Path, Path]:
    output_dir.mkdir(parents=True, exist_ok=True)
    archive_name = f"stashBetterSceneCard-{version}.zip"
    archive_path = output_dir / archive_name

    with ZipFile(archive_path, "w", compression=ZIP_DEFLATED) as archive:
        for member in archive_members():
            member_name = (
                member.relative_to(PLUGIN_ROOT)
                if member.is_relative_to(PLUGIN_ROOT)
                else member
            )
            if member == PLUGIN_ROOT / "stashBetterSceneCard.yml":
                manifest = member.read_text()
                manifest = re.sub(
                    r'^version: ".*"$',
                    f'version: "{version}"',
                    manifest,
                    count=1,
                    flags=re.MULTILINE,
                )
                archive.writestr(str(member_name), manifest)
            else:
                archive.write(member, member_name)

    checksum = hashlib.sha256(archive_path.read_bytes()).hexdigest()
    release_tag = f"v{version}"
    index_path = output_dir / "index.yml"
    index_path.write_text(
        "\n".join(
            [
                "- id: stashBetterSceneCard",
                "  name: Better Scene Card",
                f'  version: "{version}"',
                f'  date: "{released_at.strftime("%Y-%m-%d %H:%M:%S")}"',
                f"  path: {REPOSITORY}/releases/download/{release_tag}/{archive_name}",
                f"  sha256: {checksum}",
                "  metadata:",
                "    description: Configurable visual rules and overlays for native Stash scene cards.",
                "    authors:",
                "      - Treehorn Dev",
                "",
            ]
        )
    )
    return archive_path, index_path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--version", required=True)
    parser.add_argument("--output-dir", type=Path, default=Path("dist"))
    args = parser.parse_args()
    build(args.version, args.output_dir, datetime.now(timezone.utc))


if __name__ == "__main__":
    main()
