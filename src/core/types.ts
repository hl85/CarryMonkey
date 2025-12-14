export type Grant =
  | "GM_setValue"
  | "GM_getValue"
  | "GM_setClipboard"
  | "GM_getResourceText"
  | "GM_getResourceURL"
  | "GM_addStyle"
  | "GM_xmlhttpRequest"
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

export interface InjectionStrategy {
  method: 'content-script' | 'userscripts-api' | 'userscripts-dynamic';
  world: 'MAIN' | 'USER_SCRIPT';
  timing: 'document_start' | 'document_end' | 'document_idle';
  reason: string;
}

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
    connect: string[];
    resource: Record<string, string>;
    downloadURL: string;
    updateURL: string;
    "run-at": RunAt;
    sandbox?: 'raw' | 'JavaScript' | 'DOM';
    // 注入策略缓存
    _injectionStrategy?: InjectionStrategy;
  };
  lastUpdated: number;
}

