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


async def test_reset_password_existing_and_missing(client):
    r = await client.post("/api/v1/demo/signup", json={"name": "Reset Person", "email": "reset-me@example.com", "phone": "0771234567", "password": "oldpass1"})
    assert r.status_code == 200
    # existing account: new password works, old one doesn't
    r = await client.post("/api/v1/demo/reset-password", json={"email": "Reset-Me@example.com", "password": "newpass2"})
    assert r.status_code == 200 and r.json()["token"]
    assert (await client.post("/api/v1/demo/login", json={"email": "reset-me@example.com", "password": "newpass2"})).status_code == 200
    assert (await client.post("/api/v1/demo/login", json={"email": "reset-me@example.com", "password": "oldpass1"})).status_code == 401
    # no such account: 404 telling them to register; short password: 422
    r = await client.post("/api/v1/demo/reset-password", json={"email": "nobody-here@example.com", "password": "whatever1"})
    assert r.status_code == 404 and "Create a free account" in r.json()["detail"]
    assert (await client.post("/api/v1/demo/reset-password", json={"email": "reset-me@example.com", "password": "123"})).status_code == 422


async def test_cms_demo_class_shows_in_demo_lms(client):
    from app.core.security import make_token
    from app.modules.admin_auth.models import AdminUser
    async with SessionLocal() as db:
        admin = AdminUser(email="classes-admin@example.com", full_name="Admin", password_hash="x")
        db.add(admin)
        await db.commit()
        h = {"Authorization": "Bearer " + make_token(str(admin.id), "admin", timedelta(hours=1))}
    r = await client.post("/api/v1/admin/content/demo_classes", headers=h, json={
        "code": "B_L3_M5", "title": "Market Research", "awarding_body": "ATHE (UK)", "school": "School of Business",
        "programme": "Foundation · Business", "intake": "September", "study_mode": "Full Time",
        "start_date": "2026-09-01T00:00:00Z", "end_date": "2026-11-01T00:00:00Z", "lecturers": "Leandra Joseph, A N Other",
        "status": "Active", "published": "published"})
    assert r.status_code == 200, r.text
    s = await client.post("/api/v1/demo/signup", json={"name": "Class Viewer", "email": "class-viewer@example.com", "phone": "0771234567", "password": "secret1"})
    me = (await client.get("/api/v1/demo/me", headers={"Authorization": "Bearer " + s.json()["token"]})).json()
    c = [x for x in me["classes"] if x["code"] == "B_L3_M5"][0]
    assert c["start_date"] == "2026-09-01" and c["lecturers"] == ["Leandra Joseph", "A N Other"] and c["study_mode"] == "Full Time"


async def test_class_studio_sections_items_and_student_view(client):
    from app.core.security import make_token
    from app.modules.admin_auth.models import AdminUser
    async with SessionLocal() as db:
        admin = AdminUser(email="studio-admin@example.com", full_name="Admin", password_hash="x")
        db.add(admin)
        await db.commit()
        h = {"Authorization": "Bearer " + make_token(str(admin.id), "admin", timedelta(hours=1))}
    cid = (await client.post("/api/v1/admin/content/demo_classes", headers=h, json={"code": "C_L4_U1", "title": "Programming", "published": "published"})).json()["id"]
    s1 = (await client.post(f"/api/v1/admin/demo-classes/{cid}/sections", headers=h, json={"title": "Week 1 · Introduction"})).json()
    s2 = (await client.post(f"/api/v1/admin/demo-classes/{cid}/sections", headers=h, json={"title": "Week 2 · Draft", "status": "draft"})).json()
    v = (await client.post(f"/api/v1/admin/demo-classes/sections/{s1['id']}/items", headers=h, json={"item_type": "video", "title": "Welcome", "resource_url": "https://vimeo.com/123"})).json()
    t = (await client.post(f"/api/v1/admin/demo-classes/sections/{s1['id']}/items", headers=h, json={"item_type": "text", "title": "Read me", "text_content": "Hello"})).json()
    await client.post(f"/api/v1/admin/demo-classes/sections/{s1['id']}/items", headers=h, json={"item_type": "pdf", "title": "Hidden", "status": "draft"})
    assert (await client.post(f"/api/v1/admin/demo-classes/sections/{s1['id']}/items", headers=h, json={"item_type": "nope", "title": "x"})).status_code == 422
    await client.put(f"/api/v1/admin/demo-classes/sections/{s1['id']}/items/reorder", headers=h, json={"ids": [t["id"], v["id"]]})
    tree = (await client.get(f"/api/v1/admin/demo-classes/{cid}/studio", headers=h)).json()["sections"]
    assert [x["title"] for x in tree] == ["Week 1 · Introduction", "Week 2 · Draft"] and [i["title"] for i in tree[0]["items"]][:2] == ["Read me", "Welcome"]
    # students only see active sections and published items
    s = await client.post("/api/v1/demo/signup", json={"name": "Studio Viewer", "email": "studio-viewer@example.com", "phone": "0771234567", "password": "secret1"})
    me = (await client.get("/api/v1/demo/me", headers={"Authorization": "Bearer " + s.json()["token"]})).json()
    c = [x for x in me["classes"] if x["id"] == cid][0]
    assert [x["title"] for x in c["sections"]] == ["Week 1 · Introduction"] and [i["title"] for i in c["sections"][0]["items"]] == ["Read me", "Welcome"]
    assert (await client.delete(f"/api/v1/admin/demo-classes/sections/{s2['id']}", headers=h)).status_code == 200
    assert (await client.get(f"/api/v1/admin/demo-classes/{cid}/studio")).status_code == 401
