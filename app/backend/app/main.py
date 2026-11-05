from fastapi import FastAPI

app = FastAPI(
    title="HTR Genealogia API",
    description="Backend Python para reconhecimento, segmentação e treinamento HTR.",
    version="0.1.0",
)


@app.get("/health", tags=["system"])
def health() -> dict[str, str]:
    return {"status": "ok"}
