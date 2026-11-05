from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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
app.include_router(pages_router)
app.include_router(workspace_router)


@app.get("/health", tags=["system"])
def health() -> dict[str, str]:
    return {"status": "ok"}
