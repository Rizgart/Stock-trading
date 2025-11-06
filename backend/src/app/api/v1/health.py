from fastapi import APIRouter
from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: str
    version: str


router = APIRouter()


@router.get("/", response_model=HealthResponse, summary="Health check")
async def health() -> HealthResponse:
    return HealthResponse(status="ok", version="0.1.0")
