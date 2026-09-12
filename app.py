from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
import os
from dotenv import load_dotenv
import httpx
import json

load_dotenv()

APP = FastAPI()

APP.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"

SYSTEM_PROMPTS = {
    "general": "أنت مساعد ذكي ومفيد. اجب على الأسئلة بشكل واضح وودي.",
    "explain": "أنت معلم خبير. اشرح المفاهيم بطريقة بسيطة وسهلة الفهم.",
    "code": "أنت مبرمج محترف. اكتب كود نظيف وآمن مع شرح.",
    "detailed": "أنت باحث متخصص. قدم إجابات شاملة ومفصلة جداً.",
    "creative": "أنت كاتب إبداعي. اكتب بأسلوب جميل وإبداعي مع خيال."
}

def build_messages(mode, user_message, history):
    system_prompt = SYSTEM_PROMPTS.get(mode, SYSTEM_PROMPTS["general"])
    messages = [{"role": "system", "content": system_prompt}]
    
    for msg in history[-20:]:
        role = msg.get("role", "user")
        if role == "bot":
            role = "assistant"
        messages.append({"role": role, "content": msg.get("content", "")})
    
    messages.append({"role": "user", "content": user_message})
    return messages

async def get_groq_response(messages):
    if not GROQ_API_KEY:
        return "❌ لم يتم تعيين GROQ_API_KEY. الرجاء إضافة المفتاح في .env"
    
    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "model": "openai/gpt-oss-120b",
        "messages": messages,
        "temperature": 0.7,
        "max_tokens": 1024
    }
    
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(GROQ_API_URL, json=payload, headers=headers)
            response.raise_for_status()
            data = response.json()
            return data.get("choices", [{}])[0].get("message", {}).get("content", "❌ لم أتمكن من الرد")
    except httpx.HTTPStatusError as e:
        return f"❌ خطأ: {e.response.status_code} - تحقق من GROQ_API_KEY"
    except Exception as e:
        return f"❌ خطأ في الاتصال: {str(e)}"

@APP.post("/api/chat")
async def chat(request: dict):
    message = request.get("message", "")
    mode = request.get("mode", "general")
    history = request.get("history", [])
    
    if not message:
        return {"answer": "❌ الرسالة فارغة!"}
    
    messages = build_messages(mode, message, history)
    answer = await get_groq_response(messages)
    
    return {"answer": answer}

@APP.get("/api/health")
async def health():
    return {"status": "ok"}

APP.mount("/static", StaticFiles(directory="static"), name="static")

@APP.get("/")
async def root():
    return FileResponse("static/index.html")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(APP, host="0.0.0.0", port=8000)
