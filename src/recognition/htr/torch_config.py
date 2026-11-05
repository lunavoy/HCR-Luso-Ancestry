"""Configuração comum de desempenho para operações PyTorch."""
from __future__ import annotations


def configure_torch() -> None:
    """Permite matmul FP32 mais rápido em hardware compatível."""
    import torch

    torch.set_float32_matmul_precision("high")
