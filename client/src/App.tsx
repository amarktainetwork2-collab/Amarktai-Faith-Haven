import { useAuth } from "@/_core/hooks/useAuth";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { useEffect } from "react";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ActiveOrganisationProvider } from "./contexts/ActiveOrganisationContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import BuyerReport from "./pages/BuyerReport";
import Home from "./pages/Home";
import Invite, { INVITE_RESUME_KEY } from "./pages/Invite";
import Legal from "./pages/Legal";
import PublicShare from "./pages/PublicShare";
import PublicPage from "./pages/PublicPage";
import Workspace from "./pages/Workspace";

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/report/preview"} component={BuyerReport} />
      <Route path={"/platform"} component={PublicPage} />
      <Route path={"/buyers"} component={PublicPage} />
      <Route path={"/agencies"} component={PublicPage} />
      <Route path={"/management"} component={PublicPage} />
      <Route path={"/intelligence"} component={PublicPage} />
      <Route path={"/security"} component={PublicPage} />
      <Route path={"/pricing"} component={PublicPage} />
      <Route path={"/s/:token"} component={PublicShare} />
      <Route path={"/privacy"} component={Legal} />
      <Route path={"/terms"} component={Legal} />
      <Route path={"/trust"} component={Legal} />
      <Route path={"/invite/:token"} component={Invite} />
      <Route path={"/app"} component={Workspace} />
      <Route path={"/app/:section"} component={Workspace} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function InvitationResume() {
  const { user, loading } = useAuth();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    if (loading || !user || location.startsWith("/invite/")) return;
    const token = window.sessionStorage.getItem(INVITE_RESUME_KEY);
    if (token) setLocation(`/invite/${token}`);
  }, [loading, location, setLocation, user]);

  return null;
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <ActiveOrganisationProvider>
          <TooltipProvider>
            <Toaster />
            <InvitationResume />
            <Router />
          </TooltipProvider>
        </ActiveOrganisationProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
