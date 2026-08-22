export function getInvitationAcceptanceError(input: { invitedEmail: string; acceptingEmail?: string | null; acceptedAt: Date | null; expiresAt: Date }, now = new Date()) {
  if (input.acceptedAt || input.expiresAt <= now) return "This invitation is unavailable";
  if (!input.acceptingEmail) return "An email address is required to accept an invitation";
  if (input.invitedEmail.toLowerCase() !== input.acceptingEmail.toLowerCase()) return "This invitation was issued to a different email address";
  return null;
}
