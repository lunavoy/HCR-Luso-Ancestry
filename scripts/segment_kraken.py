"""Executa a segmentação neural do Kraken e produz PAGE XML."""
from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path


def kraken_executable() -> str:
    """Localiza o CLI no ambiente ativo ou falha com instrução clara."""
    executable = shutil.which("kraken")
    if executable:
        return executable
    sibling = Path(sys.executable).with_name(
        "kraken.exe" if sys.platform == "win32" else "kraken"
    )
    if sibling.is_file():
        return str(sibling)
    raise RuntimeError(
        "Kraken não encontrado. Ative o .venv ou instale com "
        "'python -m pip install -r requirements.txt'."
    )


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Segmenta linhas manuscritas em PAGE XML."
    )
    parser.add_argument("image", type=Path, help="Imagem original da página.")
    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        help="PAGE XML de saída (padrão: data/pagexml/tinhela/<nome>.xml).",
    )
    parser.add_argument(
        "--device",
        default="cpu",
        help="Dispositivo do Kraken: cpu, cuda:0, cuda:1... (padrão: cpu).",
    )
    args = parser.parse_args()

    image = args.image.resolve()
    if not image.is_file():
        parser.error(f"Imagem não encontrada: {image}")

    output = args.output
    if output is None:
        output = Path("data") / "pagexml" / "tinhela" / f"{image.stem}.xml"
    output = output.resolve()
    output.parent.mkdir(parents=True, exist_ok=True)

    command = [
        kraken_executable(),
        "--device",
        args.device,
        "--pagexml",
        "--raise-on-error",
        "-i",
        str(image),
        str(output),
        "segment",
        "--baseline",
    ]
    completed = subprocess.run(command, check=False)
    if completed.returncode != 0:
        raise RuntimeError(
            f"Kraken terminou com código {completed.returncode}: "
            + " ".join(command)
        )
    if not output.is_file():
        raise RuntimeError(f"Kraken não produziu PAGE XML: {output}")
    print(f"PAGE XML criado: {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
