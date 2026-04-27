from sqlmodel import Field, SQLModel
from pydantic import EmailStr, field_validator
from typing import Optional, List
from datetime import datetime


class SignupBase(SQLModel):
    first_name: str
    last_name: str
    email: EmailStr

    @field_validator('first_name')
    @classmethod
    def first_name_must_not_be_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError('First name cannot be empty')
        return v

class Signup(SignupBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class GetInvolvedBase(SQLModel):
    first_name: str
    last_name: str
    email: EmailStr
    address: Optional[str] = None
    interests: Optional[str] = None   # stored as comma-joined string

    @field_validator('first_name')
    @classmethod
    def first_name_must_not_be_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError('First name cannot be empty')
        return v

class GetInvolved(GetInvolvedBase, table=True):
    __tablename__ = 'get_involved'
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class ContactBase(SQLModel):
    name: str
    email: EmailStr
    subject: Optional[str] = 'General'
    message: str

    @field_validator('name')
    @classmethod
    def name_must_not_be_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError('Name cannot be empty')
        return v

class ContactMessage(ContactBase, table=True):
    __tablename__ = 'contact_messages'
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
