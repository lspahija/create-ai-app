"""AI agent adapters."""

from app.adapters.base import AgentResult, BaseAdapter
from app.adapters.factory import get_adapter

__all__ = ["AgentResult", "BaseAdapter", "get_adapter"]
