"use client";

import { MessageCircle } from "lucide-react";

export default function WhatsAppSupport() {
  const phoneNumber = "918891177850";

  const message =
    "Assalamu Alaikum, I need support regarding DKJU Madrasa Portal.";

  const whatsappUrl =
    `https://wa.me/${phoneNumber}?text=${encodeURIComponent(
      message,
    )}`;

  return (
    <a
      href={whatsappUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="WhatsApp Support"
      title="WhatsApp Support"
      className="
        fixed
        bottom-5
        right-5
        z-[9999]

        flex
        items-center
        gap-2

        rounded-full
        bg-[#25D366]
        px-4
        py-3

        text-white
        font-semibold
        text-sm

        shadow-lg
        hover:scale-105
        hover:shadow-xl

        transition-all
        duration-200
      "
    >
      <MessageCircle
        className="h-5 w-5 whatsapp-blink"
        strokeWidth={2.3}
      />

      
    </a>
  );
}