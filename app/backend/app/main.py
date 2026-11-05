import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .api.pages import router as pages_router
from .api.workspace import router as workspace_router

app = FastAPI(
    title="HTR Genealogia API",
    description="Backend Python para reconhecimento, segmentação e treinamento HTR.",
    version="0.1.0",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)
logger = logging.getLogger(__name__)


@app.exception_handler(Exception)
async def unexpected_error(_request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Erro não tratado na API")
    return JSONResponse(status_code=500, content={"detail": f"{type(exc).__name__}: {exc}"})


app.include_router(pages_router)
app.include_router(workspace_router)


@app.get("/health", tags=["system"])
def health() -> dict[str, str]:
    return {"status": "ok"}
