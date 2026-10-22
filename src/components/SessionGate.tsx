import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useFirebase } from "../context/FirebaseDataContext";
import { mayOpenStudio, signInUrl } from "../utils/session";
import { AdminAccessRequired } from "./AdminAccessRequired";

interface SessionGateProps {
  /** The pages behind are the admin: for administrators, and the website part for web editors (see AdminStudio). */
  requireAdmin?: boolean;
  children: React.ReactNode;
}

/**
 * Stands in front of Min side and the admin: only someone who is signed in, and is a person in
 * the register, gets through. Everyone else is sent to the sign-in page, which says what is
 * missing and leads back here afterwards. Nothing behind the gate is drawn until it is known
 * who is asking.
 */
export const SessionGate: React.FC<SessionGateProps> = ({ requireAdmin = false, children }) => {
  const { session } = useFirebase();
  const location = useLocation();

  if (session.status === "loading") return <p className="p-6 text-sm text-slate-500">Laster …</p>;
  if (session.status !== "member") return <Navigate to={signInUrl(location.pathname + location.search)} replace />;
  if (requireAdmin && !mayOpenStudio(session.person)) return <AdminAccessRequired target="administrasjonen" />;
  return <>{children}</>;
};
