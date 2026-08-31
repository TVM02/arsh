'use client';

import { useEffect } from 'react';

export default function GoogleTranslate() {
  useEffect(() => {
    // Avoid re-loading the script if it's already added
    if (!document.querySelector('script[src*="translate.google.com/translate_a/element.js"]')) {
      const script = document.createElement('script');
      script.src = '//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
      script.async = true;
      document.body.appendChild(script);
    }

    // Prevent redefining the init function multiple times
    if (!window.googleTranslateElementInit) {
      window.googleTranslateElementInit = () => {
        if (!window.google?.translate?.TranslateElement) return;

        new window.google.translate.TranslateElement(
          {
            pageLanguage: 'en',
            includedLanguages: 'en,ml',
            layout: window.google.translate.TranslateElement.InlineLayout.SIMPLE,
            autoDisplay: false,
          },
          'google_translate_element'
        );
      };
    }
  }, []);

  return (
    <div
      id="google_translate_element"
      className="bg-white text-teal-800 text-sm rounded px-2 py-1 font-medium border border-teal-200 hover:bg-yellow-400 hover:text-black transition-all duration-200"
    />
  );
}
