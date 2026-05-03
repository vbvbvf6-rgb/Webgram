import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import type { InitOptions } from "i18next";
import en from "../locales/en.json";
import ru from "../locales/ru.json";

const savedLang = typeof localStorage !== "undefined" ? localStorage.getItem("droidgram_language") || "en" : "en";

const options: InitOptions = {
  resources: {
    en: { translation: en },
    ru: { translation: ru },
  },
  lng: savedLang,
  fallbackLng: "en",
  initImmediate: false,
  interpolation: { escapeValue: false },
};

i18n.use(initReactI18next).init(options);

export default i18n;
