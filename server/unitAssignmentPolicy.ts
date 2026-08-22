export function canAssignResidentToUnit(member: { role: string; status: string } | null | undefined) {
  return member?.role === "resident" && member.status === "active";
}
