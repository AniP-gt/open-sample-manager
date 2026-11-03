import { useCallback, useState, type SetStateAction } from "react";
import { useTranslation } from "react-i18next";
import { messageFromText, renderMessage, type UiMessage } from "./messages";

type MessageSetter = (next: SetStateAction<string | null> | UiMessage) => void;

export function useMessageState(initial: string | null = null): readonly [string | null, MessageSetter] {
  useTranslation();
  const [message, setMessage] = useState<UiMessage | null>(() => initial === null ? null : messageFromText(initial));
  const setText = useCallback<MessageSetter>((next) => {
    setMessage((previous) => {
      if (typeof next === "object" && next !== null) return next;
      const text = typeof next === "function" ? next(previous === null ? null : renderMessage(previous)) : next;
      return text === null ? null : messageFromText(text);
    });
  }, []);
  return [message === null ? null : renderMessage(message), setText];
}
