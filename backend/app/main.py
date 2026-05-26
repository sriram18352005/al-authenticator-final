from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from app.api.endpoints import auth
from app.api.deps import get_current_user
from app.db import engine, get_db
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings
from contextlib import asynccontextmanager
from app.models.base import Base
# Import models to ensure they are registered with Base
from app.models.document import Document
from app.models.audit import AuditLog
from app.models.user import User

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Tables are manually created via init_db_sync.py
    # STARTUP CLEANUP: Reset any documents stuck in 'PROCESSING' or 'PENDING' 
    # This prevents the UI from spinning indefinitely if the server crashed/reloaded
    try:
        from sqlalchemy import text
        async with engine.begin() as conn:
            print("DB: Running startup maintenance...")
            # Set any stuck documents to FAILED so they don't block the UI
            await conn.execute(text(
                "UPDATE document SET status = 'FAILED' WHERE status IN ('PROCESSING', 'PENDING')"
            ))
            print("DB: Cleanup complete. All previous stuck tasks reset.")
    except Exception as e:
        print(f"DB Error during startup cleanup: {e}")
    yield

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Institutional-grade document verification and forensic analysis platform.",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix=f"{settings.API_V1_STR}/auth", tags=["auth"])


from app.api.endpoints import analytics
app.include_router(analytics.router, prefix=f"{settings.API_V1_STR}/analytics", tags=["analytics"])

from app.api.endpoints import audit
app.include_router(audit.router, prefix=f"{settings.API_V1_STR}/audit", tags=["audit"])

from app.api.endpoints import debug
app.include_router(debug.router, prefix=f"{settings.API_V1_STR}", tags=["debug"])

from app.api.endpoints import vehicle
app.include_router(vehicle.router, prefix=f"{settings.API_V1_STR}/vehicle", tags=["vehicle"])

from app.api.endpoints import tickets
app.include_router(tickets.router, prefix=f"{settings.API_V1_STR}/tickets", tags=["tickets"])

# Explicit alias for dashboard metrics
@app.get("/api/dashboard/metrics")
async def dashboard_metrics_alias(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from app.api.endpoints.analytics import get_dashboard_metrics
    return await get_dashboard_metrics(db, current_user)

from fastapi.staticfiles import StaticFiles
from pathlib import Path
import os

from app.core.config import AL_DATA_DIR

UPLOAD_DIR = AL_DATA_DIR / "storage_forensics"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

app.mount("/static/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

@app.get("/")
async def root():
    return {"message": "AL Authenticator API is online", "status": "healthy"}

@app.get("/api/test-easyocr")
async def test_easyocr():
    try:
        import easyocr
        # Initialize reader just to test
        reader = easyocr.Reader(['en'], gpu=False)
        return {
            "status": "EasyOCR working",
            "available": True
        }
    except Exception as e:
        return {
            "status": f"EasyOCR failed: {str(e)}",
            "available": False
        }

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
