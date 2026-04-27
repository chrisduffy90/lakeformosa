import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, field_validator
from supabase import create_client, Client
from typing import Optional, List
import re

EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_KEY"]

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

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

# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {"ok": True}

@app.get("/")
def root():
    return {"message": "Lake Formosa Neighborhood Association API"}

# ── Models ────────────────────────────────────────────────────────────────────
class SignupRequest(BaseModel):
    first_name: str
    last_name: str = ""
    email: str

    @field_validator("first_name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("First name cannot be empty")
        return v

    @field_validator("email")
    @classmethod
    def valid_email(cls, v: str) -> str:
        v = v.strip().lower()
        if not EMAIL_RE.match(v):
            raise ValueError("Invalid email address")
        return v

class GetInvolvedRequest(BaseModel):
    first_name: str
    last_name: str = ""
    email: str
    address: str = ""
    interests: List[str] = []

    @field_validator("first_name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("First name cannot be empty")
        return v

    @field_validator("email")
    @classmethod
    def valid_email(cls, v: str) -> str:
        v = v.strip().lower()
        if not EMAIL_RE.match(v):
            raise ValueError("Invalid email address")
        return v

class ContactRequest(BaseModel):
    name: str
    email: str
    subject: str = "General"
    message: str

    @field_validator("name", "message")
    @classmethod
    def not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Field cannot be empty")
        return v

    @field_validator("email")
    @classmethod
    def valid_email(cls, v: str) -> str:
        v = v.strip().lower()
        if not EMAIL_RE.match(v):
            raise ValueError("Invalid email address")
        return v

# ── Endpoints ─────────────────────────────────────────────────────────────────
@app.post("/signup")
def create_signup(data: SignupRequest):
    try:
        result = supabase.table("signups").insert({
            "first_name": data.first_name.strip(),
            "last_name":  data.last_name.strip(),
            "email":      data.email.lower(),
        }).execute()
        return {"ok": True, "data": result.data}
    except Exception as e:
        msg = str(e)
        if "duplicate" in msg.lower() or "unique" in msg.lower():
            raise HTTPException(status_code=409, detail="This email is already signed up")
        raise HTTPException(status_code=500, detail="Something went wrong")

@app.post("/get-involved")
def create_get_involved(data: GetInvolvedRequest):
    try:
        result = supabase.table("get_involved").insert({
            "first_name": data.first_name.strip(),
            "last_name":  data.last_name.strip(),
            "email":      data.email.lower(),
            "address":    data.address.strip(),
            "interests":  data.interests,
        }).execute()
        return {"ok": True, "data": result.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Something went wrong")

@app.post("/contact")
def create_contact(data: ContactRequest):
    try:
        result = supabase.table("contact_messages").insert({
            "name":    data.name.strip(),
            "email":   data.email.lower(),
            "subject": data.subject.strip(),
            "message": data.message.strip(),
        }).execute()
        return {"ok": True, "data": result.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Something went wrong")

# ── Read endpoints ────────────────────────────────────────────────────────────
@app.get("/signups")
def get_signups():
    result = supabase.table("signups").select("*").order("created_at", desc=True).execute()
    return result.data

@app.get("/get-involved")
def get_involved():
    result = supabase.table("get_involved").select("*").order("created_at", desc=True).execute()
    return result.data

@app.get("/contact")
def get_contacts():
    result = supabase.table("contact_messages").select("*").order("created_at", desc=True).execute()
    return result.data
