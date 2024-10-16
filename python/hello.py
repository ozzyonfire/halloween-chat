import speech_recognition as sr
import requests
import json
import uuid
import pyaudio
from pydub import AudioSegment
from io import BytesIO
import os
from dotenv import load_dotenv
import time
from enum import Enum

# Load the .env file
load_dotenv()

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")

# Initialize the recognizer
recognizer = sr.Recognizer()
conversation_id = str(uuid.uuid4())

class State(Enum):
    LISTENING = "listening"
    CHATTING = "chatting"

state = State.LISTENING

def listen_for_speech():
    global state
    # Use the default microphone as the audio source
    with sr.Microphone() as source:
        print("Adjusting for ambient noise, please wait...")
        # Adjust for ambient noise to reduce false positives
        recognizer.adjust_for_ambient_noise(source, duration=5)
        print("Listening for speech...")

        # Continuously listen for input and detect speech
        while True:
            try:
                if (state == State.CHATTING):
                    # If we're currently chatting, don't listen for speech
                    continue
                
                # Listen to the audio (non-blocking)
                audio = recognizer.listen(source)
                
                # Now check if there's speech detected
                print("Audio captured, sending for transcription...")
                
                # Transcribe the audio using Google's speech recognition (or other recognizers)
                time_start = time.time()
                transcription = recognizer.recognize_google(audio)
                print(f"Recognize google Transcription: {transcription}")
                time_end = time.time()
                
                print(f"Google Transcription took {time_end - time_start} seconds")
                
                # Send transcription off to an AI or other service for processing
                process_transcription(transcription)

                # recognize speech using Whisper API
                # time_start = time.time()
                # transcription = recognizer.recognize_whisper_api(audio, api_key=OPENAI_API_KEY)
                # print(f"Whisper API thinks you said {transcription}")
                # time_end = time.time()
                
                # print(f"Open AI Transcription took {time_end - time_start} seconds")
            except sr.WaitTimeoutError:
                # Handle case where no speech is detected within timeout
                print("No speech detected, still listening...")
            except sr.UnknownValueError:
                # If speech was unintelligible
                print("Could not understand audio, try again.")
            except sr.RequestError as e:
                # If there was an issue with the recognizer service
                print(f"Error with the recognition service: {e}")

def process_transcription(transcription):
    global state
    global conversation_id
    print(f"Processing transcription: {transcription}")
    # You could send this transcription to ChatGPT, a text processor, etc.
    # Here, it's just printed out for demo purposes.
    
    url = "http://localhost:8000/chat"  # Replace with your target URL
    data = {
        "message": transcription,
        "id": conversation_id,
    }
    
    json_data = json.dumps(data)
    
    try:
        response = requests.post(url, data=json_data, headers={"Content-Type": "application/json"}, stream=True)
        response.raise_for_status()  # Raise an exception for HTTP errors
        
        # Initialize PyAudio
        p = pyaudio.PyAudio()
        stream = p.open(format=p.get_format_from_width(2),
                        channels=1,
                        rate=16000,
                        output=True)
        
        # Stream the response and play the audio
        audio_data = BytesIO()
        for chunk in response.iter_content(chunk_size=1024):
            if chunk:
                audio_data.write(chunk)
                
        # Reset the stream to the beginning
        audio_data.seek(0)
        
        # Load the audio data into an AudioSegment
        audio_segment = AudioSegment.from_file(audio_data, format="wav")
        
        # Initialize PyAudio
        p = pyaudio.PyAudio()
        stream = p.open(format=p.get_format_from_width(audio_segment.sample_width),
                        channels=audio_segment.channels,
                        rate=audio_segment.frame_rate,
                        output=True)
        
        # Play the audio
        state = State.CHATTING
        print("Playing audio...")
        stream.write(audio_segment._data)
        
        # Close the stream
        stream.stop_stream()
        stream.close()
        p.terminate()
        state = State.LISTENING
        
        print("Audio played successfully. Listening for speech...")        
    except requests.exceptions.RequestException as e:
        print(f"HTTP request failed: {e}")

if __name__ == "__main__":
    listen_for_speech()