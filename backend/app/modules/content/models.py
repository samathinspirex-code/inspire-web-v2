"""Website content managed from /admin. Shapes follow the new design's data."""
from sqlalchemy import Boolean, Integer, String, Text, true
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.types import JsonType, UTCDateTime, utcnow


class SiteSetting(Base):
    __tablename__ = "site_settings"
    key: Mapped[str] = mapped_column(String(80), primary_key=True)
    value = mapped_column(JsonType, nullable=True)
    updated_at = mapped_column(UTCDateTime, default=utcnow, onupdate=utcnow)


class Course(Base):
    __tablename__ = "courses"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    key: Mapped[str] = mapped_column(String(120), unique=True, index=True)   # design key, e.g. hnd-se
    slug: Mapped[str] = mapped_column(String(200), unique=True, index=True)  # URL /programs/<slug> (same as current site)
    title: Mapped[str] = mapped_column(String(300))
    short: Mapped[str] = mapped_column(String(160), default="")
    level: Mapped[str] = mapped_column(String(40), default="Short course")   # HND | Foundation | Top-Up | Postgraduate | Short course
    school: Mapped[str] = mapped_column(String(80), default="")
    body: Mapped[str] = mapped_column(String(120), default="")               # awarding body label
    plan_type: Mapped[str] = mapped_column(String(10), default="cpd")        # hnd | fnd | pg | cpd (fee plans in design)
    duration: Mapped[str] = mapped_column(String(60), default="")
    fee: Mapped[int] = mapped_column(Integer, default=0)                     # LKR
    fee_label: Mapped[str] = mapped_column(String(80), default="")           # "from LKR 280,000"
    monthly_label: Mapped[str] = mapped_column(String(120), default="")
    cpd_addon_fee: Mapped[int | None] = mapped_column(Integer, nullable=True)  # CPD add-on price in the enrol drawer
    image: Mapped[str] = mapped_column(String(500), default="")
    blurb: Mapped[str] = mapped_column(Text, default="")
    keywords: Mapped[str] = mapped_column(Text, default="")
    card_type: Mapped[str] = mapped_column(String(60), default="")           # label on home card, e.g. "HND · AI"
    featured: Mapped[bool] = mapped_column(Boolean, default=False)           # shown on home programme grid
    sort_order: Mapped[int] = mapped_column(Integer, default=100)
    status: Mapped[str] = mapped_column(String(20), default="published")     # published | draft
    # Monthly plans on this course get their instalment invoices + links created and emailed automatically.
    auto_instalments: Mapped[bool] = mapped_column(Boolean, default=True, server_default=true())
    detail = mapped_column(JsonType, default=dict)                           # Program page fields (overview, years, skills...)
    source = mapped_column(JsonType, default=dict)                           # copy of the current site's record
    seo_title: Mapped[str] = mapped_column(String(200), default="")
    seo_description: Mapped[str] = mapped_column(String(400), default="")
    updated_at = mapped_column(UTCDateTime, default=utcnow, onupdate=utcnow)


class Testimonial(Base):
    __tablename__ = "testimonials"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(160))
    role: Mapped[str] = mapped_column(String(160), default="")
    image: Mapped[str] = mapped_column(String(500), default="")
    image_pos: Mapped[str] = mapped_column(String(20), default="50%")
    video_url: Mapped[str] = mapped_column(String(500), default="")
    caption: Mapped[str] = mapped_column(Text, default="")
    sort_order: Mapped[int] = mapped_column(Integer, default=100)
    status: Mapped[str] = mapped_column(String(20), default="published")


class Leader(Base):
    __tablename__ = "leaders"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(160))
    role: Mapped[str] = mapped_column(String(160), default="")
    initials: Mapped[str] = mapped_column(String(6), default="")
    photo: Mapped[str] = mapped_column(String(500), default="", server_default="")
    photo_pos: Mapped[str] = mapped_column(String(40), default="center 20%", server_default="center 20%")
    bio: Mapped[str] = mapped_column(Text, default="", server_default="")
    sort_order: Mapped[int] = mapped_column(Integer, default=100)
    status: Mapped[str] = mapped_column(String(20), default="published")


class Faq(Base):
    __tablename__ = "faqs"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    audience: Mapped[str] = mapped_column(String(20), default="student")   # student | parent
    question: Mapped[str] = mapped_column(Text)
    answer: Mapped[str] = mapped_column(Text)
    sort_order: Mapped[int] = mapped_column(Integer, default=100)
    status: Mapped[str] = mapped_column(String(20), default="published")


class Campaign(Base):
    __tablename__ = "campaigns"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    key: Mapped[str] = mapped_column(String(40), unique=True)              # scholarship | intake | referral | coffee
    tag: Mapped[str] = mapped_column(String(80), default="")
    text: Mapped[str] = mapped_column(Text, default="")
    short: Mapped[str] = mapped_column(String(200), default="")
    perk: Mapped[str] = mapped_column(String(200), default="")
    sort_order: Mapped[int] = mapped_column(Integer, default=100)
    status: Mapped[str] = mapped_column(String(20), default="published")


class News(Base):
    __tablename__ = "news"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    slug: Mapped[str] = mapped_column(String(220), unique=True, index=True)
    title: Mapped[str] = mapped_column(String(300))
    excerpt: Mapped[str] = mapped_column(Text, default="")
    body: Mapped[str] = mapped_column(Text, default="")
    category: Mapped[str] = mapped_column(String(60), default="News")
    image: Mapped[str] = mapped_column(String(500), default="")
    video_url: Mapped[str] = mapped_column(String(500), default="")
    published_at = mapped_column(UTCDateTime, default=utcnow)
    sort_order: Mapped[int] = mapped_column(Integer, default=100)
    status: Mapped[str] = mapped_column(String(20), default="published")
    source = mapped_column(JsonType, default=dict)


class Redirect(Base):
    __tablename__ = "redirects"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    source: Mapped[str] = mapped_column(String(500), unique=True, index=True)
    destination: Mapped[str] = mapped_column(String(500), default="")
    permanent: Mapped[bool] = mapped_column(Boolean, default=True)
    gone: Mapped[bool] = mapped_column(Boolean, default=False)   # answer 410 instead of redirecting
    note: Mapped[str] = mapped_column(String(200), default="")


class Media(Base):
    __tablename__ = "media"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    filename: Mapped[str] = mapped_column(String(300))
    url: Mapped[str] = mapped_column(String(500))
    content_type: Mapped[str] = mapped_column(String(100), default="")
    size: Mapped[int] = mapped_column(Integer, default=0)
    created_at = mapped_column(UTCDateTime, default=utcnow)
