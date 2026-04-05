"use client";

import { useEffect } from "react";

export function ZapierChatbot() {
  useEffect(() => {
    // Inject the module script once
    if (!document.querySelector("[data-zapier-chatbot]")) {
      const script = document.createElement("script");
      script.src =
        "https://interfaces.zapier.com/assets/web-components/zapier-interfaces/zapier-interfaces.esm.js";
      script.type = "module";
      script.async = true;
      script.setAttribute("data-zapier-chatbot", "1");
      document.body.appendChild(script);
    }

    // Inject the custom element once
    if (!document.querySelector("zapier-interfaces-chatbot-embed")) {
      const el = document.createElement("zapier-interfaces-chatbot-embed");
      el.setAttribute("is-popup", "true");
      el.setAttribute("chatbot-id", "cmmeipjdf00rx10bg7zr8p8ne");
      document.body.appendChild(el);
    }
  }, []);

  return null;
}
