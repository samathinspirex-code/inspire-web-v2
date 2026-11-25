"""Create or reset a website-CMS admin.  Usage: python scripts/create_admin.py email@example.com "Full Name"
The password is asked for at the prompt (never passed on the command line)."""
import asyncio
import getpass
import sys

import _bootstrap  # noqa: F401
from sqlalchemy import select

from app.core.database import SessionLocal, create_all
from app.core.security import hash_password
from app.modules.admin_auth.models import AdminUser


async def main(email: str, name: str, password: str) -> None:
    await create_all()
    async with SessionLocal() as db:
        user = (await db.execute(select(AdminUser).where(AdminUser.email == email))).scalar_one_or_none()
        if user:
            user.password_hash, user.is_active = hash_password(password), True
            print("Password reset for", email)
        else:
            db.add(AdminUser(email=email, full_name=name, password_hash=hash_password(password)))
            print("Created admin", email)
        await db.commit()


if __name__ == "__main__":
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    email = sys.argv[1].strip().lower()
    name = sys.argv[2] if len(sys.argv) > 2 else ""
    pw = getpass.getpass("New password (min 10 chars): ")
    if len(pw) < 10:
        raise SystemExit("Password too short")
    asyncio.run(main(email, name, pw))
