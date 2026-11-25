from sqlalchemy import Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.types import JsonType, UTCDateTime, utcnow


class Lead(Base):
    """Every form on the new site (enrol, contact, aptitude, demo sign-up). Stored only in the new DB."""

    __tablename__ = "leads"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    kind: Mapped[str] = mapped_column(String(30), index=True)   # enrol | contact | aptitude | demo | admissions
    name: Mapped[str] = mapped_column(String(200), default="")
    email: Mapped[str] = mapped_column(String(200), default="")
    phone: Mapped[str] = mapped_column(String(60), default="")
    course_key: Mapped[str] = mapped_column(String(120), default="")
    message: Mapped[str] = mapped_column(Text, default="")
    data = mapped_column(JsonType, default=dict)                # anything else, incl. UTM
    status: Mapped[str] = mapped_column(String(20), default="new")
    created_at = mapped_column(UTCDateTime, default=utcnow, index=True)
