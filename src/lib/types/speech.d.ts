/**
 * Minimal type declarations for the Web Speech API (SpeechRecognition).
 * Not part of standard TS DOM lib — we only declare what we use.
 */

export {};

interface JmSpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

interface JmSpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): JmSpeechRecognitionAlternative;
  [index: number]: JmSpeechRecognitionAlternative;
}

interface JmSpeechRecognitionResultList {
  readonly length: number;
  item(index: number): JmSpeechRecognitionResult;
  [index: number]: JmSpeechRecognitionResult;
}

interface JmSpeechRecognitionEvent extends Event {
  readonly results: JmSpeechRecognitionResultList;
  readonly resultIndex: number;
}

interface JmSpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message?: string;
}

interface JmSpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((this: JmSpeechRecognition, ev: JmSpeechRecognitionEvent) => void) | null;
  onend: ((this: JmSpeechRecognition, ev: Event) => void) | null;
  onerror:
    | ((this: JmSpeechRecognition, ev: JmSpeechRecognitionErrorEvent) => void)
    | null;
  onstart: ((this: JmSpeechRecognition, ev: Event) => void) | null;
}

type JmSpeechRecognitionConstructor = new () => JmSpeechRecognition;

declare global {
  interface Window {
    SpeechRecognition?: JmSpeechRecognitionConstructor;
    webkitSpeechRecognition?: JmSpeechRecognitionConstructor;
  }
}
