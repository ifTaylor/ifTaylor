from fastapi import APIRouter

from app.config import ALLOWED_ORIGINS


router = APIRouter()


@router.get("/health")
def health():
    return {"ok": True}


@router.get("/debug/cors")
def debug_cors():
    return {
        "allowedOrigins": [origin.strip() for origin in ALLOWED_ORIGINS],
    }
