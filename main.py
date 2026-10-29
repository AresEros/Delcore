from fastapi import FastAPI

app = FastAPI(
    title="HotelOS AI",
    version="1.0.0",
    description="Enterprise Hotel Management Platform"
)

@app.get("/")
async def root():
    return {
        "message": "Welcome to HotelOS AI"
    }

@app.get("/health")
async def health():
    return {
        "status": "healthy"
    }