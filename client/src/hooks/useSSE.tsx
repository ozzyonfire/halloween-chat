import { useCallback, useEffect, useState } from "react";

interface EventData {
  [key: string]: string;
}

export function useSSE(url: string | boolean, options?: EventSourceInit) {
  const [connectionState, setConnectionState] = useState<string>("CONNECTING");
  const [connectionError, setConnectionError] = useState<Event | null>(null);
  const [eventSource, setEventSource] = useState<EventSource | null>(null);
  const [data, setData] = useState<EventData>({});

  useEffect(() => {
    if (!url) return;
    if (typeof url === "boolean") return;
    const es = new EventSource(url, options);
    setEventSource(es);

    es.onopen = () => setConnectionState("OPEN");
    es.onerror = (error: Event) => {
      setConnectionState("ERROR - CLOSED");
      setConnectionError(error);
    };

    return () => {
      es.close();
    };
  }, [url, options]);

  const addListener = useCallback(
    (eventName: string, eventHandler: (data: string) => void) => {
      if (eventSource) {
        eventSource.addEventListener(eventName, (event: MessageEvent) => {
          setData((prevData) => ({
            ...prevData,
            [eventName]: event.data,
          }));
          eventHandler(event.data);
        });
      }
    },
    [eventSource]
  );

  const closeConnection = useCallback(
    () => eventSource?.close(),
    [eventSource]
  );

  return {
    connectionState,
    connectionError,
    addListener,
    data,
    closeConnection,
  };
}
