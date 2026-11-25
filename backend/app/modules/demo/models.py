"""Free-demo accounts. Each one lives for DEMO_TTL_HOURS and is then purged with all its data."""
from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.types import JsonType, UTCDateTime, utcnow


class DemoUser(Base):
    __tablename__ = "demo_users"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)   # uuid4
    email: Mapped[str] = mapped_column(String(200), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(120))
    phone: Mapped[str] = mapped_column(String(40), default="")
    interest: Mapped[str] = mapped_column(String(80), default="")
    password_hash: Mapped[str] = mapped_column(String(200))
    created_at = mapped_column(UTCDateTime, default=utcnow)
    expires_at = mapped_column(UTCDateTime, index=True)
    last_seen_at = mapped_column(UTCDateTime, nullable=True)


class DemoState(Base):
    """The student-portal state from the OS design (classes, tasks, points ledger, cart...)."""

    __tablename__ = "demo_states"
    user_id: Mapped[str] = mapped_column(ForeignKey("demo_users.id", ondelete="CASCADE"), primary_key=True)
    state = mapped_column(JsonType, nullable=True)
    updated_at = mapped_column(UTCDateTime, default=utcnow, onupdate=utcnow)


class DemoEvent(Base):
    """Points/XP a demo student earned. Feeds the Live Campus activity stream."""

    __tablename__ = "demo_events"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("demo_users.id", ondelete="CASCADE"), index=True)
    label: Mapped[str] = mapped_column(String(200))
    points: Mapped[int] = mapped_column(Integer, default=0)
    created_at = mapped_column(UTCDateTime, default=utcnow, index=True)
