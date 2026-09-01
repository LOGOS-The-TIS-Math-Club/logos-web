export const TECHNICAL_ACCESS_LEVELS = [
  "basic",
  "operator",
  "access_admin",
] as const;
export type TechnicalAccessLevel = (typeof TECHNICAL_ACCESS_LEVELS)[number];

export const CAPABILITIES = [
  "identity:self:read",
  "identity:review",
  "access:assign",
  "access:revoke",
  "session:revoke",
  "application:review",
  "application:export",
] as const;
export type Capability = (typeof CAPABILITIES)[number];

const capabilityMap: Readonly<
  Record<TechnicalAccessLevel, ReadonlySet<Capability>>
> = {
  basic: new Set(["identity:self:read"]),
  operator: new Set([
    "identity:self:read",
    "identity:review",
    "application:review",
    "application:export",
  ]),
  access_admin: new Set([
    "identity:self:read",
    "access:assign",
    "access:revoke",
    "session:revoke",
  ]),
};

export function hasCapability(
  level: string | null | undefined,
  capability: string,
): boolean {
  if (!TECHNICAL_ACCESS_LEVELS.includes(level as TechnicalAccessLevel))
    return false;
  if (!CAPABILITIES.includes(capability as Capability)) return false;
  return capabilityMap[level as TechnicalAccessLevel].has(
    capability as Capability,
  );
}
