import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useActiveOrganisation } from "@/contexts/ActiveOrganisationContext";
import { trpc } from "@/lib/trpc";
import { startLogin } from "@/const";
import { BadgeCheck, CircleAlert, UsersRound } from "lucide-react";
import { useEffect, useRef } from "react";
import { useLocation, useRoute } from "wouter";

const INVITE_RESUME_KEY = "amarktai-property.pending-invitation";

export default function Invite() {
  const [, params] = useRoute("/invite/:token");
  const token = params?.token ?? "";
  const { user, loading } = useAuth();
  const { setOrganisationId } = useActiveOrganisation();
  const [, setLocation] = useLocation();
  const attempted = useRef(false);
  const acceptInvite = trpc.platform.acceptInvite.useMutation({
    onSuccess: invitation => {
      setOrganisationId(invitation.organisationId);
      window.sessionStorage.removeItem(INVITE_RESUME_KEY);
      setLocation("/app");
    },
  });

  useEffect(() => {
    if (!user || !token || attempted.current) return;
    attempted.current = true;
    acceptInvite.mutate({ token });
  }, [acceptInvite, token, user]);

  const signIn = () => {
    window.sessionStorage.setItem(INVITE_RESUME_KEY, token);
    startLogin();
  };

  if (loading) return <InviteState title="Checking invitation" copy="Confirming your secure invitation link…" />;
  if (!user) return <InviteState title="Sign in to accept your invitation" copy="This invitation is tied to the email address it was issued to. Sign in with that address to join the organisation." actionLabel="Sign in to continue" onAction={signIn} />;
  if (acceptInvite.isError) return <InviteState title="This invitation cannot be accepted" copy={acceptInvite.error.message} error />;
  return <InviteState title="Joining your organisation" copy="Validating the invitation, its expiry, and your email address…" />;
}

function InviteState({ title, copy, actionLabel, onAction, error = false }: { title: string; copy: string; actionLabel?: string; onAction?: () => void; error?: boolean }) {
  return <div className="grid min-h-screen place-items-center bg-[#f7f8f5] px-5"><section className="soft-card w-full max-w-lg p-8 text-center"><span className={`mx-auto grid size-12 place-items-center rounded-2xl ${error ? "bg-[#fff0ef] text-[#b7453f]" : "bg-[#edf5ef] text-[#337f88]"}`}>{error ? <CircleAlert className="size-6" /> : <UsersRound className="size-6" />}</span><p className="eyebrow mt-5">Amarktai Property invitation</p><h1 className="font-editorial mt-3 text-3xl text-[#193552]">{title}</h1><p className="mt-3 leading-7 text-slate-600">{copy}</p>{actionLabel && onAction && <Button onClick={onAction} className="mt-6 rounded-full bg-[#193552] hover:bg-[#264b6c]">{actionLabel}</Button>}{!error && !actionLabel && <p className="mt-6 flex items-center justify-center gap-2 text-xs font-semibold text-[#337f88]"><BadgeCheck className="size-4" />Your access remains role-scoped after acceptance.</p>}</section></div>;
}

export { INVITE_RESUME_KEY };
