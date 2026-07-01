import os
from pathlib import Path

from dotenv import load_dotenv


load_dotenv(Path(__file__).parents[1] / ".env")

DATABASE_URL = os.environ["DATABASE_URL"]
ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:4200,http://localhost:4201,http://127.0.0.1:4200,http://127.0.0.1:4201",
).split(",")
