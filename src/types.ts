export type Grant =
  | "GM_setValue"
  | "GM_getValue"
  | "GM_setClipboard"
  | "unsafeWindow"
  | "window.close"
  | "window.focus"
  | "window.onurlchange"
  | "none";

export type RunAt =
  | "document-start"
  | "document-body"
  | "document-end"
  | "document-idle"
  | "context-menu";

export interface UserScript {
  id: string;
  content: string;
  enabled: boolean;
  meta: {
    name: string;
    namespace: string;
    version: string;
    description: string;
    author: string;
    match: string[];
    icon: string;
    grant: Grant[];
    copyright: string;
    license: string;
    source: string;
    supportURL: string;
    require: string[];
    compatible: string[];
    downloadURL: string;
    updateURL: string;
    "run-at": RunAt;
  };
  lastUpdated: number;
}
