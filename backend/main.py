from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select
from models import (
    Signup, SignupBase,
    GetInvolved, GetInvolvedBase,
    ContactMessage, ContactBase,
)
from database import create_db, engine

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://lakeformosa.org",
        "https://www.lakeformosa.org",
        "http://localhost:4322",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def on_startup():
    create_db()

# Health check — pinged by cron job to keep Render warm
@app.get("/health")
def health():
    return {"ok": True}

@app.get("/")
def read_root():
    return {"message": "Lake Formosa Neighborhood Association API"}

# ── Event reminder signup ────────────────────────────────────────────────────
@app.post("/signup")
def create_signup(data: SignupBase):
    signup = Signup.model_validate(data.model_dump())
    with Session(engine) as session:
        session.add(signup)
        session.commit()
        session.refresh(signup)
        return signup

# ── Get involved ─────────────────────────────────────────────────────────────
@app.post("/get-involved")
def create_get_involved(data: GetInvolvedBase):
    record = GetInvolved.model_validate(data.model_dump())
    with Session(engine) as session:
        session.add(record)
        session.commit()
        session.refresh(record)
        return record

# ── Contact form ──────────────────────────────────────────────────────────────
@app.post("/contact")
def create_contact(data: ContactBase):
    message = ContactMessage.model_validate(data.model_dump())
    with Session(engine) as session:
        session.add(message)
        session.commit()
        session.refresh(message)
        return message

# ── Read endpoints (for board to view submissions) ───────────────────────────
@app.get("/signups")
def get_signups():
    with Session(engine) as session:
        return session.exec(select(Signup)).all()

@app.get("/get-involved")
def get_involved():
    with Session(engine) as session:
        return session.exec(select(GetInvolved)).all()

@app.get("/contact")
def get_contacts():
    with Session(engine) as session:
        return session.exec(select(ContactMessage)).all()
