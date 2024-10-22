import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { TooltipProvider } from "./components/ui/tooltip.tsx";
import { ImageViewer } from "./image-viewer.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <TooltipProvider>
      {/* <App /> */}
      <ImageViewer />
    </TooltipProvider>
  </StrictMode>
);
