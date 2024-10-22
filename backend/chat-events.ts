class ChatEvent extends Event {
  content: string;
  id: string;
  constructor(type: string, id: string, content: string) {
    super(type);
    this.content = content;
    this.id = id;
  }
}

class ChatImageGeneratedEvent extends Event {
  url: URL;
  constructor(url: URL) {
    super("chatImageGenerated");
    this.url = url;
  }
}

class ChatEventTarget extends EventTarget {
  constructor() {
    super();
  }

  chatCompleted(id: string, content: string) {
    this.dispatchEvent(new ChatEvent("chatCompleted", id, content));
  }

  onChatCompleted(id: string, callback: (event: ChatEvent) => void) {
    this.addEventListener("chatCompleted", (e) => {
      if (e instanceof ChatEvent) {
        if (e.id === id) {
          callback(e);
        }
      }
    });
  }

  chatImageGenerated(url: URL) {
    this.dispatchEvent(new ChatImageGeneratedEvent(url));
  }

  onChatImageGenerated(callback: (event: ChatImageGeneratedEvent) => void) {
    this.addEventListener("chatImageGenerated", (e) => {
      if (e instanceof ChatImageGeneratedEvent) {
        callback(e);
      }
    });
  }
}

export const chatEvents = new ChatEventTarget();
