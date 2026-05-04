export interface MiniCrmConfig {
  systemId: string;
  apiKey: string;
  baseUrl: string;
  voipApiKey?: string;
  // Self-service module allowlist resolved at OAuth login time. null = no
  // restriction. Aggregating tools (my_day, list_all_todos, ...) honor this
  // to scope scans to the user's selected modules.
  allowedCategoryIds?: number[] | null;
}

export interface SearchResponse {
  Count: number;
  Results: Record<string, Record<string, unknown>>;
}

export interface ContactSearchResult {
  Id: number;
  Name: string;
  Url: string;
  Type: "Person" | "Business";
  Email?: string;
  Phone?: string;
  BusinessId?: number;
}

export interface ProjectSearchResult {
  Id: number;
  Name: string;
  Url: string;
  ContactId: number;
  StatusId: number;
  UserId: number;
  Deleted: number;
  BusinessId?: number;
}

export interface StatusHistoryEntry {
  Id: number;
  ProjectId: number;
  Type: string;
  UserId: number;
  ClosedAt: string;
  Status_Old_Id: number;
  Status_New_Id: number;
  Status_Old_Name: string;
  Status_New_Name: string;
}

export interface ToDoResult {
  Id: number;
  UserId: number;
  ContactId: number;
  ProjectId: number;
  AddressId: number;
  SenderUserId: number;
  Type: string;
  Duration: number;
  Reminder: number;
  Status: string;
  Mode: string;
  Deadline: string;
  Comment: string;
  CreatedBy: string;
  CreatedAt: string;
  UpdatedBy: string;
  UpdatedAt: string;
  ClosedBy: string;
  ClosedAt: string;
}

export interface TemplateResult {
  Id: number;
  CategoryId: number;
  Type: string;
  Name: string;
  Subject?: string;
  Content?: string;
  FolderId?: number;
  Folders?: unknown[];
}

export interface OrderResult {
  Id: number;
  CustomerId: number;
  StatusGroup: string;
  CurrencyCode: string;
  [key: string]: unknown;
}

export interface InvoiceResult {
  Id: number;
  CustomerId: number;
  StatusGroup: string;
  [key: string]: unknown;
}

export interface OfferResult {
  Id: number;
  CustomerId: number;
  StatusGroup: string;
  [key: string]: unknown;
}

export interface CallLogEntry {
  Number: string;
  Duration: number;
  CallType: number;
  Date: string;
  ReferenceId?: string;
}

export interface CallLogResponse {
  Skipped: number;
  Processed: number;
  Exists: number;
}
