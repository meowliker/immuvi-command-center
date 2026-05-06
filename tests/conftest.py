"""Pytest config for strategist tests.

Adds project root to sys.path so we can import `tools.strategist.*`
modules without installing as a package.
"""
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))
