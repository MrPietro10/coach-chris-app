export type AlphaAccessAttemptLog = {
  alphaCode: string;
  success: boolean;
  timestamp: string;
  ip: string;
  userAgent: string;
  path: string;
};

export function logAlphaAccessAttempt(entry: AlphaAccessAttemptLog): void {
  console.log("ALPHA ACCESS ATTEMPT:", entry);
}
