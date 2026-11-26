import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useFirebase } from "../context/FirebaseDataContext";
import { useGivingAccess } from "../hooks/useGivingAccess";
import { hasAnyRight } from "../utils/giving/access";
import { mayEnterAdmin, signInUrl } from "../utils/session";
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
  if (requireAdmin && !mayEnterAdmin(session.person)) return <GivingAdminEntry>{children}</GivingAdminEntry>;
  return <>{children}</>;
};

/**
 * Someone who is not an administrator, web editor or membership clerk gets into the admin only with a right in
 * givertjeneste. Until that is known, nothing is decided. Only this person's own rights are read, and only here.
 */
const GivingAdminEntry: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const giving = useGivingAccess();
  if (giving.loading) return <p className="p-6 text-sm text-slate-500">Laster …</p>;
  if (!hasAnyRight(giving.access)) return <AdminAccessRequired target="administrasjonen" />;
  return <>{children}</>;
};
