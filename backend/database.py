import os
from sqlmodel import create_engine, SQLModel

DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///lakeformosa.db")

print(f"DATABASE_URL starts with: {DATABASE_URL[:20]}")

engine = create_engine(DATABASE_URL, echo=True)

def create_db():
    SQLModel.metadata.create_all(engine)
