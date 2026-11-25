from datetime import timedelta

import pytest

from app.core.database import SessionLocal
from app.core.types import utcnow
from app.modules.demo.models import DemoEvent, DemoUser
from app.modules.demo.service import purge_expired


@pytest.mark.asyncio
async def test_signup_login_state_and_purge(client):
    body = {"name": "Kasun <b>Silva</b>", "email": "Kasun.Demo@Example.com", "phone": "0771234567", "password": "secret12"}
    r = await client.post("/api/v1/demo/signup", json=body)
    assert r.status_code == 200, r.text
    token = r.json()["token"]
    assert r.json()["user"]["name"] == "Kasun bSilvab"  # markup stripped from the name

    assert (await client.post("/api/v1/demo/signup", json=body)).status_code == 409  # one account per email
    assert (await client.post("/api/v1/demo/login", json={"email": "kasun.demo@example.com", "password": "wrong"})).status_code == 401
    assert (await client.post("/api/v1/demo/login", json={"email": "kasun.demo@example.com", "password": "secret12"})).status_code == 200

    h = {"Authorization": "Bearer " + token}
    me = (await client.get("/api/v1/demo/me", headers=h)).json()
    assert me["state"] is None  # first visit: the portal fills in the sample data
    seed = {"ledger": [{"d": "2026-10-01", "t": "Opening balance", "p": 1705}]}
    assert (await client.put("/api/v1/demo/state", json={"state": seed}, headers=h)).json()["events"] == 0
    more = {"ledger": seed["ledger"] + [{"d": "2026-11-25", "t": "Daily drop · +50 points", "p": 50}]}
    assert (await client.put("/api/v1/demo/state", json={"state": more}, headers=h)).json()["events"] == 1
    feed = (await client.get("/api/v1/live/feed")).json()
    assert feed["events"][0]["who"] == "Kasun b." and feed["events"][0]["points"] == 50

    # expire it and purge: the account and its data are gone, and the token stops working
    async with SessionLocal() as db:
        u = (await db.execute(DemoUser.__table__.select().where(DemoUser.email == "kasun.demo@example.com"))).first()
        user = await db.get(DemoUser, u.id)
        user.expires_at = utcnow() - timedelta(minutes=1)
        await db.commit()
        assert await purge_expired(db) == 1
        assert await db.get(DemoUser, u.id) is None
        left = (await db.execute(DemoEvent.__table__.select().where(DemoEvent.user_id == u.id))).all()
        assert left == []
    assert (await client.get("/api/v1/demo/me", headers=h)).status_code == 401
