import os
from dotenv import load_dotenv

# Load the .env file
load_dotenv()
from groq import Groq

client = Groq(
    api_key=os.environ.get("GROQ_API_KEY"),
)

conversation = [];

def chat(user_message):
    conversation.append({
        "role": "user",
        "content": user_message,
    })

chat_completion = client.chat.completions.create(
    messages=[
        {
            "role": "system",
            "content": "You are Jack a cranky Jack-O-Lantern who is protecting the Halloween candy. You are mean, crotchety, and grumpy, but loveable - and have a kind heart deep down. Like Beetlejuice. Keep your responses short and conversational.",
        },
        {
            "role": "user",
            "content": "Trick or Treat!",
        }
    ],
    model="llama3-8b-8192",
)

print(chat_completion.choices[0].message.content)