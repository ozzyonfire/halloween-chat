import { CornerDownLeft, Mic } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useEffect, useRef, useState } from "react";
import { Toggle } from "./components/ui/toggle";

export function MessageBox(props: {
  onMessageAdded: (userContent: string) => void;
}) {
  const { onMessageAdded } = props;
  const [isListening, setIsListening] = useState(false);
  const [speechRecognitionAvailable, setSpeechRecognitionAvailable] =
    useState(true);
  const [transcript, setTranscript] = useState("");
  const [recognition, setRecognition] = useState<SpeechRecognition>();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (formRef.current) {
      const currentForm = formRef.current;
      const handleKeyDown = (e: KeyboardEvent) => {
        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
          e.preventDefault();
          e.stopPropagation();
          console.log("Ctrl + Enter pressed");
          currentForm.dispatchEvent(
            new Event("submit", { cancelable: true, bubbles: true })
          );
        }
      };

      formRef.current.addEventListener("keydown", handleKeyDown);
      return () => {
        currentForm.removeEventListener("keydown", handleKeyDown);
      };
    }
  }, [formRef]);

  useEffect(() => {
    // Check if browser supports SpeechRecognition
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert(
        "Your browser does not support Speech Recognition. Please use Google Chrome."
      );
      setSpeechRecognitionAvailable(false);
      return;
    }

    // Create a new recognition instance
    const recognitionInstance = new SpeechRecognition();
    recognitionInstance.continuous = true; // Continuously listen
    recognitionInstance.interimResults = true; // Get results as the user speaks
    recognitionInstance.lang = "en-US"; // Set language
    setRecognition(recognitionInstance);
    console.log("recognitionInstance", recognitionInstance);

    // Handle speech recognition results
    recognitionInstance.onresult = (event) => {
      console.log("Speech recognition result", event);
      let finalTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        }
      }
      setTranscript((prev) => prev + finalTranscript);
    };

    // Handle speech recognition errors
    recognitionInstance.onerror = (event) => {
      console.log(event);
      console.error("Speech recognition error", event.error);
    };

    // Stop recognition if browser stops listening
    recognitionInstance.onend = () => {
      console.log("Speech recognition ended");
      if (isListening) {
        console.log("Restarting speech recognition");
        recognitionInstance.start(); // Restart recognition if it's still listening
      }
    };
  }, [isListening]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const message = formData.get("message") as string;
    onMessageAdded(message);
    // clear the form
    const form = e.currentTarget;
    form.reset();
  };

  return (
    <>
      <div className="p-3 text-sm text-center">{transcript}</div>
      <form
        onSubmit={handleSubmit}
        ref={formRef}
        className="relative overflow-hidden rounded-lg border bg-background focus-within:ring-1 focus-within:ring-ring"
      >
        <Label htmlFor="message" className="sr-only">
          Message
        </Label>
        <Textarea
          id="message"
          name="message"
          placeholder="Type your message here..."
          // onKeyDown={(e) => {
          //   if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
          //     console.log("Ctrl + Enter pressed");
          //     e.preventDefault();
          //     e.stopPropagation();
          //     formRef.current?.submit();
          //   }
          // }}
          className="min-h-12 resize-none border-0 p-3 shadow-none focus-visible:ring-0"
        />
        <div className="flex items-center p-3 pt-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <Toggle
                disabled={!speechRecognitionAvailable}
                variant="default"
                type="button"
                pressed={isListening}
                onPressedChange={(pressed) => {
                  // setIsListening(pressed);
                  setIsListening(pressed);
                  console.log("pressed", pressed);
                  if (pressed) {
                    recognition?.start();
                  } else {
                    recognition?.stop();
                  }
                }}
              >
                <Mic className="size-4" />
                <span className="sr-only">Use Microphone</span>
              </Toggle>
            </TooltipTrigger>
            <TooltipContent side="top">Use Microphone</TooltipContent>
          </Tooltip>
          <Button type="submit" size="sm" className="ml-auto gap-1.5">
            Send Message
            <CornerDownLeft className="size-3.5" />
          </Button>
        </div>
      </form>
    </>
  );
}
